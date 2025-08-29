import { useState } from 'react'

const TextToImageGenerator = () => {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [settings, setSettings] = useState({
    count: 2,
    width: 512,
    height: 512,
    steps: 20,
    guidance_scale: 7.5
  })
  const [generatedImages, setGeneratedImages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const generateImages = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError('')
    
    try {
      const response = await fetch('/api/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          count: settings.count,
          width: settings.width,
          height: settings.height,
          steps: settings.steps,
          guidance_scale: settings.guidance_scale
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setGeneratedImages(data.images || [])
    } catch (err) {
      console.error('Text-to-image generation failed:', err)
      setError(`Generation failed: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadImage = (imageDataUrl, index) => {
    const link = document.createElement('a')
    link.href = imageDataUrl
    link.download = `generated-image-${index + 1}.png`
    link.click()
  }

  return (
    <div className="text-to-image-generator">
      <h2>🎨 Text-to-Image Generator</h2>
      
      <div className="generator-form">
        <div className="form-group">
          <label className="form-label">Prompt</label>
          <textarea
            className="input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A beautiful sunset over mountains, digital art, highly detailed..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Negative Prompt (Optional)</label>
          <textarea
            className="input"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="blurry, low quality, distorted..."
            rows={2}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Count</label>
            <select
              className="input"
              value={settings.count}
              onChange={(e) => setSettings(prev => ({ ...prev, count: parseInt(e.target.value) }))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Width</label>
            <select
              className="input"
              value={settings.width}
              onChange={(e) => setSettings(prev => ({ ...prev, width: parseInt(e.target.value) }))}
            >
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={768}>768px</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Height</label>
            <select
              className="input"
              value={settings.height}
              onChange={(e) => setSettings(prev => ({ ...prev, height: parseInt(e.target.value) }))}
            >
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={768}>768px</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Steps</label>
            <select
              className="input"
              value={settings.steps}
              onChange={(e) => setSettings(prev => ({ ...prev, steps: parseInt(e.target.value) }))}
            >
              <option value={10}>10 (Fast)</option>
              <option value={20}>20 (Balanced)</option>
              <option value={30}>30 (Quality)</option>
              <option value={50}>50 (High Quality)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Guidance</label>
            <select
              className="input"
              value={settings.guidance_scale}
              onChange={(e) => setSettings(prev => ({ ...prev, guidance_scale: parseFloat(e.target.value) }))}
            >
              <option value={5.0}>5.0 (Creative)</option>
              <option value={7.5}>7.5 (Balanced)</option>
              <option value={10.0}>10.0 (Precise)</option>
              <option value={15.0}>15.0 (Very Precise)</option>
            </select>
          </div>
        </div>

        <button
          onClick={generateImages}
          disabled={isGenerating || !prompt.trim()}
          className={`btn ${isGenerating ? 'btn-secondary' : 'btn-primary'}`}
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          {isGenerating ? '🎨 Generating Images...' : '✨ Generate Images'}
        </button>

        {error && (
          <div className="error-message" style={{ 
            color: 'var(--color-error)', 
            background: 'var(--color-error-bg)', 
            padding: '0.75rem', 
            borderRadius: '0.5rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}
      </div>

      {generatedImages.length > 0 && (
        <div className="generated-images">
          <h3>Generated Images</h3>
          <div className="images-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem' 
          }}>
            {generatedImages.map((imageDataUrl, index) => (
              <div key={index} className="image-card" style={{
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                background: 'var(--bg-secondary)'
              }}>
                <img
                  src={imageDataUrl}
                  alt={`Generated ${index + 1}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                />
                <div style={{ padding: '0.75rem' }}>
                  <button
                    onClick={() => downloadImage(imageDataUrl, index)}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                  >
                    📥 Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TextToImageGenerator
