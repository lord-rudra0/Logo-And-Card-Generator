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
