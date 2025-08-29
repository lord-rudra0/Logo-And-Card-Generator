import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import cardRoutes from './routes/cards.js'
import logoRoutes from './routes/logos.js'
import exportRoutes from './routes/export.js'
import generateLogoRoutes from './routes/generateLogo.js'
import textToImageRoutes from './routes/textToImage.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const ML_SERVICE_URL = process.env.PY_IMAGE_SERVICE_URL || 'http://localhost:8000'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Middleware
app.use(cors())
app.use(express.json())

// Make genAI available to routes
app.locals.genAI = genAI

// Routes
app.use('/api', cardRoutes)
app.use('/api', logoRoutes)
app.use('/api', exportRoutes)
app.use('/api/generateLogo', generateLogoRoutes)
app.use('/api/text-to-image', textToImageRoutes)

// Function to check ML service connection
async function checkMLServiceConnection() {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/openapi.json`)
    if (response.ok) {
      console.log(`✅ ML Service connected at ${ML_SERVICE_URL}`)
      return true
    } else {
      console.log(`❌ ML Service unreachable at ${ML_SERVICE_URL} (Status: ${response.status})`)
      return false
    }
  } catch (error) {
    console.log(`❌ ML Service connection failed: ${error.message}`)
    return false
  }
}

// Health check endpoint with ML service status
app.get('/api/health', async (req, res) => {
  const mlConnected = await checkMLServiceConnection()
  res.json({ 
    status: 'OK', 
    message: 'AI Card Creator API is running!',
    services: {
      backend: 'connected',
      ml_service: mlConnected ? 'connected' : 'disconnected',
      ml_url: ML_SERVICE_URL
    }
  })
})

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 API available at http://localhost:${PORT}/api`)
  
  // Check ML service connection on startup
  console.log(`🔍 Checking ML service connection...`)
  await checkMLServiceConnection()
})