import React from 'react'
import TEMPLATES from '../data/logoExampleTemplates.jsx'

export default function ExampleLogosDropdown({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Example Logo Template</label>
      <select
        className="input"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value || null)}
      >
        <option value="">None</option>
        {TEMPLATES.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </div>
  )
}
