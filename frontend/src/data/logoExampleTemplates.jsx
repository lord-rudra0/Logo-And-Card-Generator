// Example SVG logo templates matching common references
// Each template provides a render({ ref, companyName, initials, primaryColor, secondaryColor, font }) => <svg>

const SIZE = 256

function hashToSeed(str = '') {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
  }
  return Math.abs(h >>> 0)
}

function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

import generateExampleTemplates from './logoExampleTemplates.generated.jsx'

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
    id: 'abstract-duotone-procedural',
    label: 'AI Vector (Abstract, Duotone)',
    render: ({ ref, companyName = 'Company', initials = 'AA', primaryColor = '#f97316', secondaryColor = '#111827', font = 'Inter' }) => {
      const seed = hashToSeed(`${companyName}|${initials}`)
      const rnd = prng(seed)
      const SIZE_LOCAL = SIZE
      const cx = 88 + rnd() * 16
      const cy = 92 + rnd() * 16
      const r1 = 42 + rnd() * 12
      const r2 = r1 + 12 + rnd() * 10
      const rot = Math.floor(rnd() * 360)
      const skewRectW = 90 + rnd() * 30
      const skewRectH = 18 + rnd() * 10
      const skewRot = -20 + rnd() * 40

      // Accent color pair like the examples (orange + dark navy)
      const A = primaryColor
      const B = secondaryColor

      return (
        <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE_LOCAL} height={SIZE_LOCAL} viewBox={`0 0 ${SIZE_LOCAL} ${SIZE_LOCAL}`} style={{ background: 'transparent' }}>
          <defs>
            <linearGradient id="gradProcedural" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={A} />
              <stop offset="100%" stopColor={B} />
            </linearGradient>
          </defs>
          <g transform={`rotate(${rot} 128 96)`}>
            {/* Outer ring */}
            <circle cx={cx} cy={cy} r={r2} fill="none" stroke={B} strokeWidth="10" strokeLinecap="round" opacity="0.85" />
            {/* Inner arc */}
            <circle cx={cx} cy={cy} r={r1} fill="none" stroke={A} strokeWidth="10" strokeDasharray={`${Math.round(r1*3.14)}, ${Math.round(r1*2)}`} strokeLinecap="round" />
            {/* Skewed rectangle stripe */}
            <rect x={cx - skewRectW/2} y={cy - skewRectH/2} width={skewRectW} height={skewRectH} rx={skewRectH/2} fill="url(#gradProcedural)" transform={`rotate(${skewRot} ${cx} ${cy})`} />
            {/* Interlocking loop */}
            <path d={`M ${cx-24} ${cy+10} C ${cx-10} ${cy-20}, ${cx+10} ${cy-20}, ${cx+24} ${cy+10}`} fill="none" stroke={B} strokeWidth="10" strokeLinecap="round" />
            <path d={`M ${cx-24} ${cy-10} C ${cx-10} ${cy+20}, ${cx+10} ${cy+20}, ${cx+24} ${cy-10}`} fill="none" stroke={A} strokeWidth="10" strokeLinecap="round" />
          </g>
          <text x="50%" y="200" textAnchor="middle" fill={B} fontFamily={font} fontWeight="700" fontSize="22">{companyName}</text>
          <text x="50%" y="222" textAnchor="middle" fill={A} fontFamily={font} fontWeight="500" fontSize="14">{String(initials).toUpperCase()}</text>
        </svg>
      )
    }
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
  },
  {
    id: 'bullseye-mark',
    label: 'Bullseye Mark',
    render: ({ ref, companyName = 'Brand', primaryColor = '#e11d48', secondaryColor = '#ef4444', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <g transform="translate(128,96)">
          <circle r="64" fill={secondaryColor} />
          <circle r="40" fill="#ffffff" />
          <circle r="24" fill={primaryColor} />
          <circle r="8" fill="#ffffff" />
        </g>
        <text x="128" y="190" textAnchor="middle" fill="#1f2937" fontFamily={font} fontWeight="700" fontSize="22">{companyName}</text>
      </svg>
    )
  },
  {
    id: 'arches-golden',
    label: 'Golden Arches',
    render: ({ ref, companyName = 'Brand', primaryColor = '#fbbf24', secondaryColor = '#f59e0b', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gradArches" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>
        <g transform="translate(64,120)">
          <path d="M0 32 C0 -40 64 -40 64 32 V64 H48 V32 C48 -8 16 -8 16 32 V64 H0 Z" fill="url(#gradArches)" />
          <g transform="translate(64,0)">
            <path d="M0 32 C0 -40 64 -40 64 32 V64 H48 V32 C48 -8 16 -8 16 32 V64 H0 Z" fill="url(#gradArches)" />
          </g>
        </g>
        <text x="128" y="210" textAnchor="middle" fill="#ef4444" fontFamily={font} fontWeight="700" fontSize="18">{companyName}</text>
      </svg>
    )
  },
  {
    id: 'script-wordmark',
    label: 'Script Wordmark',
    render: ({ ref, companyName = 'YourBrand', primaryColor = '#111827', secondaryColor = '#6b7280', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <text x="50%" y="55%" textAnchor="middle" fill={primaryColor} fontFamily={font} fontWeight="600" fontSize="46" fontStyle="italic" letterSpacing="1">
          {companyName}
        </text>
        <rect x="48" y="160" width="160" height="4" rx="2" fill={secondaryColor} opacity="0.5" />
      </svg>
    )
  },
  {
    id: 'diagonal-stripes',
    label: 'Diagonal Stripes',
    render: ({ ref, companyName = 'Brand', primaryColor = '#111827', secondaryColor = '#374151', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <g transform="translate(48,96) skewX(-20)">
          <rect x="0" y="-40" width="28" height="80" fill={primaryColor} />
          <rect x="40" y="-40" width="28" height="80" fill={secondaryColor} />
          <rect x="80" y="-40" width="28" height="80" fill={primaryColor} />
        </g>
        <text x="50%" y="200" textAnchor="middle" fill={primaryColor} fontFamily={font} fontWeight="800" fontSize="28">{companyName}</text>
      </svg>
    )
  },
  {
    id: 'creative-blob-c',
    label: 'Creative Blob Monogram',
    render: ({ ref, initials = 'C', primaryColor = '#ec4899', secondaryColor = '#8b5cf6', font = 'Inter' }) => (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gradBlob" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>
        <g>
          <circle cx="120" cy="100" r="56" fill="url(#gradBlob)" />
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx={160 + i * 10} cy={60 + i * 8} r={6 + Math.max(0, 6 - i)} fill={primaryColor} opacity={0.6 - i * 0.08} />
          ))}
          <text x="120" y="108" dominantBaseline="middle" textAnchor="middle" fill="#ffffff" fontFamily={font} fontWeight="800" fontSize="42">
            {String(initials).slice(0,1).toUpperCase()}
          </text>
        </g>
      </svg>
    )
  }
]

const GENERATED = generateExampleTemplates(100)
export default [...templates, ...GENERATED]
