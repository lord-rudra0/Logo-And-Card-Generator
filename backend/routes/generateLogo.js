import express from 'express'
import { forwardToPython } from '../services/pythonProxy.js'
const router = express.Router()

// POST /api/generateLogo
// Body: { description: string, style?: string, count?: number, width?: number, height?: number }
// Proxies to Python ML service at http://localhost:8000/generate/logo
const getFetch = () => (typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({ default: f }) => f(...args)))

router.post('/', async (req, res) => {
  console.log('\n=== LOGO GENERATION REQUEST STARTED ===')
  console.log('🎨 Step 1: Received request at /api/generateLogo')
  console.log('📝 Raw request body:', JSON.stringify(req.body, null, 2))
  
  try {
    const { description, style, count = 1, width = 512, height = 512 } = req.body || {}
    
    console.log('🔍 Step 2: Extracted parameters:')
    console.log('   - Description:', description)
    console.log('   - Style:', style)
    console.log('   - Count:', count)
    console.log('   - Dimensions:', `${width}x${height}`)
    
    if (!description || typeof description !== 'string') {
      console.log('❌ Step 3: Validation failed - missing or invalid description')
      return res.status(400).json({ error: 'description (string) is required' })
    }
    
    console.log('✅ Step 3: Validation passed')
    const payload = { description, style, count, width, height }
    
    console.log('📦 Step 4: Prepared payload for ML service:')
    console.log(JSON.stringify(payload, null, 2))
    
  console.log('🚀 Step 5: Forwarding to Python ML service (with enforced negative_prompt)')
  const data = await forwardToPython('generate/logo', payload, { req })
    
    console.log('📊 Step 8: Response data:')
    console.log('   - Number of images:', data.images ? data.images.length : 0)
    if (data.images && data.images[0]) {
      const firstImageSize = data.images[0].length
      console.log('   - First image data size:', `${firstImageSize} characters`)
      console.log('   - First image preview:', data.images[0].substring(0, 50) + '...')
    }
    
  console.log('🎉 Step 9: Sending response back to client')
    console.log('=== LOGO GENERATION REQUEST COMPLETED ===\n')
    
    return res.json(data)
  } catch (err) {
    console.log('💥 STEP ERROR: Exception caught in generateLogo route:')
    console.error('   - Error type:', err.constructor.name)
    console.error('   - Error message:', err.message)
    console.error('   - Stack trace:', err.stack)
    console.log('=== LOGO GENERATION REQUEST FAILED ===\n')
    return res.status(500).json({ error: 'Internal error', message: String(err && err.message || err) })
  }
})

export default router
