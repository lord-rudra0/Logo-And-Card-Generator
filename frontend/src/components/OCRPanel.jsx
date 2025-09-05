import { useState } from 'react'
import { ocrAPI } from '../utils/mlApi.js'

export default function OCRPanel({ onResult }) {
  const [fileName, setFileName] = useState('')
  const [isWorking, setIsWorking] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    try {
      setIsWorking(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target.result
        // send base64 to backend
        const base64 = dataUrl.split(',')[1]
        const res = await ocrAPI(`data:image/png;base64,${base64}`)
        if (onResult) onResult(res)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('OCR failed', err)
      alert('OCR failed: ' + (err.message || err))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h4>OCR Auto-Fill</h4>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ padding: '6px 10px', border: '1px dashed #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files && e.target.files[0])} />
          Upload Image
        </label>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{fileName || 'No file'}</div>
        <div style={{ marginLeft: 'auto' }}>{isWorking ? 'Scanning...' : ''}</div>
      </div>
    </div>
  )
}
