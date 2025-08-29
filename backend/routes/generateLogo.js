import express from 'express'
const router = express.Router()

// POST /api/generateLogo
// Body: { description: string, style?: string, count?: number, width?: number, height?: number }
// Proxies to Python ML service at http://localhost:8000/generate/logo
const getFetch = () => (typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({ default: f }) => f(...args)))

router.post('/', async (req, res) => {
  try {
    const { description, style, count = 1, width = 512, height = 512 } = req.body || {}
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'description (string) is required' })
    }
    const payload = { description, style, count, width, height }
    const f = getFetch()
    const mlUrl = process.env.ML_BASE_URL || 'http://127.0.0.1:8000'
    const r = await f(`${mlUrl}/generate/logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!r.ok) {
      const text = await r.text()
      return res.status(502).json({ error: 'ML service error', status: r.status, details: text })
    }
    const data = await r.json()
    // data: { images: [dataUrlPng] }
    return res.json(data)
  } catch (err) {
    console.error('generateLogo proxy error:', err)
    return res.status(500).json({ error: 'Internal error', message: String(err && err.message || err) })
  }
})

export default router
