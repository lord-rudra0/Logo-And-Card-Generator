import express from 'express'
import fetch from 'node-fetch'
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
    const { cardData, industry, size } = req.body || {}
    const genAI = req.app.locals.genAI

    if (!cardData || !cardData.name || !cardData.company) {
      return res.status(400).json({ error: 'cardData.name and cardData.company are required' })
    }

    // If a Python ML service is configured, proxy the request and request both
    // Stability (platform) and the existing generate/logo endpoint so the frontend
    // can show both outputs for comparison.
    const PY_ML_URL = process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL || null
    if (PY_ML_URL) {
      try {
        const prompt = `A high-quality business card layout for ${cardData.name} at ${cardData.company}. Title: ${cardData.title || ''}. Contact: ${cardData.email || ''} ${cardData.phone || ''}. Style: clean, minimal, vector-friendly, centered composition. Include company name or initials as a visible element.`
        const width = (size && size.width) || 1050
        const height = (size && size.height) || 600

        const stabilityPayload = { prompt, width, height, steps: 20, cfg_scale: 7.5, samples: 1 }
        const logoPayload = { prompt, width, height, steps: 20, guidance_scale: 7.5 }

        const stabilityUrl = `${PY_ML_URL.replace(/\/$/, '')}/generate/stability`
        const logoUrl = `${PY_ML_URL.replace(/\/$/, '')}/generate/logo`

        const [stabRes, logoRes] = await Promise.all([
          fetch(stabilityUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stabilityPayload) }),
          fetch(logoUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logoPayload) })
        ])

        const stabJson = stabRes.ok ? await stabRes.json() : { error: await stabRes.text(), ok: false }
        const logoJson = logoRes.ok ? await logoRes.json() : { error: await logoRes.text(), ok: false }

        // Normalize images into array of { source, dataUrl }
        const images = []
        if (stabJson && Array.isArray(stabJson.images)) {
          stabJson.images.forEach((d) => images.push({ source: 'stability', dataUrl: d }))
        } else if (stabJson && stabJson.images && typeof stabJson.images === 'string') {
          images.push({ source: 'stability', dataUrl: stabJson.images })
        }
        if (logoJson && Array.isArray(logoJson.images)) {
          logoJson.images.forEach((d) => images.push({ source: 'hf_or_logo', dataUrl: d }))
        } else if (logoJson && logoJson.images && typeof logoJson.images === 'string') {
          images.push({ source: 'hf_or_logo', dataUrl: logoJson.images })
        }

        // If nothing returned, fallback to aiService (non-ML) placeholder or error
        if (images.length === 0) {
          return res.status(502).json({ error: 'ML service returned no images', details: { stability: stabJson, logo: logoJson } })
        }

        return res.json({ success: true, images })
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