import express from 'express'
import fetch from 'node-fetch'
import { recommendStyle, checkAccessibility, ocrFromImageBase64 } from '../services/mlService.js'
import { forwardToPython } from '../services/pythonProxy.js'
import { saveBase64Image, getCacheUrl } from '../services/imageCache.js'
import { setLastLogo } from '../services/logoStore.js'
import { createJob, getJob } from '../services/jobQueue.js'

const router = express.Router()

// One-time Gemini warning guard (avoid spamming logs per-request)
let _geminiWarned = false

const PY_ML_URL = process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL || 'http://localhost:8000'

// Simple request-id middleware and proxy helper that forwards the id
const generateReqId = () => {
  return `req_${Math.random().toString(36).slice(2, 9)}`
}

// Attach request-id to each incoming request if missing
router.use((req, res, next) => {
  const incoming = req.headers['x-request-id'] || req.headers['x_correlation_id'] || null
  req.requestId = incoming || generateReqId()
  res.setHeader('X-Request-Id', req.requestId)
  next()
})

const proxyToPython = async (path, payload, options = {}) => {
  // Delegate to centralized forwardToPython which appends default negative prompts
  // and preserves request-id tracing. Keep the same signature for backward-compat.
  return forwardToPython(path, payload, options)
}

// POST /api/ml/recommend-style
router.post('/recommend-style', async (req, res) => {
  try {
    const { industry, mood } = req.body || {}
    if (PY_ML_URL) {
      try {
  const data = await proxyToPython('recommend-style', { industry, mood }, { req })
        return res.json({ success: true, recommendation: data })
      } catch (e) {
        console.warn('Python ML proxy failed, falling back to JS:', e.message)
      }
    }
    const result = await recommendStyle({ industry, mood })
    res.json({ success: true, recommendation: result })
  } catch (err) {
    console.error('recommend-style error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})

// POST /api/ml/check-accessibility
router.post('/check-accessibility', async (req, res) => {
  try {
    const { elements } = req.body || {}
    if (PY_ML_URL) {
      try {
  const data = await proxyToPython('check-accessibility', { elements }, { req })
        return res.json({ success: true, report: data })
      } catch (e) {
        console.warn('Python ML proxy failed, falling back to JS:', e.message)
      }
    }
    const result = await checkAccessibility(elements || [])
    res.json({ success: true, report: result })
  } catch (err) {
    console.error('check-accessibility error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})

// POST /api/ml/ocr
router.post('/ocr', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 is required' })
    if (PY_ML_URL) {
      try {
  const data = await proxyToPython('ocr', { imageBase64 }, { req })
        return res.json({ success: true, ocr: data })
      } catch (e) {
        console.warn('Python ML proxy failed, falling back to JS:', e.message)
      }
    }
    const result = await ocrFromImageBase64(imageBase64)
    res.json({ success: true, ocr: result })
  } catch (err) {
    console.error('ocr error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})

// POST /api/ml/generate-logo
router.post('/generate-logo', async (req, res) => {
  try {
    const payload = req.body || {}

    // Enforce recommended defaults for legibility and output quality
    const enforceDefaults = (p) => {
      const out = Object.assign({}, p)
      // default steps/guidance
      out.steps = out.steps && Number(out.steps) > 0 ? Number(out.steps) : 30
      out.guidance_scale = out.guidance_scale || out.guidance || 7.5

      // enforce reasonable minimum dimensions for readable text
      try {
        const minW = 1024
        const minH = 640
        let w = out.width ? Number(out.width) : minW
        let h = out.height ? Number(out.height) : minH
        if (!w || !h) { w = minW; h = minH }
        // if either dimension is below minimum, scale up preserving aspect
        if (w < minW || h < minH) {
          const scaleX = minW / w
          const scaleY = minH / h
          const scale = Math.max(scaleX, scaleY)
          w = Math.ceil(w * scale)
          h = Math.ceil(h * scale)
        }
        out.width = w
        out.height = h
      } catch (e) {
        out.width = out.width || 1024
        out.height = out.height || 640
      }

      // Append legibility-focused instructions to prompt/description
      const instr = ' High-resolution, sharp, legible sans-serif typography; large readable name and contact text; no random glyphs — render any text exactly as provided; flat vector-style logo, single-color or two-color, no text inside logo except initials; avoid photoreal or metallic reflections that reduce legibility.'
      if (out.prompt && typeof out.prompt === 'string') {
        if (!out.prompt.toLowerCase().includes('legible') && !out.prompt.includes('no random glyphs')) {
          out.prompt = out.prompt.trim() + ' ' + instr
        }
      } else if (out.description && typeof out.description === 'string') {
        if (!out.description.toLowerCase().includes('legible') && !out.description.includes('no random glyphs')) {
          out.description = out.description.trim() + ' ' + instr
        }
      } else {
        out.prompt = instr.trim()
      }

  // Enable server-side postprocessing (SR/upscale/unsharp) by default
  out.postprocess = out.postprocess !== undefined ? out.postprocess : true
  out.postprocess_sr = out.postprocess_sr !== undefined ? out.postprocess_sr : true
  out.postprocess_upscale = out.postprocess_upscale || 1.5
  out.postprocess_unsharp_radius = out.postprocess_unsharp_radius || 1.0
  out.postprocess_unsharp_percent = out.postprocess_unsharp_percent || 150.0
  out.postprocess_unsharp_threshold = out.postprocess_unsharp_threshold || 3
  out.postprocess_autocontrast = out.postprocess_autocontrast !== undefined ? out.postprocess_autocontrast : true

      return out
    }

    const enforcedPayload = enforceDefaults(payload)
    // support async job creation: ?async=true
    const wantAsync = req.query && String(req.query.async) === 'true'
    if (wantAsync) {
      const job = createJob(async (updateProgress) => {
        // preliminary progress
        updateProgress(5)
  const data = await forwardToPython('generate/logo', enforcedPayload, { req })
        updateProgress(60)
        const imgs = data.images || data.generated_images || []
        const saved = imgs.map((d) => {
          try {
            const { filename } = saveBase64Image(d)
            return { url: getCacheUrl(filename), cached: true }
          } catch (e) {
            return { url: d, cached: false }
          }
        })
        // Save the first saved image as the 'last logo' for this requestId so card flow can pick it up
        if (saved && saved[0] && saved[0].url && req && req.requestId) {
          try { setLastLogo(req.requestId, saved[0].url) } catch (_) {}
        }
        updateProgress(95)
        return { raw: data, images: saved }
      })
      return res.json({ success: true, jobId: job.id })
    }
    if (PY_ML_URL) {
      try {
  const data = await forwardToPython('generate/logo', enforcedPayload, { req })
        // if data contains data.images or images as data URLs, save them to cache and return URLs
        const imgs = data.images || data.generated_images || []
        const saved = imgs.map((d) => {
          try {
            const { filename } = saveBase64Image(d)
            return { url: getCacheUrl(filename), cached: true }
          } catch (e) {
            return { url: d, cached: false }
          }
        })
        // Save first image as last logo for this requestId
        if (saved && saved[0] && saved[0].url && req && req.requestId) {
          try { setLastLogo(req.requestId, saved[0].url) } catch (_) {}
        }
        return res.json({ success: true, data: { raw: data, images: saved } })
      } catch (e) {
        console.warn('Python ML proxy failed for generate-logo, error:', e.message)
      }
    }
    return res.status(501).json({ success: false, error: 'Logo generation not available: configure Python ML service with HF token' })
  } catch (err) {
    console.error('generate-logo error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})

// POST /api/ml/generate-logo-gemini
// Body: { companyName, tagline, initials, industry, otherIndustry, primaryColor, secondaryColor, style, count, width, height }
router.post('/generate-logo-gemini', async (req, res) => {
  try {
    const body = req.body || {}
    const {
      companyName = '',
      tagline = '',
      initials = '',
      industry = '',
      otherIndustry = '',
      primaryColor,
      secondaryColor,
      style,
      count = 1,
      width = 512,
      height = 512
    } = body

    const resolvedIndustry = (otherIndustry && String(otherIndustry).trim()) || industry || 'technology'

    // Build a human-friendly briefing for Gemini
    const brief = `Company: ${companyName || 'Unnamed Company'}\nTagline: ${tagline || ''}\nInitials: ${initials || ''}\nIndustry: ${resolvedIndustry}\nStyle: ${style || 'modern/minimal'}\nColors: primary=${primaryColor || ''}, secondary=${secondaryColor || ''}`

  // Ensure companyToken is always defined (used later for enforcement)
  const companyToken = (companyName && String(companyName).trim()) || (initials && String(initials).trim()) || ''

    // Try to call Gemini (Google Generative API) if configured
    let detailedPrompt = null
    const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  if (GEMINI_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta2/${GEMINI_MODEL}:generateText`
  const promptText = `You are a professional logo designer and prompt engineer for image generation models. Given the following company brief, produce a concise but richly detailed Stable Diffusion / image-model prompt that will produce logo-style outputs (clean, vector-like, high-fidelity) directly tied to the brief. The generated prompt must clearly describe: composition, iconography, color palette (include primary and secondary), typography, focal point, negative space, materials/finish (for mockups), and an explicit negative-prompt section that prevents unrelated photographic content. IMPORTANT: the final prompt must explicitly include the company name, the company's first word, or the company's initials (whichever is available) as a visible textual or graphical element in the logo. If initials are provided, prefer using them as a dominant monogram motif. Require output suitable for both digital and print (scalable, crisp edges, transparent background recommended). Avoid people, landscapes, busy textures, stock photo elements, signatures, watermarks, or existing-brand logos.\n\nBrief:\n${brief}\n\nRespond only with the final prompt string.`
        const r = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GEMINI_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt: promptText, maxOutputTokens: 800 })
        })
        if (r.ok) {
          const j = await r.json()
          // Try several response shapes: text in output[0].content[0].text or candidates
          if (j && j.candidates && j.candidates[0] && j.candidates[0].content) {
            // some Gemini responses include content array
            const found = j.candidates[0].content.map(c => c.text || c).join('')
            detailedPrompt = String(found).trim()
          } else if (j && j.output && j.output[0] && j.output[0].content) {
            detailedPrompt = j.output[0].content.map(c => c.text || c).join('')
          } else if (j && j.candidate) {
            detailedPrompt = String(j.candidate).trim()
          } else if (typeof j === 'string') {
            detailedPrompt = j
          }
        } else {
          // Allow opt-out of noisy Gemini warnings (useful in local dev without a valid key)
          const suppress = process.env.SUPPRESS_GEMINI_WARN === '1'
          if (!suppress && !_geminiWarned) {
            _geminiWarned = true
            if (r.status === 401) {
              console.warn('Gemini call failed: 401 Unauthorized. Check GEMINI_API_KEY or unset it to disable Gemini. (details suppressed)')
            } else {
              const text = await r.text()
              console.warn('Gemini call failed', r.status, text && text.length > 200 ? text.slice(0, 200) + '...' : text)
            }
          }
        }
      } catch (e) {
        console.warn('Gemini call error:', e && e.message)
      }
    }

    // Fallback to a templated prompt if Gemini not available / failed
    if (!detailedPrompt) {
      // Rich fallback prompt that emphasizes brand alignment and realistic, print-ready output
      detailedPrompt = `Logo design brief: ${companyName || 'Unnamed Company'}${tagline ? ` — ${tagline}` : ''}. Industry: ${resolvedIndustry}. Preferred style: ${style || 'modern, minimal'}; colors: primary=${primaryColor || 'choose a clean brand color'}, secondary=${secondaryColor || 'complementary color'}. Requirements: produce a centered, memorable logo that includes the company name or initials as a textual or graphical element (initials preferred as a monogram when provided). Compose as a clean, vector-like wordmark/monogram or simple emblem, with strong negative space, balanced geometry, and scalable proportions. Use crisp flat shapes or subtle gradients suitable for print and digital; prefer transparent background for export. Typography: modern sans-serif, legible at small sizes. Materials/finishes for mockups (optional): matte paper, subtle embossing or spot-UV on the mark. Output instruction: write a Stable Diffusion / image-model prompt that explicitly lists composition, iconography, color palette, lighting, focal point, material/finish cues, and a short negative prompt (e.g., \"no people, no hands, no faces, no watermarks, no extraneous text, no photorealistic scenes\"). Ensure the prompt directs the model to render a logo-like graphic (vector-style, clean edges) and to avoid unrelated photographic imagery.`
    }

    // Server-side enforcement: if a company token (name or initials) was provided but isn't mentioned in the prompt,
    // append an explicit instruction so the image-model prompt includes the company name/initials visibly.
    if (companyToken) {
      try {
        const escaped = companyToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const hasToken = new RegExp(escaped, 'i').test(detailedPrompt)
        if (!hasToken) {
          detailedPrompt = detailedPrompt + ` Include the company name or initials: "${companyToken}" as a visible textual or graphical element (e.g., initials as a monogram) so the logo clearly references the brand.`
        }
      } catch (e) {
        // if regex building fails for any reason, append a plain instruction
        detailedPrompt = detailedPrompt + ` Include the company name or initials: "${companyToken}" as a visible textual or graphical element.`
      }
    }

    // Support async job creation: ?async=true
    const wantAsync = req.query && String(req.query.async) === 'true'
    // enforce defaults similar to generate-logo route
    const enforceGeminiDefaults = (p) => {
      const out = Object.assign({}, p)
      out.steps = out.steps && Number(out.steps) > 0 ? Number(out.steps) : 30
      out.guidance_scale = out.guidance_scale || 7.5
      out.width = out.width || 1024
      out.height = out.height || 640
      const instr = ' High-resolution, sharp, legible sans-serif typography; large readable name and contact text; no random glyphs — render any text exactly as provided; flat vector-style logo, single-color or two-color, no text inside logo except initials; avoid photoreal or metallic reflections that reduce legibility.'
      if (out.prompt && typeof out.prompt === 'string') {
        if (!out.prompt.toLowerCase().includes('legible') && !out.prompt.includes('no random glyphs')) {
          out.prompt = out.prompt.trim() + ' ' + instr
        }
      }
      return out
    }

    const mlPayload = enforceGeminiDefaults({ prompt: detailedPrompt, count, width, height })
  // enable postprocess defaults for gemini path as well
  mlPayload.postprocess = mlPayload.postprocess !== undefined ? mlPayload.postprocess : true
  mlPayload.postprocess_sr = mlPayload.postprocess_sr !== undefined ? mlPayload.postprocess_sr : true
  mlPayload.postprocess_upscale = mlPayload.postprocess_upscale || 1.5
  mlPayload.postprocess_unsharp_radius = mlPayload.postprocess_unsharp_radius || 1.0
  mlPayload.postprocess_unsharp_percent = mlPayload.postprocess_unsharp_percent || 150.0
  mlPayload.postprocess_unsharp_threshold = mlPayload.postprocess_unsharp_threshold || 3
  mlPayload.postprocess_autocontrast = mlPayload.postprocess_autocontrast !== undefined ? mlPayload.postprocess_autocontrast : true

    if (wantAsync) {
      const job = createJob(async (updateProgress) => {
        if (!PY_ML_URL) throw new Error('Python ML service not configured')
        updateProgress(5)
  // send to python ml
  const data = await proxyToPython('generate/logo', mlPayload, { req })
        updateProgress(60)
        const imgs = data.images || data.generated_images || []
        const saved = imgs.map((d) => {
          try {
            const { filename } = saveBase64Image(d)
            return { url: getCacheUrl(filename), cached: true }
          } catch (e) {
            return { url: d, cached: false }
          }
        })
        updateProgress(95)
        return { prompt: detailedPrompt, raw: data, images: saved }
      })
      return res.json({ success: true, jobId: job.id })
    }

    // Synchronous path
    if (!PY_ML_URL) return res.status(501).json({ success: false, error: 'Python ML service not configured' })
  const data = await proxyToPython('generate/logo', mlPayload, { req })
    const imgs = data.images || data.generated_images || []
    const saved = imgs.map((d) => {
      try {
        const { filename } = saveBase64Image(d)
        return { url: getCacheUrl(filename), cached: true }
      } catch (e) {
        return { url: d, cached: false }
      }
    })
    return res.json({ success: true, data: { prompt: detailedPrompt, raw: data, images: saved } })
  } catch (err) {
    console.error('generate-logo-gemini error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})

// GET /api/ml/job/:id
router.get('/job/:id', async (req, res) => {
  try {
    const id = req.params.id
    const job = getJob(id)
    if (!job) return res.status(404).json({ success: false, error: 'job not found' })
    res.json({ success: true, job: { id: job.id, status: job.status, progress: job.progress, error: job.error, result: job.result } })
  } catch (err) {
    console.error('job status error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})

export default router
