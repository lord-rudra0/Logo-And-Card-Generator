import express from 'express'
import fetch from 'node-fetch'
import { recommendStyle, checkAccessibility, ocrFromImageBase64 } from '../services/mlService.js'

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

export default router
