import express from 'express'
import { generateLogoDesign, generateLogoSVG } from '../services/aiService.js'
import { storeCachedFile, storeDataUrl } from '../services/imageCache.js'

const router = express.Router()

// Generate AI-powered logo designs
router.post('/generate-logo-design', async (req, res) => {
  try {
    const logoData = req.body
    const genAI = req.app.locals.genAI

    if (!logoData.companyName) {
      return res.status(400).json({ 
        error: 'Company name is required for logo generation' 
      })
    }

    const designs = await generateLogoDesign(genAI, logoData)
    
    res.json({
      success: true,
      designs,
      message: 'Logo designs generated successfully'
    })
  } catch (error) {
    console.error('Error generating logo design:', error)
    res.status(500).json({ 
      error: 'Failed to generate logo design',
      details: error.message
    })
  }
})

// Generate AI-powered logo SVG
router.post('/generate-logo-svg', async (req, res) => {
  try {
    const { logoData, options } = req.body || {}
    const genAI = req.app.locals.genAI

    if (!logoData || !logoData.companyName) {
      return res.status(400).json({ error: 'logoData.companyName is required' })
    }

    const svg = await generateLogoSVG(genAI, logoData, options || {})
    res.json({ success: true, svg })
  } catch (error) {
    console.error('Error generating logo SVG:', error)
    res.status(500).json({ error: 'Failed to generate logo SVG', details: error.message })
  }
})

// Get industry-specific logo suggestions
router.get('/logo-suggestions/:industry', (req, res) => {
  const { industry } = req.params
  
  const suggestions = {
    technology: {
      icons: ['💻', '🚀', '⚡', '🔧', '⚙️', '💡'],
      colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'],
      styles: ['modern', 'tech', 'minimalist']
    },
    healthcare: {
      icons: ['🏥', '💊', '🩺', '❤️', '🌿', '💉'],
      colors: ['#06b6d4', '#10b981', '#3b82f6', '#84cc16'],
      styles: ['corporate', 'minimalist', 'modern']
    },
    creative: {
      icons: ['🎨', '✨', '🎭', '🖌️', '🌈', '💫'],
      colors: ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'],
      styles: ['creative', 'artistic', 'modern']
    },
    finance: {
      icons: ['💼', '📊', '💰', '🏦', '📈', '💎'],
      colors: ['#1f2937', '#3b82f6', '#059669', '#d97706'],
      styles: ['corporate', 'minimalist', 'modern']
    }
  }

  res.json({
    suggestions: suggestions[industry] || suggestions.technology,
    industry
  })
})

export default router

// Store a logo permanently (from cache filename or a data URL)
router.post('/store-logo', async (req, res) => {
  try {
    const { source, filename, dataUrl } = req.body || {}
    if (!source && !dataUrl && !filename) return res.status(400).json({ success: false, error: 'source or dataUrl or filename required' })
    let url
    if (filename) {
      // store a cached file by filename
      url = storeCachedFile(filename)
    } else if (dataUrl) {
      url = storeDataUrl(dataUrl, filename)
    } else if (typeof source === 'string' && source.startsWith('/cache/')) {
      // extract filename
      const f = source.split('/').pop()
      url = storeCachedFile(f)
    } else {
      return res.status(400).json({ success: false, error: 'unrecognized source format' })
    }
    res.json({ success: true, url })
  } catch (err) {
    console.error('store-logo error', err)
    res.status(500).json({ success: false, error: String(err && err.message) })
  }
})
