import React from 'react'

// Simple shapes selector for logo containers
// shape ids: 'none', 'circle', 'square', 'hexagon', 'triangle'
export default function ShapesPanel({ value = 'none', onSelect }) {
  const SHAPES = [
    { id: 'none', label: 'None' },
    { id: 'circle', label: 'Circle' },
    { id: 'square', label: 'Square' },
    { id: 'hexagon', label: 'Hexagon' },
    { id: 'triangle', label: 'Triangle' }
  ]

  return (
    <div>
      <h4>Shapes</h4>
      <div className="template-grid">
        {SHAPES.map(s => (
          <div
            key={s.id}
            className={`template-item ${value === s.id ? 'active' : ''}`}
            onClick={() => onSelect?.(s.id)}
            style={{ textAlign: 'center', padding: '6px' }}
          >
            <div style={{ fontSize: '0.9rem' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
