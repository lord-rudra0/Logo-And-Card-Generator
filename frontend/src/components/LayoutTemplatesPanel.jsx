import React from 'react'

// Layout templates combine structure ideas
// ids: 'icon-above', 'icon-beside', 'text-only', 'initials-in-shape', 'symbol-initials'
const TEMPLATES = [
  { id: 'icon-above', label: 'Icon Above Text' },
  { id: 'icon-beside', label: 'Icon Beside Text' },
  { id: 'text-only', label: 'Text Only' },
  { id: 'initials-in-shape', label: 'Initials in Shape' },
  { id: 'symbol-initials', label: 'Symbol + Initials' }
]

export default function LayoutTemplatesPanel({ value = 'icon-beside', onSelect }) {
  return (
    <div>
      <h4>Layout Templates</h4>
      <div className="template-grid">
        {TEMPLATES.map(t => (
          <div
            key={t.id}
            className={`template-item ${value === t.id ? 'active' : ''}`}
            onClick={() => onSelect?.(t.id)}
            style={{ textAlign: 'center', padding: '6px' }}
          >
            <div style={{ fontSize: '0.9rem' }}>{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
