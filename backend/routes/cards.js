import express from 'express'
import fetch from 'node-fetch'
import { forwardToPython } from '../services/pythonProxy.js'
import { getAndClearLastLogo } from '../services/logoStore.js'
import { generateCardDesign, generateCardImage, generateCardSVG } from '../services/aiService.js'
import overlayTextOnImage from '../services/imageTextRenderer.js'

const router = express.Router()

// Generate AI-powered business card designs
router.post('/generate-card-design', async (req, res) => {
  try {
    const { cardData, industry, count } = req.body
    const genAI = req.app.locals.genAI

    if (!cardData.name || !cardData.company) {
      return res.status(400).json({ 
        error: 'Name and company are required for card generation' 
      })
    }

    const designs = await generateCardDesign(genAI, cardData, industry, count || 10)
    
    res.json({
      success: true,
      designs,
      message: 'Card designs generated successfully'
    })
  } catch (error) {
    console.error('Error generating card design:', error)
    res.status(500).json({ 
      error: 'Failed to generate card design',
      details: error.message
    })
  }
})

// Get industry-specific templates
router.get('/templates/:industry', (req, res) => {
  const { industry } = req.params
  
  const templates = {
    technology: [
      { id: 'tech-modern', name: 'Tech Modern', colors: ['#3b82f6', '#1e40af'] },
      { id: 'tech-gradient', name: 'Tech Gradient', colors: ['#8b5cf6', '#3b82f6'] },
      { id: 'tech-minimal', name: 'Tech Minimal', colors: ['#10b981', '#059669'] }
    ],
    creative: [
      { id: 'creative-bold', name: 'Creative Bold', colors: ['#ef4444', '#dc2626'] },
      { id: 'creative-artistic', name: 'Creative Artistic', colors: ['#f59e0b', '#d97706'] },
      { id: 'creative-vibrant', name: 'Creative Vibrant', colors: ['#8b5cf6', '#7c3aed'] }
    ],
    healthcare: [
      { id: 'health-calm', name: 'Healthcare Calm', colors: ['#06b6d4', '#0891b2'] },
      { id: 'health-trust', name: 'Healthcare Trust', colors: ['#10b981', '#059669'] },
      { id: 'health-professional', name: 'Healthcare Professional', colors: ['#3b82f6', '#1e40af'] }
    ],
    business: [
      { id: 'business-classic', name: 'Business Classic', colors: ['#1f2937', '#374151'] },
      { id: 'business-modern', name: 'Business Modern', colors: ['#3b82f6', '#1e40af'] },
      { id: 'business-elegant', name: 'Business Elegant', colors: ['#6b7280', '#4b5563'] }
    ]
  }

  res.json({
    templates: templates[industry] || templates.business,
    industry
  })
})

// Generate AI business card as SVG vector via Gemini text model
router.post('/generate-card-svg', async (req, res) => {
  try {
    const { cardData, options } = req.body || {}
    const genAI = req.app.locals.genAI

    if (!cardData || !cardData.name || !cardData.company) {
      return res.status(400).json({ error: 'cardData.name and cardData.company are required' })
    }

    const svg = await generateCardSVG(genAI, cardData, options || {})
    return res.json({ success: true, svg })
  } catch (error) {
    console.error('Error generating card SVG:', error)
    res.status(500).json({ error: 'Failed to generate card SVG', details: error.message })
  }
})

