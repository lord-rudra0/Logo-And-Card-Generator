// Example SVG logo templates matching common references
// Each template provides a render({ ref, companyName, initials, primaryColor, secondaryColor, font }) => <svg>

const SIZE = 256

const templates = [
  {
    id: 'shield-initials',
    label: 'Shield + Initials',
    render: ({ ref, initials = 'AA', primaryColor = '#3b82f6', secondaryColor = '#1e40af', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gradShield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>
        <g>
          <path fill="url(#gradShield)" d="M128 20c30 18 60 18 60 18s0 66-12 96c-8 20-26 36-48 46-22-10-40-26-48-46-12-30-12-96-12-96s30 0 60-18z"/>
          <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontFamily={font} fontWeight="700" fontSize="64">
            {String(initials).slice(0,3).toUpperCase()}
          </text>
        </g>
      </svg>
    )
  },
  {
    id: 'leaf-mark',
    label: 'Leaf Mark + Name',
    render: ({ ref, companyName = 'Company', primaryColor = '#10b981', secondaryColor = '#059669', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gradLeaf" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>
        <g>
          <path fill="url(#gradLeaf)" d="M64 160c0-64 64-96 128-96-16 64-64 96-128 96z"/>
          <circle cx="64" cy="160" r="8" fill={secondaryColor} />
          <text x="128" y="170" textAnchor="middle" fill="#e5e7eb" fontFamily={font} fontWeight="600" fontSize="22">{companyName}</text>
        </g>
      </svg>
    )
  },
  {
    id: 'abstract-geo',
    label: 'Abstract Geometric',
    render: ({ ref, companyName = 'Brand', primaryColor = '#8b5cf6', secondaryColor = '#3b82f6', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gradGeo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>
        <rect x="40" y="40" width="80" height="80" rx="12" fill="url(#gradGeo)" />
        <circle cx="160" cy="96" r="40" fill={secondaryColor} opacity="0.6" />
        <polygon points="96,176 176,176 176,224" fill={primaryColor} opacity="0.8" />
        <text x="50%" y="232" textAnchor="middle" fill="#e5e7eb" fontFamily={font} fontWeight="600" fontSize="20">{companyName}</text>
      </svg>
    )
  },
  {
    id: 'monogram-circle',
    label: 'Monogram in Circle',
    render: ({ ref, initials = 'AA', primaryColor = '#f59e0b', secondaryColor = '#b45309', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <defs>
          <radialGradient id="gradMono" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </radialGradient>
        </defs>
        <circle cx="128" cy="96" r="56" fill="url(#gradMono)" />
        <text x="128" y="104" dominantBaseline="middle" textAnchor="middle" fill="#111827" fontFamily={font} fontWeight="800" fontSize="40">
          {String(initials).slice(0,2).toUpperCase()}
        </text>
      </svg>
    )
  }
]

export default templates
