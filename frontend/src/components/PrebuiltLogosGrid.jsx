import React from 'react'

// Utility to build CSS gradient from template.gradient
function toCssGradient(gradient, fallbackColor) {
  if (!gradient || !gradient.stops || gradient.stops.length < 2) {
    return fallbackColor
  }
  const angle = gradient.angle ?? 45
  const stops = gradient.stops
    .map(s => `${s.color} ${typeof s.at === 'number' ? s.at + '%' : ''}`.trim())
    .join(', ')
  return `linear-gradient(${angle}deg, ${stops})`
}

export default function PrebuiltLogosGrid({ templates = [], onApply }) {
  return (
    <div>
      <h3>Prebuilt Logo Templates</h3>
      <div className="template-grid">
        {templates.map(tpl => (
          <div key={tpl.id} className="template-item" onClick={() => onApply?.(tpl)}>
            <div style={{ padding: 'var(--spacing-2)' }}>
              <div style={{
                height: 72,
                borderRadius: 10,
                background: toCssGradient(tpl.gradient, tpl.primaryColor),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.5rem',
                marginBottom: 'var(--spacing-2)'
              }}>
                <span role="img" aria-label={tpl.name}>{tpl.icon}</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tpl.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{tpl.style}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
