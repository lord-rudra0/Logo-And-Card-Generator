import express from 'express'
import fetch from 'node-fetch'
import { recommendStyle, checkAccessibility, ocrFromImageBase64 } from '../services/mlService.js'
import { saveBase64Image, getCacheUrl } from '../services/imageCache.js'
import { createJob, getJob } from '../services/jobQueue.js'

const router = express.Router()

const PY_ML_URL = process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL || null

const proxyToPython = async (path, payload) => {
  if (!PY_ML_URL) throw new Error('Python ML service not configured')
  const url = `${PY_ML_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Python ML service error ${r.status}: ${text}`)
  }
  return r.json()
}

// POST /api/ml/recommend-style
router.post('/recommend-style', async (req, res) => {
  try {
    const { industry, mood } = req.body || {}
    if (PY_ML_URL) {
      try {
        const data = await proxyToPython('recommend-style', { industry, mood })
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
        const data = await proxyToPython('check-accessibility', { elements })
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
        const data = await proxyToPython('ocr', { imageBase64 })
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
    // support async job creation: ?async=true
    const wantAsync = req.query && String(req.query.async) === 'true'
    if (wantAsync) {
      const job = createJob(async (updateProgress) => {
        // runner: proxy to python (if configured) then save images
        if (!PY_ML_URL) throw new Error('Python ML service not configured')
        // preliminary progress
        updateProgress(5)
        const data = await proxyToPython('generate/logo', payload)
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
        return { raw: data, images: saved }
      })
      return res.json({ success: true, jobId: job.id })
    }
    if (PY_ML_URL) {
      try {
        const data = await proxyToPython('generate/logo', payload)
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

    // Try to call Gemini (Google Generative API) if configured
    let detailedPrompt = null
    const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-1.0'
    if (GEMINI_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta2/${GEMINI_MODEL}:generateText`
        const promptText = `You are a professional logo designer and prompt engineer for image generation models. Given the following company brief, produce a concise but richly detailed Stable Diffusion / image-model prompt describing the composition, iconography, color palette, lighting, focal point, style, camera/angle, material details, and negative prompt (if needed).\n\nBrief:\n${brief}\n\nRespond only with the final prompt string.`
        const r = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GEMINI_KEY}`
          },
          body: JSON.stringify({
            prompt: { text: promptText },
            temperature: 0.2,
            maxOutputTokens: 800
          })
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
          const text = await r.text()
          console.warn('Gemini call failed', r.status, text)
        }
      } catch (e) {
        console.warn('Gemini call error:', e && e.message)
      }
    }

    // Fallback to a templated prompt if Gemini not available / failed
    if (!detailedPrompt) {
      detailedPrompt = `A clean, iconic logo for ${companyName || 'a company'}`
      if (tagline) detailedPrompt += ` with the tagline \"${tagline}\"`
      detailedPrompt += `, industry: ${resolvedIndustry}. Style: ${style || 'modern, minimal'}, colors: ${primaryColor || 'primary'}, ${secondaryColor || 'secondary'}. Generate a detailed image description for a Stable Diffusion-style model including composition, focal point, iconography, background, lighting, material textures, and a short negative prompt.`
    }

    // Support async job creation: ?async=true
    const wantAsync = req.query && String(req.query.async) === 'true'
    const mlPayload = { prompt: detailedPrompt, count, width, height }

    if (wantAsync) {
      const job = createJob(async (updateProgress) => {
        if (!PY_ML_URL) throw new Error('Python ML service not configured')
        updateProgress(5)
        // send to python ml
        const data = await proxyToPython('generate/logo', mlPayload)
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
    const data = await proxyToPython('generate/logo', mlPayload)
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
