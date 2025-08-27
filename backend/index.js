import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import cardRoutes from './routes/cards.js'
import logoRoutes from './routes/logos.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Card Creator API is running!' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 API available at http://localhost:${PORT}/api`)
})