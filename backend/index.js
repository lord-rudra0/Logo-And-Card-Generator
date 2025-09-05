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
const PORT = process.env.PORT || 5000
const ML_SERVICE_URL = process.env.PY_IMAGE_SERVICE_URL || 'http://localhost:8000'

// No external ML provider initialized; pass null to services that accept a genAI param
const genAI = null

// Middleware
app.use(cors())
app.use(express.json())

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
  
  console.log('ℹ️ ML features are disabled in this build')
})