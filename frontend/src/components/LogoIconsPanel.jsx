import React, { useState } from 'react'

// Collapsible Icons panel controlled by a button. Hidden by default.
// Props:
// - icons: string[] (emoji list)
// - value: current selected icon (string)
// - onSelect: function(icon)
export default function LogoIconsPanel({ icons = [], value, onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Icons</span>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 10px' }}
          onClick={() => setOpen(o => !o)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </h4>

      {open && (
        <div className="template-grid" aria-label="icons-grid">
          {icons.map((icon) => (
            <div
              key={icon}
              className={`template-item ${value === icon ? 'active' : ''}`}
              onClick={() => onSelect?.(icon)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}
              role="button"
              aria-label={`icon-${icon}`}
            >
              {icon}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
