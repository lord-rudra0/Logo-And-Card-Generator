import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
// ML support removed: lightweight fallback service in place
import cardRoutes from './routes/cards.js'
import logoRoutes from './routes/logos.js'
import exportRoutes from './routes/export.js'
import mlRoutes from './routes/ml.js'
// generateLogo and textToImage routes removed

dotenv.config()

const app = express()
const PORT = process.env.BACKEND_PORT || process.env.PORT || 5000
const ML_SERVICE_URL = process.env.PY_IMAGE_SERVICE_URL || 'http://localhost:8000'

// No external ML provider initialized; pass null to services that accept a genAI param
const genAI = null

// Middleware
app.use(cors())
app.use(express.json())
// serve cached generated images (store is under backend/services/cache)
import path from 'path'
import fs from 'fs'
// Resolve cache directory relative to this file so serving works regardless of
// the working directory used to start the process.
const __dirname = path.dirname(new URL(import.meta.url).pathname)
const CACHE_SERVE_DIR = path.join(__dirname, 'services', 'cache')
app.use('/cache', express.static(CACHE_SERVE_DIR))
// serve stored logos
const STORED_DIR = path.join(__dirname, '..', 'stored_logos')
if (!fs.existsSync(STORED_DIR)) fs.mkdirSync(STORED_DIR, { recursive: true })
app.use('/stored', express.static(STORED_DIR))

// Make genAI available to routes
app.locals.genAI = genAI

// Routes
app.use('/api', cardRoutes)
app.use('/api', logoRoutes)
app.use('/api', exportRoutes)
app.use('/api/ml', mlRoutes)
// Note: ML proxy routes removed

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CardGEN API is running. ML features removed.' })
})

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 API available at http://localhost:${PORT}/api`)
  // Probe ML service URL to show connected status when available
  try {
    const fetch = (await import('node-fetch')).default
    const res = await fetch(ML_SERVICE_URL + '/health', { method: 'GET', timeout: 2000 }).catch(() => null)
    if (res && res.ok) {
      console.log(`🔗 ML service connected at ${ML_SERVICE_URL}`)
    } else {
      console.log('ℹ️ ML features are disabled in this build or ML service not reachable (set PY_IMAGE_SERVICE_URL to enable)')
    }
  } catch (e) {
    console.log('ℹ️ ML features are disabled in this build or ML service not reachable (set PY_IMAGE_SERVICE_URL to enable)')
  }
})