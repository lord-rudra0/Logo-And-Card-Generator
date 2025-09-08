import { useState, useRef } from 'react'
import QRCode from 'qrcode'

const QrGenerator = ({ onClose }) => {
  const [text, setText] = useState('https://example.com')
  const [size, setSize] = useState(256)
  const [colorDark, setColorDark] = useState('#000000')
  const [colorLight, setColorLight] = useState('#ffffff')
  const [margin, setMargin] = useState(1)
  const [format, setFormat] = useState('png') // 'png' | 'svg'
  const [dataUrl, setDataUrl] = useState(null)
  const canvasRef = useRef(null)

  const generate = async () => {
    if (!text || text.trim().length === 0) return
    try {
      if (format === 'png') {
        const url = await QRCode.toDataURL(text.trim(), { width: size, margin, color: { dark: colorDark, light: colorLight } })
        setDataUrl(url)
      } else {
        const svg = await QRCode.toString(text.trim(), { type: 'svg', width: size, margin, color: { dark: colorDark, light: colorLight } })
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        setDataUrl(URL.createObjectURL(blob))
      }
    } catch (err) {
      console.error('QR generate error', err)
      setDataUrl(null)
    }
  }

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    const ext = format === 'png' ? 'png' : 'svg'
    a.download = `qr_${Date.now()}.${ext}`
    a.click()
  }

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
      <div style={{ width: 720, maxWidth: '95%', background: '#0b1220', padding: 18, borderRadius: 8, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>QR Generator</h3>
          <div>
            <button className="btn btn-secondary" onClick={onClose} style={{ marginRight: 8 }}>Close</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, marginTop: 12 }}>
          <div>
            <div className="form-group">
              <label className="form-label">Content (URL or text)</label>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Size (px)</label>
                <input type="number" className="input" min="64" max="2048" value={size} onChange={(e) => setSize(parseInt(e.target.value || '256', 10))} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Margin</label>
                <input type="number" className="input" min="0" max="10" value={margin} onChange={(e) => setMargin(parseInt(e.target.value || '1', 10))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Dark color</label>
                <input type="color" className="input" value={colorDark} onChange={(e) => setColorDark(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Light color</label>
                <input type="color" className="input" value={colorLight} onChange={(e) => setColorLight(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="png">PNG (raster)</option>
                <option value="svg">SVG (vector)</option>
              </select>
              <button className="btn btn-primary" onClick={generate}>Generate</button>
              <button className="btn" onClick={() => { setText(''); setDataUrl(null) }}>Clear</button>
            </div>
          </div>

          <div style={{ background: '#071025', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: size, height: size, display: 'grid', placeItems: 'center', background: colorLight, padding: 8, borderRadius: 6 }}>
              {dataUrl ? (
                <img src={dataUrl} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#9aa6b2', fontSize: 12 }}>Preview will appear here</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={download} disabled={!dataUrl}>Download</button>
              <button className="btn btn-secondary" onClick={() => { if (dataUrl) navigator.clipboard && navigator.clipboard.writeText(dataUrl) }}>Copy Data URL</button>
              <button className="btn btn-outline" onClick={() => {
                if (!dataUrl) return
                // Dispatch a global event that CardCreator can listen for
                const payload = { id: `qr_${Date.now()}`, dataUrl, format, size, colorDark, colorLight }
                window.dispatchEvent(new CustomEvent('qrCreated', { detail: payload }))
                // close modal
                onClose && onClose()
              }}>Use in Card Creator</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QrGenerator
