import express from 'express'
const router = express.Router()

// POST /api/text-to-image
// Body: { prompt: string, negative_prompt?: string, count?: number, width?: number, height?: number, steps?: number, guidance_scale?: number }
// Proxies to Python ML service at http://localhost:8000/generate/text-to-image
const getFetch = () => (typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({ default: f }) => f(...args)))

router.post('/', async (req, res) => {
  console.log('\n=== TEXT-TO-IMAGE REQUEST STARTED ===')
  console.log('🔥 Step 1: Received request at /api/text-to-image')
  console.log('📝 Raw request body:', JSON.stringify(req.body, null, 2))
  
  try {
    const { 
      prompt, 
      negative_prompt, 
      count = 1, 
      width = 512, 
      height = 512, 
      steps = 20, 
      guidance_scale = 7.5 
    } = req.body || {}
    
    console.log('🔍 Step 2: Extracted parameters:')
    console.log('   - Prompt:', prompt)
    console.log('   - Negative prompt:', negative_prompt)
    console.log('   - Count:', count)
    console.log('   - Dimensions:', `${width}x${height}`)
    console.log('   - Steps:', steps)
    console.log('   - Guidance scale:', guidance_scale)
    
    if (!prompt || typeof prompt !== 'string') {
      console.log('❌ Step 3: Validation failed - missing or invalid prompt')
      return res.status(400).json({ error: 'prompt (string) is required' })
    }
    
    console.log('✅ Step 3: Validation passed')
    
    const payload = { 
      prompt, 
      negative_prompt, 
      count, 
      width, 
      height, 
      steps, 
      guidance_scale 
    }
    
    console.log('📦 Step 4: Prepared payload for ML service:')
    console.log(JSON.stringify(payload, null, 2))
    
    const f = getFetch()
    const mlUrl = process.env.PY_IMAGE_SERVICE_URL || 'http://localhost:8000'
    console.log(`🚀 Step 5: Sending request to ML service at ${mlUrl}/generate/text-to-image`)
    
    const startTime = Date.now()
    const r = await f(`${mlUrl}/generate/text-to-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    const requestTime = Date.now() - startTime
    console.log(`⏱️  Step 6: ML service responded in ${requestTime}ms with status ${r.status}`)
    
    if (!r.ok) {
      const text = await r.text()
      console.log('❌ Step 7: ML service error:')
      console.log('   - Status:', r.status)
      console.log('   - Response:', text)
      return res.status(502).json({ error: 'ML service error', status: r.status, details: text })
    }
    
    console.log('✅ Step 7: ML service success, parsing response...')
    const data = await r.json()
    
    console.log('📊 Step 8: Response data:')
    console.log('   - Number of images:', data.images ? data.images.length : 0)
    if (data.images && data.images[0]) {
      const firstImageSize = data.images[0].length
      console.log('   - First image data size:', `${firstImageSize} characters`)
      console.log('   - First image preview:', data.images[0].substring(0, 50) + '...')
    }
    
    console.log('🎉 Step 9: Sending response back to client')
    console.log('=== TEXT-TO-IMAGE REQUEST COMPLETED ===\n')
    
    return res.json(data)
  } catch (err) {
    console.log('💥 STEP ERROR: Exception caught in textToImage route:')
    console.error('   - Error type:', err.constructor.name)
    console.error('   - Error message:', err.message)
    console.error('   - Stack trace:', err.stack)
    console.log('=== TEXT-TO-IMAGE REQUEST FAILED ===\n')
    return res.status(500).json({ error: 'Internal error', message: String(err && err.message || err) })
  }
})

export default router
