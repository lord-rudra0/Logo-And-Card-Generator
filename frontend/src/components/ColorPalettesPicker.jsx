import React from 'react'
import COLOR_PALETTES from '../data/colorPalettes.js'

export default function ColorPalettesPicker({ primary, secondary, onSelect }) {
  return (
    <div>
      <h4>Palettes</h4>
      <div className="template-grid">
        {COLOR_PALETTES.map(p => (
          <div
            key={p.id}
            className={`template-item ${(primary === p.colors[0] && secondary === p.colors[1]) ? 'active' : ''}`}
            onClick={() => onSelect?.(p.colors[0], p.colors[1])}
          >
            <div style={{ display: 'flex', gap: 6, padding: 6, alignItems: 'center', justifyContent: 'center' }}>
              {p.colors.map(c => (
                <div key={c} style={{ width: 20, height: 20, borderRadius: 4, background: c, border: '1px solid var(--border)' }} />
              ))}
            </div>
            <div style={{ fontSize: '0.8rem', textAlign: 'center' }}>{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
