// Programmatic library of 500+ colorful card templates
// Each item approximates the structure consumed by normalizeSuggestion() in CardCreator

const PALETTES = [
  { primary: '#3b82f6', secondary: '#1e40af' },
  { primary: '#ef4444', secondary: '#b91c1c' },
  { primary: '#10b981', secondary: '#065f46' },
  { primary: '#f59e0b', secondary: '#b45309' },
  { primary: '#8b5cf6', secondary: '#6d28d9' },
  { primary: '#06b6d4', secondary: '#0e7490' },
  { primary: '#84cc16', secondary: '#4d7c0f' },
  { primary: '#f97316', secondary: '#c2410c' },
  { primary: '#ec4899', secondary: '#9d174d' },
  { primary: '#22c55e', secondary: '#15803d' },
]

const BACKGROUNDS = [
  null, // means auto-gradient between primary/secondary
  '#0f172a', // slate-900
  '#111827', // gray-900
  '#ffffff',
  '#0a0a0a',
]

const FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Raleway', 'Lato', 'Nunito', 'Rubik', 'Source Sans 3', 'Work Sans', 'Manrope',
  'DM Sans', 'Outfit', 'Urbanist', 'Kanit', 'Open Sans', 'Roboto', 'Barlow', 'Hind', 'Mulish', 'Titillium Web'
]

const TEMPLATES = ['modern', 'classic', 'minimal', 'creative', 'corporate', 'tech']

const POSITIONS = [
  'top left', 'top center', 'top right',
  'center left', 'center', 'center right',
  'bottom left', 'bottom center', 'bottom right'
]

function pick(arr, i) { return arr[i % arr.length] }
function pickShifted(arr, i, shift) { return arr[(i + shift) % arr.length] }

function makeLayout(i) {
  return {
    elements: {
      company: { position: pick(POSITIONS, i * 3 + 0), size: i % 5 === 0 ? 'large' : 'medium' },
      name: { position: pick(POSITIONS, i * 5 + 1), size: (i % 4 === 0) ? 'x-large' : 'large' },
      title: { position: pick(POSITIONS, i * 7 + 2), size: (i % 3 === 0) ? 'medium' : 'small' },
      contacts: { position: pick(POSITIONS, i * 11 + 3), size: 'small' }
    }
  }
}

function makeContent(i) {
  const idx = i + 1
  return {
    name: `Alex Taylor ${idx}`,
    title: ['Software Engineer','Product Designer','Marketing Lead','Founder','Data Scientist'][i % 5],
    company: ['Nova Labs','PixelCraft','BluePeak','Lumina Corp','Apex Studio'][i % 5],
  }
}

function makeItem(i) {
  const pal = pick(PALETTES, i)
  const bg = pickShifted(BACKGROUNDS, i, 2)
  const font = pick(FONTS, i * 2)
  const template = pick(TEMPLATES, i)
  // Decorative layers inspired by professional examples
  // Types supported by renderer: 'band' (diagonal), 'arc' (corner circle/oval), 'curve' (large rotated oval)
  const shapeVariants = [
    // Vibrant diagonal band from left
    [{ type: 'band', color: pal.primary, opacity: 0.95, angle: 20, widthPct: 140, heightPx: 70, offsetX: -40, offsetY: 30 },
     { type: 'band', color: pal.secondary, opacity: 0.85, angle: 20, widthPct: 140, heightPx: 40, offsetX: -30, offsetY: 110 }],
    // Top-right arc motif
    [{ type: 'arc', color: pal.primary, opacity: 0.9, position: 'top-right', sizePx: 220, offsetX: 40, offsetY: -80 },
     { type: 'arc', color: pal.secondary, opacity: 0.7, position: 'top-right', sizePx: 160, offsetX: -10, offsetY: -40 }],
    // Bottom-left waves using curves
    [{ type: 'curve', color: pal.primary, opacity: 0.9, widthPct: 160, heightPx: 140, angle: -8, position: 'bottom-left', offsetX: -50, offsetY: -10 },
     { type: 'curve', color: pal.secondary, opacity: 0.7, widthPct: 150, heightPx: 110, angle: -6, position: 'bottom-left', offsetX: -40, offsetY: 20 }],
    // Split dual diagonal from right
    [{ type: 'band', color: pal.secondary, opacity: 0.9, angle: -18, widthPct: 150, heightPx: 80, offsetX: 30, offsetY: 20 },
     { type: 'band', color: pal.primary, opacity: 0.85, angle: -18, widthPct: 150, heightPx: 40, offsetX: 20, offsetY: 110 }]
  ]
  const shapes = shapeVariants[i % shapeVariants.length]

  return {
    id: `tpl_${i}`,
    name: `${template.charAt(0).toUpperCase() + template.slice(1)} ${i + 1}`,
    template,
    palette: {
      primary: pal.primary,
      secondary: pal.secondary,
      background: bg,
      // text is auto-derived in normalizeSuggestion when missing
    },
    typography: { heading: font, body: font },
    layout: makeLayout(i),
    content: makeContent(i),
    shapes,
  }
}

// Generate 520 templates
const GENERATED_TEMPLATES = Array.from({ length: 520 }, (_, i) => makeItem(i))

export { GENERATED_TEMPLATES }
export default GENERATED_TEMPLATES
