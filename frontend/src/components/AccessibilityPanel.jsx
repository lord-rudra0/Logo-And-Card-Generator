import { useState } from 'react'
import { checkAccessibilityAPI } from '../utils/mlApi.js'

export default function AccessibilityPanel() {
  const [elementsJson, setElementsJson] = useState('[{"id":"title","textColor":"#ffffff","bgColor":"#3b82f6","fontSize":24}]')
  const [report, setReport] = useState(null)
  const [isRunning, setIsRunning] = useState(false)

  const runCheck = async () => {
    try {
      setIsRunning(true)
      const elements = JSON.parse(elementsJson)
      const res = await checkAccessibilityAPI(elements)
      setReport(res)
    } catch (err) {
      console.error('Accessibility check failed', err)
      alert('Accessibility check failed: ' + (err.message || err))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h4>Accessibility & Contrast</h4>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Paste a small JSON array describing text elements (id, textColor, bgColor, fontSize).</p>
      <textarea value={elementsJson} onChange={(e) => setElementsJson(e.target.value)} style={{ width: '100%', minHeight: 80, fontFamily: 'monospace', fontSize: 12 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={runCheck} disabled={isRunning}>{isRunning ? 'Checking...' : 'Run Check'}</button>
        <button className="btn btn-secondary" onClick={() => setElementsJson('[{"id":"title","textColor":"#ffffff","bgColor":"#3b82f6","fontSize":24}]')}>Reset</button>
      </div>

      {report && (
        <div style={{ marginTop: 12 }}>
          <h5>Results</h5>
          <div style={{ display: 'grid', gap: 8 }}>
            {report.results && report.results.map((r) => (
              <div key={r.id || Math.random()} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8, background: 'var(--bg-tertiary)' }}>
                <div style={{ width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '100%', height: '100%', background: r.bgColor || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: r.textColor || '#000', fontSize: 18, fontWeight: 600 }}>{r.id || 'T'}</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong>{r.id || 'element'}</strong>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <div style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: r.passAA ? '#ecfeff' : '#fee2e2', color: r.passAA ? '#065f46' : '#7f1d1d' }}>{r.passAA ? 'AA' : 'Fail'}</div>
                      <div style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: r.passLarge ? '#ecfeff' : '#fff7ed', color: r.passLarge ? '#065f46' : '#92400e' }}>{r.passLarge ? 'Large' : 'Small'}</div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.recommendation}</div>
                </div>
                <div style={{ width: 120, textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>Contrast: {r.contrast}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
