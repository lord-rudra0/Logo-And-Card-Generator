import React from 'react'

const Loader = ({ size = 48, text = 'Generating…' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r="20" stroke="rgba(0,0,0,0.08)" strokeWidth="6" fill="none" />
        <path d="M45 25a20 20 0 0 1-20 20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
        </path>
      </svg>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{text}</div>
    </div>
  )
}

export default Loader
