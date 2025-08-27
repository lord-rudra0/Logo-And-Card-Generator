// Programmatic generation of many example SVG logo templates
// Each template matches: { id, label, render({ ref, companyName, initials, primaryColor, secondaryColor, font }) }

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

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)) }

function makeProceduralTemplate(kind, index) {
  const id = `gen-${kind}-${index}`
  const label = `${kind.replace(/(^|-)\w/g, m => m.toUpperCase())} ${index + 1}`

  const render = ({ ref, companyName = 'Brand', initials = 'AA', primaryColor = '#f97316', secondaryColor = '#111827', font = 'Inter' }) => {
    const seed = hashToSeed(`${kind}|${index}|${companyName}|${initials}`)
    const rnd = prng(seed)
    const A = primaryColor
    const B = secondaryColor
    const cx = 80 + rnd() * 96
    const cy = 88 + rnd() * 48

    const commonText = (
      <g>
        <text x="50%" y="204" textAnchor="middle" fill={B} fontFamily={font} fontWeight="700" fontSize="18">{companyName}</text>
        <text x="50%" y="224" textAnchor="middle" fill={A} fontFamily={font} fontWeight="500" fontSize="12">{String(initials).toUpperCase()}</text>
      </g>
    )

    const content = (() => {
      if (kind === 'abstract-duotone') {
        const r1 = 36 + rnd() * 16
        const r2 = r1 + 10 + rnd() * 12
        const rot = Math.floor(rnd() * 360)
        const w = 70 + rnd() * 50
        const h = 12 + rnd() * 16
        const skew = -30 + rnd() * 60
        return (
          <g transform={`rotate(${rot} 128 96)`}>
            <circle cx={cx} cy={cy} r={r2} fill="none" stroke={B} strokeWidth="10" opacity="0.9" />
            <circle cx={cx} cy={cy} r={r1} fill="none" stroke={A} strokeWidth="10" strokeDasharray={`${Math.round(r1*2.4)}, ${Math.round(r1*1.6)}`} />
            <rect x={cx - w/2} y={cy - h/2} width={w} height={h} rx={h/2} fill={A} transform={`rotate(${skew} ${cx} ${cy})`} />
          </g>
        )
      }
      if (kind === 'chevrons') {
        const count = 3 + Math.floor(rnd() * 3)
        const gap = 10 + rnd() * 8
        return (
          <g transform={`translate(${clamp(cx-40,40,160)},${clamp(cy-20,40,120)})`}>
            {Array.from({ length: count }).map((_, i) => (
              <path key={i} d={`M0 ${i*gap} L28 ${i*gap+14} L0 ${i*gap+28}`} fill="none" stroke={i%2?B:A} strokeWidth="10" strokeLinecap="round"/>
            ))}
          </g>
        )
      }
      if (kind === 'links') {
        const r = 22 + rnd() * 10
        const dx = 30 + rnd() * 10
        return (
          <g transform={`translate(${cx},${cy})`}>
            <circle cx={-dx} cy={0} r={r} fill="none" stroke={A} strokeWidth="10"/>
            <circle cx={dx} cy={0} r={r} fill="none" stroke={B} strokeWidth="10"/>
            <path d={`M ${-dx+r/1.5} 0 H ${dx - r/1.5}`} stroke={B} strokeWidth="10"/>
          </g>
        )
      }
      if (kind === 'orbits') {
        const r = 34 + rnd() * 10
        const tilt = -30 + rnd() * 60
        return (
          <g transform={`translate(${cx},${cy})`}>
            <circle r={r} fill={A} opacity="0.85" />
            <ellipse rx={r*1.7} ry={r*0.6} fill="none" stroke={B} strokeWidth="6" transform={`rotate(${tilt})`}/>
            <circle cx={r*1.2} cy={-r*0.2} r={6} fill={B} />
          </g>
        )
      }
      // fallback same as abstract
      const r1 = 36 + rnd() * 16
      const r2 = r1 + 10 + rnd() * 12
      return (
        <g>
          <circle cx={cx} cy={cy} r={r2} fill="none" stroke={B} strokeWidth="10" />
          <circle cx={cx} cy={cy} r={r1} fill="none" stroke={A} strokeWidth="10" />
        </g>
      )
    })()

    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ background: 'transparent' }}>
        {content}
        {commonText}
      </svg>
    )
  }

  return { id, label, render }
}

export default function generateExampleTemplates(count = 100) {
  const kinds = ['abstract-duotone', 'chevrons', 'links', 'orbits']
  const items = []
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length]
    items.push(makeProceduralTemplate(kind, i))
  }
  return items
}
