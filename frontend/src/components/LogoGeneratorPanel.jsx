import { useState } from 'react'
import { generateLogoAPI } from '../utils/mlApi.js'
import { useToast } from '../context/ToastContext'

export default function LogoGeneratorPanel() {
  const [prompt, setPrompt] = useState('A minimal geometric logo for a tech startup named "Nova"')
  const toast = useToast()
  const [isWorking, setIsWorking] = useState(false)
  const [images, setImages] = useState([])
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [progress, setProgress] = useState(0)

  const generate = async () => {
    setError(null)
    try {
      toast.info('Queued — generating...')
      setIsWorking(true)

      // Submit as async job
      const createRes = await fetch(`/api/ml/generate-logo?async=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, width: 512, height: 512 })
      })
      const createJson = await createRes.json()
      if (!createRes.ok) throw new Error((createJson && (createJson.error || createJson.message)) || 'Failed to create job')
      const jobId = createJson.jobId
      toast.info('Job started: ' + jobId)

      // poll
      let lastProgress = 0
      const poll = async () => {
        try {
          const s = await fetch(`/api/ml/job/${jobId}`)
          const j = await s.json()
          if (!s.ok) throw new Error((j && (j.error || j.message)) || 'job status failed')
          const job = j.job
          if (job.progress && job.progress !== lastProgress) {
            lastProgress = job.progress
          }
          // update a light UI progress area
          setProgress(job.progress || 0)
          if (job.status === 'done') {
            toast.success('Generation complete')
            const imgs = (job.result && job.result.images) || []
            setImages(imgs)
            setSelected(null)
            setProgress(100)
            return
          }
          if (job.status === 'failed') {
            toast.error('Job failed: ' + (job.error || 'unknown'))
            setError(job.error || 'Job failed')
            return
          }
          // continue polling
          setTimeout(poll, 1200)
        } catch (err) {
          console.error('poll error', err)
          toast.error('Job polling error')
        }
      }
      setProgress(5)
      setTimeout(poll, 800)
    } catch (err) {
      console.error('Generate failed', err)
  setError(err.message || String(err))
  toast.error('Generation failed: ' + (err.message || String(err)))
    } finally {
      setIsWorking(false)
    }
  }

  const convertToSvg = async (imgUrl) => {
    // load imagetracer from CDN dynamically
    try {
      setError(null)
      if (typeof window.ImageTracer === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imgUrl
      await new Promise((r, rej) => { img.onload = r; img.onerror = rej })
      const svgString = window.ImageTracer.imageToSVG(img)
      // open SVG in new tab
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) {
      console.error('SVG conversion failed', e)
  setError('SVG conversion failed: ' + (e.message || e))
  toast.error('SVG conversion failed')
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h4>AI Logo Generator</h4>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={generate} disabled={isWorking}>{isWorking ? 'Generating...' : 'Generate'}</button>
        <button className="btn btn-secondary" onClick={() => setPrompt('A minimal geometric logo for a tech startup named "Nova"')}>Reset</button>
      </div>

      {error && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: '#fee2e2', color: '#7f1d1d' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {progress > 0 && progress < 100 && (
          <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: progress + '%', height: '100%', background: 'linear-gradient(90deg,#60a5fa,#06b6d4)' }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
          {isWorking ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 120, borderRadius: 6, background: 'linear-gradient(90deg, #f3f4f6, #e5e7eb)', animation: 'pulse 1.5s infinite' }} />
            ))
          ) : (
            images.map((it, i) => (
              <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden', background: 'white', position: 'relative' }}>
                {/* eslint-disable-next-line */}
                <img src={it.url} alt={`gen-${i}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} onClick={() => setSelected(it)} />
                <div style={{ padding: 8, display: 'flex', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{it.cached ? 'Cached' : 'Raw'}</div>
                  <button className="btn btn-secondary" onClick={() => convertToSvg(it.url)} style={{ fontSize: 12 }}>Convert to SVG</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 12 }}>
          <h5>Selected Preview</h5>
          <img src={selected.url} alt="selected" style={{ width: 200, height: 200, objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: 6 }} />
        </div>
      )}
    </div>
  )
}
