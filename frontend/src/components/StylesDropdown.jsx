import React from 'react'

const STYLES = [
  { id: 'modern', label: 'Modern' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'creative', label: 'Creative' },
  { id: 'tech', label: 'Tech' },
  { id: 'vintage', label: 'Vintage' }
]

export default function StylesDropdown({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Style</label>
      <select className="input" value={value} onChange={(e) => onChange?.(e.target.value)}>
        {STYLES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
