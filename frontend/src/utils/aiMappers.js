// Mapping helpers to translate AI suggestion fields into our design system

// Map a generic typography style string to a concrete font stack
export function mapTypographyToFont(typography) {
  const t = (typography || '').toLowerCase()
  if (t.includes('serif')) return 'Georgia, serif'
  if (t.includes('hand') || t.includes('script')) return '"Comic Sans MS", "Comic Sans", cursive'
  if (t.includes('mono')) return '"Courier New", Courier, monospace'
  if (t.includes('futur') || t.includes('tech')) return 'Orbitron, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  if (t.includes('corporate')) return 'Helvetica, Arial, sans-serif'
  // default modern sans
  return 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
}

// Guess a layout template based on context
export function guessLayoutTemplate(suggestion, logoData) {
  const hasInitials = (logoData?.initials || '').trim().length > 0
  const industry = (logoData?.industry || '').toLowerCase()

  if (hasInitials && (industry.includes('education') || industry.includes('finance'))) {
    return 'initials-in-shape'
  }
  if ((suggestion?.style || '').toLowerCase().includes('minimal')) {
    return 'text-only'
  }
  if (industry.includes('creative')) return 'icon-above'
  return 'icon-beside'
}

// Guess a shape if initials present
export function guessShape(logoData) {
  const initials = (logoData?.initials || '').trim()
  if (!initials) return 'none'
  if (initials.length <= 2) return 'circle'
  return 'square'
}
