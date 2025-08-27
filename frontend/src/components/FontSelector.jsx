import React from 'react'
import FONT_GROUPS from '../data/fonts.js'

// Simple font selector grouped by categories. Applies selected font stack via onSelect.
export default function FontSelector({ value, onSelect }) {
  return (
    <div>
      <h4>Fonts</h4>
      {FONT_GROUPS.map(group => (
        <div key={group.id} style={{ marginBottom: 'var(--spacing-2)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-1)' }}>
            {group.label}
          </div>
          <div className="template-grid">
            {group.fonts.map(f => (
              <div
                key={f.id}
                className={`template-item ${value === f.stack ? 'active' : ''}`}
                onClick={() => onSelect?.(f.stack)}
                style={{ fontFamily: f.stack, textAlign: 'center', padding: '6px' }}
              >
                <div style={{ fontSize: '0.95rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Aa Bb Cc</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
