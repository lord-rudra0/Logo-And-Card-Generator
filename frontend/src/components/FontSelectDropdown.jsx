import React from 'react'
import FONT_GROUPS from '../data/fonts.js'

export default function FontSelectDropdown({ value, onChange }) {
  const options = []
  FONT_GROUPS.forEach(g => {
    g.fonts.forEach(f => options.push({ id: `${g.id}:${f.id}`, label: `${g.label} — ${f.label}`, stack: f.stack }))
  })

  return (
    <div className="form-group">
      <label className="form-label">Font</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.id} value={opt.stack} style={{ fontFamily: opt.stack }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
