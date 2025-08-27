import React from 'react'
import COLOR_PALETTES from '../data/colorPalettes.js'

export default function ColorPalettesDropdown({ primary, secondary, onChange }) {
  const value = `${primary}|${secondary}`
  return (
    <div className="form-group">
      <label className="form-label">Color Palette</label>
      <select
        className="input"
        value={value}
        onChange={(e) => {
          const [p, s] = e.target.value.split('|')
          onChange?.(p, s)
        }}
      >
        {COLOR_PALETTES.map(p => (
          <option key={p.id} value={`${p.colors[0]}|${p.colors[1]}`}>
            {p.name} — {p.colors[0]} / {p.colors[1]}
          </option>
        ))}
      </select>
    </div>
  )
}
