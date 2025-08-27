import React from 'react'

const SHAPES = [
  { id: 'none', label: 'None' },
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'triangle', label: 'Triangle' }
]

export default function ShapesDropdown({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Shape</label>
      <select className="input" value={value} onChange={(e) => onChange?.(e.target.value)}>
        {SHAPES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
