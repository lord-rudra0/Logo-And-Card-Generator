import React from 'react'
import { ICONS } from '../data/icons.jsx'

const IconPicker = ({ open, onClose, onSelect }) => {
  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', width: '560px', maxWidth: '95vw', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Choose an icon</h3>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
          {ICONS.map(icon => (
            <button key={icon.id} className="btn btn-secondary" onClick={() => onSelect(icon.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12 }}>
              <icon.Svg size={28} />
              <span style={{ marginTop: 8 }}>{icon.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default IconPicker
