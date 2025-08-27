import React from 'react'

const TEMPLATES = [
  { id: 'icon-above', label: 'Icon Above Text' },
  { id: 'icon-beside', label: 'Icon Beside Text' },
  { id: 'text-only', label: 'Text Only' },
  { id: 'initials-in-shape', label: 'Initials in Shape' },
  { id: 'symbol-initials', label: 'Symbol + Initials' }
]

export default function LayoutTemplatesDropdown({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Layout Template</label>
      <select className="input" value={value} onChange={(e) => onChange?.(e.target.value)}>
        {TEMPLATES.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </div>
  )
}
