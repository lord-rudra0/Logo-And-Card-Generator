import React from 'react'

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

  const render = ({ ref, companyName = 'Brand', initials = 'AA', primaryColor = '#f97316', secondaryColor = '#111827', font = 'Inter', iconOptions = {}, layoutOptions = {} }) => {
    const seed = hashToSeed(`${kind}|${index}|${companyName}|${initials}`)
    const rnd = prng(seed)
    const A = primaryColor
    const B = secondaryColor
    const cx = 80 + rnd() * 96
    const cy = 88 + rnd() * 48
    const stroke = Math.max(1, Number(iconOptions.strokeWidth ?? 10))
    const extraRotation = Number(iconOptions.rotation ?? 0)
    const layout = { template: 'icon-beside', alignment: 'center', spacing: 12, ...layoutOptions }
    const anchor = layout.alignment === 'start' ? 'start' : layout.alignment === 'end' ? 'end' : 'middle'

    // Compute text placement based on layout
    let textX = 128, titleY = 204, initialsY = 224
    if (layout.template === 'icon-above') {
      textX = 128
      titleY = 180 + layout.spacing
      initialsY = titleY + 18
    } else { // icon-beside
      // Place text near right side, give some room based on spacing
      if (anchor === 'start') textX = 170 + layout.spacing
      else if (anchor === 'end') textX = 230 - layout.spacing
      else textX = 200
      titleY = 96 - 4
      initialsY = titleY + 18
    }

    const commonText = (
      <g>
        <text x={textX} y={titleY} textAnchor={anchor} fill={B} fontFamily={font} fontWeight="700" fontSize="18">{companyName}</text>
        <text x={textX} y={initialsY} textAnchor={anchor} fill={A} fontFamily={font} fontWeight="500" fontSize="12">{String(initials).toUpperCase()}</text>
      </g>
    )

    const iconContent = (() => {
      if (kind === 'abstract-duotone') {
        const r1 = 36 + rnd() * 16
        const r2 = r1 + 10 + rnd() * 12
        const rot = Math.floor(rnd() * 360) + extraRotation
        const w = 70 + rnd() * 50
        const h = 12 + rnd() * 16
        const skew = -30 + rnd() * 60
        return (
          <g transform={`rotate(${rot} 128 96)`}>
            <circle cx={cx} cy={cy} r={r2} fill="none" stroke={B} strokeWidth={stroke} opacity="0.9" />
            <circle cx={cx} cy={cy} r={r1} fill="none" stroke={A} strokeWidth={stroke} strokeDasharray={`${Math.round(r1*2.4)}, ${Math.round(r1*1.6)}`} />
            <rect x={cx - w/2} y={cy - h/2} width={w} height={h} rx={h/2} fill={A} transform={`rotate(${skew} ${cx} ${cy})`} />
          </g>
        )
      }
      if (kind === 'chevrons') {
        const count = 3 + Math.floor(rnd() * 3)
        const gap = 10 + rnd() * 8
        return (
          <g transform={`translate(${clamp(cx-40,40,160)},${clamp(cy-20,40,120)}) rotate(${extraRotation})`}>
            {Array.from({ length: count }).map((_, i) => (
              <path key={i} d={`M0 ${i*gap} L28 ${i*gap+14} L0 ${i*gap+28}`} fill="none" stroke={i%2?B:A} strokeWidth={stroke} strokeLinecap="round"/>
            ))}
          </g>
        )
      }
      if (kind === 'links') {
        const r = 22 + rnd() * 10
        const dx = 30 + rnd() * 10
        return (
          <g transform={`translate(${cx},${cy}) rotate(${extraRotation})`}>
            <circle cx={-dx} cy={0} r={r} fill="none" stroke={A} strokeWidth={stroke}/>
            <circle cx={dx} cy={0} r={r} fill="none" stroke={B} strokeWidth={stroke}/>
            <path d={`M ${-dx+r/1.5} 0 H ${dx - r/1.5}`} stroke={B} strokeWidth={stroke}/>
          </g>
        )
      }
      if (kind === 'orbits') {
        const r = 34 + rnd() * 10
        const tilt = -30 + rnd() * 60
        return (
          <g transform={`translate(${cx},${cy}) rotate(${extraRotation})`}>
            <circle r={r} fill={A} opacity="0.85" />
            <ellipse rx={r*1.7} ry={r*0.6} fill="none" stroke={B} strokeWidth={Math.max(1, stroke*0.6)} transform={`rotate(${tilt})`}/>
            <circle cx={r*1.2} cy={-r*0.2} r={6} fill={B} />
          </g>
        )
      }
      // fallback same as abstract
      const r1 = 36 + rnd() * 16
      const r2 = r1 + 10 + rnd() * 12
      return (
        <g transform={`rotate(${extraRotation} 128 96)`}>
          <circle cx={cx} cy={cy} r={r2} fill="none" stroke={B} strokeWidth={stroke} />
          <circle cx={cx} cy={cy} r={r1} fill="none" stroke={A} strokeWidth={stroke} />
        </g>
      )
    })()

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'transparent' }}
      >
        {/* Scale down slightly to ensure no element touches edges */}
        <g transform="translate(128,128) scale(0.88) translate(-128,-128)">
          {/* Icon content (slightly nudged for beside layout) */}
          <g transform={layout.template === 'icon-beside' ? `translate(-${Math.max(0, layout.spacing)} 0)` : undefined}>
            {iconContent}
          </g>
          {commonText}
        </g>
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
