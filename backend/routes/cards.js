import express from 'express'
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

    try {
      const imageBase64 = await generateCardImage(genAI, cardData, industry || 'business', size)
      return res.json({ success: true, imageBase64 })
    } catch (innerErr) {
      // If not configured, surface a helpful message
      return res.status(501).json({ error: innerErr.message || 'Image generation not configured' })
    }
  } catch (error) {
    console.error('Error generating card image:', error)
    res.status(500).json({ error: 'Failed to generate card image', details: error.message })
  }
})

export default router