// Generate AI business card as raster image (PNG/JPG) via Google Image provider
router.post('/generate-card-image', async (req, res) => {
  try {
    const { cardData, industry, size, mode } = req.body || {}
    const genAI = req.app.locals.genAI

    // Validation rules:
    // - Stability-only mode can run without cardData (user may supply a prompt instead)
    // - Combined mode requires cardData with name/company so we can craft a detailed prompt
    // - Default behavior (no mode) requires cardData
    if (mode === 'combined') {
      if (!cardData || !cardData.name || !cardData.company) {
        return res.status(400).json({ error: 'cardData.name and cardData.company are required for combined generation' })
      }
    } else if (mode !== 'stability') {
      if (!cardData || !cardData.name || !cardData.company) {
        return res.status(400).json({ error: 'cardData.name and cardData.company are required' })
      }
    }

    // If a Python ML service is configured, proxy the request and request both
    // Stability (platform) and the existing generate/logo endpoint so the frontend
    // can show both outputs for comparison.
    const PY_ML_URL = process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL || null
    if (PY_ML_URL) {
        try {
    const width = (size && size.width) || 1050
    const height = (size && size.height) || 600

          // Negative prompt to strongly avoid mockups/perspective/stacked cards and multiple-card layouts
          const negativePrompt = (req.body && req.body.negative_prompt) || 'no mockup, no product mockup, no perspective, no stacked cards, no stack, no multiple cards, no depth, no foreshortening, no angled card, no tilt, no isometric, no heavy shadows, no cast shadows, no reflections, no metallic, no gloss, no emboss, no deboss, no glass, no bokeh, no people, no faces, no other brand logos, no watermarks, no busy backgrounds, no photography — only flat vector-style artwork and typography; single front-facing card centered, no perspective'
          // exportFriendly request-wide flag (affects steps/guidance/postprocess)
          // Force exportFriendly to true for all card generations to prioritize print-ready, flat output
          const exportFriendly = true

          // Always run the refine-loop automatically with export-friendly defaults (improves legibility)
          // Construct refine-loop payload using either provided prompt or crafted prompt from cardData
          {
            const prompt = (req.body && req.body.prompt && req.body.prompt.toString().trim().length) ? req.body.prompt : `Flat, print-ready, front-facing business card design for ${cardData.name} (${cardData.title || ''}) at ${cardData.company}. Produce a flat, vector-style layout suitable for export.`
            const refinePayload = {
              prompt,
              negative_prompt: negativePrompt,
              width,
              height,
              // enforce export-friendly targets
              steps: (req.body && req.body.steps) || 60,
              guidance_scale: (req.body && req.body.guidance_scale) || 16.0,
              target_ocr_score: (req.body && req.body.refineTargetOCR) || (req.body && req.body.target_ocr_score) || 20,
              max_iters: (req.body && req.body.maxRefineIters) || (req.body && req.body.max_iters) || 3,
              postprocess_sr: req.body && req.body.postprocess_sr !== undefined ? req.body.postprocess_sr : true,
              postprocess_sr_mode: (req.body && req.body.postprocess_sr_mode) || 'hf',
              exportFriendly: true
            }
            // attach last logo if requested
            if (req.body && req.body.useLastLogo) {
              try {
                const l = getAndClearLastLogo(req.requestId)
                if (l) refinePayload.init_imageBase64 = l
              } catch (_) {}
            }

            const refineJson = await forwardToPython('generate/refine-loop', refinePayload, { req })
            // debug: log concise refine response summary so we can see if images are present
            try {
              const imgCount = (refineJson && Array.isArray(refineJson.images)) ? refineJson.images.length : ((refineJson && refineJson.candidates) ? refineJson.candidates.filter(c=>c && c.result_image).length : 0)
              console.debug(`[refine-loop] images=${imgCount} best=${refineJson && refineJson.best ? 'yes' : 'no'}`)
            } catch (e) {}
            // If export-friendly and we asked the model to leave text area blank, compose programmatic text overlay
            try {
              const preferProgrammatic = req.body && (req.body.prefer_background_only || (req.body.prompt && req.body.prompt.toString().toLowerCase().includes('do not render any readable text')))
              const imagesArr = (refineJson && Array.isArray(refineJson.images)) ? refineJson.images : (refineJson && refineJson.candidates ? refineJson.candidates.map(c=>c.result_image).filter(Boolean) : [])
              if (preferProgrammatic && imagesArr && imagesArr.length > 0) {
                // use first image as background and overlay provided cardData
                const bg = imagesArr[0]
                const final = await overlayTextOnImage(bg, cardData || {}, { width: refinePayload.width, height: refinePayload.height })
                return res.json({ success: true, images: [final], details: { source: 'composed', base: 'refine-loop' } })
              }
            } catch (e) {
              console.warn('Programmatic overlay failed, returning original refine response', e)
            }
            // forward refine-loop response directly to client
            return res.json(refineJson)
          }

        // If client requested Stability-only generation with a custom prompt
        if (req.body && req.body.mode === 'stability') {
          const usePrompt = (req.body.prompt && req.body.prompt.toString().trim().length) ? req.body.prompt : `Flat, print-ready, front-facing business card design for ${cardData.name} (${cardData.title || ''}) at ${cardData.company}. Produce a flat, vector-style layout (landscape) suitable for 300 DPI print with correct safe margins and bleed. Strictly avoid 3D mockups, perspective, skew, heavy shadows, reflections, metallic effects, or busy photographic backgrounds; use a plain neutral background. Use CMYK-friendly colors and high-contrast palettes. Typography should be clean, legible sans-serif (e.g., Inter, Helvetica, Roboto); render text exactly as provided and avoid AI-text artifacts, misspellings, or extra glyphs. Place logo clearly, preserve aspect ratio, and prefer single-color or two-color vector styles suitable for printing. No people, faces, other brands, watermarks, or noisy textures.`
          // enforce min dims and append legibility instruction
          const ensureCardDefaults = (p) => {
            const out = Object.assign({}, p)
            const minW = 1024
            const minH = 640
            let w = out.width || minW
            let h = out.height || minH
            if (w < minW || h < minH) {
              const scaleX = minW / w
              const scaleY = minH / h
              const scale = Math.max(scaleX, scaleY)
              w = Math.ceil(w * scale)
              h = Math.ceil(h * scale)
            }
            out.width = w
            out.height = h
            const instr = ' Flat, front-facing layout: no 3D mockups, no perspective or skew, no heavy shadows or reflections; plain neutral background; high-contrast, CMYK-friendly colors; sharp, legible sans-serif typography with large readable name and contact text; render text exactly as provided and avoid AI-text artifacts, misspellings, or random glyphs; flat vector-style logo (single-color or two-color), no text inside logo except initials; avoid photoreal textures or metallic effects that reduce legibility.'
            if (out.prompt && typeof out.prompt === 'string') {
              if (!out.prompt.toLowerCase().includes('legible') && !out.prompt.includes('no random glyphs')) {
                out.prompt = out.prompt.trim() + ' ' + instr
              }
            }
            // force export-friendly behavior
            const localExportFriendly = true
            out.postprocess = out.postprocess !== undefined ? out.postprocess : true
            out.postprocess_sr = out.postprocess_sr !== undefined ? out.postprocess_sr : true
            // enforce stronger defaults for export-friendly outputs
            out.postprocess_upscale = Math.max(out.postprocess_upscale || 0, 2.5)
            out.postprocess_unsharp_radius = Math.max(out.postprocess_unsharp_radius || 0, 1.4)
            out.postprocess_unsharp_percent = Math.max(out.postprocess_unsharp_percent || 0, 200.0)
            out.postprocess_unsharp_threshold = out.postprocess_unsharp_threshold || 3
            out.postprocess_autocontrast = out.postprocess_autocontrast !== undefined ? out.postprocess_autocontrast : true
            out.negative_prompt = out.negative_prompt || negativePrompt
            out.steps = Math.max(out.steps || 0, 60)
            out.guidance_scale = Math.max(out.guidance_scale || 0, 16.0)
            return out
          }

          const stabilityPayload = ensureCardDefaults({ prompt: usePrompt, width, height, steps: 28, cfg_scale: 8.0, samples: 1 })
          // allow client to request using the last generated logo (attach and clear)
          if (req.body && req.body.useLastLogo) {
            try {
              const l = getAndClearLastLogo(req.requestId)
              if (l) stabilityPayload.logoUrl = l
            } catch (_) {}
          }
          // forward via helper which appends a default negative_prompt
          const stabJson = await forwardToPython('generate/stability', stabilityPayload, { req })
          const images = []
          if (stabJson && Array.isArray(stabJson.images)) stabJson.images.forEach(d => images.push({ source: 'stability', dataUrl: d }))
          else if (stabJson && stabJson.images && typeof stabJson.images === 'string') images.push({ source: 'stability', dataUrl: stabJson.images })
          if (images.length === 0) return res.status(502).json({ error: 'Stability returned no images', details: stabJson })

          // Automatic refine-loop: score first image and run refine-loop if OCR below threshold
          try {
            const primary = images[0]
            const scoreRes = await forwardToPython('score', { imageBase64: primary.dataUrl }, { req })
            const score = (scoreRes && typeof scoreRes.score === 'number') ? scoreRes.score : (scoreRes && parseInt(scoreRes.score) || 0)
            const minOK = (req.body && req.body.minOCR) || 20
            if (score < minOK) {
              // call refine-loop with sensible defaults
              const refinePayload = {
                prompt: req.body.prompt || `Improve legibility for business card for ${cardData.name} at ${cardData.company}`,
                negative_prompt: negativePrompt,
                width: width,
                height: height,
                steps: 60,
                guidance_scale: 16.0,
                target_ocr_score: minOK,
                max_iters: 3,
                init_imageBase64: primary.dataUrl,
                postprocess_sr: true,
                postprocess_sr_mode: 'hf',
                exportFriendly: true
              }
              const refined = await forwardToPython('generate/refine-loop', refinePayload, { req })
              return res.json(refined)
            }
          } catch (e) {
            console.warn('Auto refine-loop failed:', e)
          }

          return res.json({ success: true, images })
        }

        // Combined mode: craft a Gemini prompt server-side (if available) and request both stability and logo generator
        if (req.body && req.body.mode === 'combined') {
          let craftedPrompt = `High-quality, flat, print-ready business card design (no photoreal mockups) for ${cardData.name} (${cardData.title || ''}) at ${cardData.company}. Include company name or initials as a visible branding element. Style: modern, print-ready, vector-friendly, strong typographic hierarchy, brand color palette, ample negative space. Deliver: 1) flat front-facing card layout suitable for export (svg/png), 2) optional neutral mockup (flat front-facing, no perspective) for presentation only. Avoid people, faces, logos of other brands, watermarks, or busy photographic backgrounds. Ensure typography is legible and the logo/text scale is appropriate for small print.`
          try {
            if (genAI) {
              const designs = await generateCardDesign(genAI, cardData, industry || 'business', 1)
              if (Array.isArray(designs) && designs.length > 0) {
                const d = designs[0]
                const extras = []
                if (d.palette) extras.push(`colors: ${d.palette.primary || ''} / ${d.palette.secondary || ''}`)
                if (d.typography) extras.push(`font: ${d.typography.heading || d.typography.body || ''}`)
                if (d.layout && d.layout.elements) extras.push(`layout intent: ${Object.keys(d.layout.elements).join(', ')}`)
                craftedPrompt = `${craftedPrompt} Additional style hints: ${extras.join('; ')}.`
              }
            }
          } catch (gpErr) {
            console.warn('Gemini prompt craft failed, using fallback prompt', gpErr)
          }

          const ensureCardDefaults = (p) => {
            const out = Object.assign({}, p)
            const minW = 1024
            const minH = 640
            let w = out.width || minW
            let h = out.height || minH
            if (w < minW || h < minH) {
              const scaleX = minW / w
              const scaleY = minH / h
              const scale = Math.max(scaleX, scaleY)
              w = Math.ceil(w * scale)
              h = Math.ceil(h * scale)
            }
            out.width = w
            out.height = h
            const instr = ' Flat, front-facing layout: no 3D mockups, no perspective or skew, no heavy shadows or reflections; plain neutral background; high-contrast, CMYK-friendly colors; sharp, legible sans-serif typography with large readable name and contact text; render text exactly as provided and avoid AI-text artifacts, misspellings, or random glyphs; flat vector-style logo (single-color or two-color), no text inside logo except initials; avoid photoreal textures or metallic effects that reduce legibility.'
            if (out.prompt && typeof out.prompt === 'string') {
              if (!out.prompt.toLowerCase().includes('legible') && !out.prompt.includes('no random glyphs')) {
                out.prompt = out.prompt.trim() + ' ' + instr
              }
            }
            // force export-friendly behavior for combined branch
            out.postprocess = out.postprocess !== undefined ? out.postprocess : true
            out.postprocess_sr = out.postprocess_sr !== undefined ? out.postprocess_sr : true
            out.postprocess_upscale = Math.max(out.postprocess_upscale || 0, 2.5)
            out.postprocess_unsharp_radius = Math.max(out.postprocess_unsharp_radius || 0, 1.4)
            out.postprocess_unsharp_percent = Math.max(out.postprocess_unsharp_percent || 0, 200.0)
            out.postprocess_unsharp_threshold = out.postprocess_unsharp_threshold || 3
            out.postprocess_autocontrast = out.postprocess_autocontrast !== undefined ? out.postprocess_autocontrast : true
            out.negative_prompt = out.negative_prompt || negativePrompt
            out.steps = Math.max(out.steps || 0, 60)
            out.guidance_scale = Math.max(out.guidance_scale || 0, 16.0)
            return out
          }

          const stabilityPayload = ensureCardDefaults({ prompt: craftedPrompt, width, height, steps: 28, cfg_scale: 8.0, samples: 1 })
          const cardPayload = ensureCardDefaults({ prompt: craftedPrompt, width, height, steps: 28, guidance_scale: 8.5 })
          // allow client to request auto-attach of the last generated logo
          if (req.body && req.body.useLastLogo) {
            try {
              const l = getAndClearLastLogo(req.requestId)
              if (l) {
                stabilityPayload.logoUrl = l
                cardPayload.logoUrl = l
              }
            } catch (_) {}
          }

          // Use helper to forward both requests and ensure negative_prompt appended
          const [stabJson, cardJson] = await Promise.all([
            forwardToPython('generate/stability', stabilityPayload, { req }).catch(e => ({ error: e.message || e.body || e })),
            forwardToPython('generate/card', cardPayload, { req }).catch(e => ({ error: e.message || e.body || e }))
          ])

          const images = []
          const stabilityImages = []
          const hfImages = []

          if (stabJson && Array.isArray(stabJson.images)) stabJson.images.forEach(d => stabilityImages.push({ source: 'stability', dataUrl: d }))
          else if (stabJson && stabJson.images && typeof stabJson.images === 'string') stabilityImages.push({ source: 'stability', dataUrl: stabJson.images })

          if (cardJson && Array.isArray(cardJson.images)) cardJson.images.forEach(d => hfImages.push({ source: 'hf_card', dataUrl: d }))
          else if (cardJson && cardJson.images && typeof cardJson.images === 'string') hfImages.push({ source: 'hf_card', dataUrl: cardJson.images })

          // Prefer showing stability images first, then HF images
          stabilityImages.forEach(i => images.push(i))
          hfImages.forEach(i => images.push(i))

          // If at least one image succeeded, return 200 with available images and diagnostic details.
          if (images.length > 0) {
            // Log if HF failed so we can debug later
            if ((cardJson && cardJson.error)) {
              console.warn('HF/card generation returned an error', { body: cardJson })
            }
            return res.json({ success: true, images, details: { stability: stabJson, card: cardJson } })
          }

          // No images at all from either service — bubble up diagnostic info
          return res.status(502).json({ error: 'Combined generation returned no images', details: { stability: stabJson, card: cardJson } })
        }
      } catch (e) {
        console.error('Error proxying to Python ML service:', e)
        // fall through to fallback
      }
    }

    // Fallback: attempt to call the local aiService which may be a placeholder
    try {
      const imageBase64 = await generateCardImage(genAI, cardData, industry || 'business', size)
      return res.json({ success: true, images: [{ source: 'fallback', dataUrl: `data:image/png;base64,${imageBase64}` }] })
    } catch (innerErr) {
      return res.status(501).json({ error: innerErr.message || 'Image generation not configured' })
    }
  } catch (error) {
    console.error('Error generating card image:', error)
    res.status(500).json({ error: 'Failed to generate card image', details: error.message })
  }
})

export default router