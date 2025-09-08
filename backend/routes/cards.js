import express from 'express'
import fetch from 'node-fetch'
import { forwardToPython } from '../services/pythonProxy.js'
import { getAndClearLastLogo } from '../services/logoStore.js'
import { generateCardDesign, generateCardImage, generateCardSVG } from '../services/aiService.js'

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

        // If client requested Stability-only generation with a custom prompt
        if (req.body && req.body.mode === 'stability') {
          const usePrompt = (req.body.prompt && req.body.prompt.toString().trim().length) ? req.body.prompt : `Photorealistic, print-ready business card mockup for ${cardData.name} (${cardData.title || ''}) at ${cardData.company}. Produce a front-facing, flat card layout (landscape) with correct safe margins and bleed, high-resolution suitable for 300 DPI print. Style: clean and professional with a strong typographic hierarchy (name prominent, title secondary, company/logo clearly visible), balanced spacing, and subtle paper texture. Use CMYK-friendly colors and vector-friendly logo placement. If a logo is provided, place it consistently (top-left or centered) keeping aspect ratio and clear spacing. Provide one full mockup and one close-up crop showing legible text. Prefer real fonts like Helvetica/Inter/Roboto for modern, or Garamond/Times for classic. Ensure text is sharp and readable, avoid AI text artifacts, misspellings, extra characters, or distorted typography. Use soft studio lighting, realistic shadows, and a neutral background suitable for product catalogs. Avoid people, faces, photos, busy scenes, watermarks, other brand logos, and noisy textures.`
          const stabilityPayload = { prompt: usePrompt, width, height, steps: 28, cfg_scale: 8.0, samples: 1 }
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
          return res.json({ success: true, images })
        }

        // Combined mode: craft a Gemini prompt server-side (if available) and request both stability and logo generator
        if (req.body && req.body.mode === 'combined') {
          let craftedPrompt = `High-quality business card design and photoreal mockup for ${cardData.name} (${cardData.title || ''}) at ${cardData.company}. Include company name or initials as a visible branding element. Style: modern, print-ready, vector-friendly, strong typographic hierarchy, brand color palette, ample negative space. Deliver: 1) flat front-facing card layout suitable for export (svg/png), 2) optional photoreal mockup on neutral background with soft studio lighting and subtle paper texture. Avoid people, faces, logos of other brands, watermarks, or busy photographic backgrounds. Ensure typography is legible and the logo/text scale is appropriate for small print.`
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

          const stabilityPayload = { prompt: craftedPrompt, width, height, steps: 28, cfg_scale: 8.0, samples: 1 }
          const cardPayload = { prompt: craftedPrompt, width, height, steps: 28, guidance_scale: 8.5 }
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