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
  // Curated, professional text arrangements inspired by common business card patterns
  const PRESETS = [
    // 1. Company top-left, name center-left, title under name, contacts bottom-left
    { company: 'top left', name: 'center left', title: 'center left', contacts: 'bottom left', offs: { company: {x:0,y:0}, name:{x:0,y:-6}, title:{x:0,y:16}, contacts:{x:0,y:0} } },
    // 2. Company top-right, name center-right, contacts bottom-right
    { company: 'top right', name: 'center right', title: 'center right', contacts: 'bottom right', offs: { company:{x:-8,y:0}, name:{x:0,y:-8}, title:{x:0,y:12}, contacts:{x:0,y:0} } },
    // 3. Company top-center, name center, contacts bottom-center
    { company: 'top center', name: 'center', title: 'center', contacts: 'bottom center', offs: { company:{x:0,y:0}, name:{x:0,y:-10}, title:{x:0,y:12}, contacts:{x:0,y:0} } },
    // 4. Split: company left, name right, contacts bottom-right
    { company: 'top left', name: 'center right', title: 'center right', contacts: 'bottom right', offs: { company:{x:0,y:0}, name:{x:-8,y:0}, title:{x:-8,y:16}, contacts:{x:0,y:0} } },
    // 5. Split: company right, name left, contacts bottom-left
    { company: 'top right', name: 'center left', title: 'center left', contacts: 'bottom left', offs: { company:{x:0,y:0}, name:{x:8,y:0}, title:{x:8,y:16}, contacts:{x:0,y:0} } },
    // 6. Diagonal emphasis: company bottom-left, name top-right
    { company: 'bottom left', name: 'top right', title: 'center right', contacts: 'bottom right', offs: { company:{x:0,y:-6}, name:{x:-8,y:0}, title:{x:-8,y:12}, contacts:{x:0,y:0} } },
    // 7. Minimal center-left stack
    { company: 'center left', name: 'top left', title: 'center left', contacts: 'bottom left', offs: { company:{x:0,y:0}, name:{x:0,y:8}, title:{x:0,y:22}, contacts:{x:0,y:0} } },
    // 8. Minimal center-right stack
    { company: 'center right', name: 'top right', title: 'center right', contacts: 'bottom right', offs: { company:{x:0,y:0}, name:{x:0,y:8}, title:{x:0,y:22}, contacts:{x:0,y:0} } },
    // 9. Company bottom-center, name top-center (bold center composition)
    { company: 'bottom center', name: 'top center', title: 'center', contacts: 'bottom center', offs: { company:{x:0,y:0}, name:{x:0,y:6}, title:{x:0,y:20}, contacts:{x:0,y:0} } },
    // 10. Name large at top-left, company center-right
    { company: 'center right', name: 'top left', title: 'center left', contacts: 'bottom left', offs: { company:{x:0,y:-4}, name:{x:0,y:0}, title:{x:0,y:18}, contacts:{x:0,y:0} } },
    // 11. Name large at top-right, company center-left
    { company: 'center left', name: 'top right', title: 'center right', contacts: 'bottom right', offs: { company:{x:0,y:-4}, name:{x:0,y:0}, title:{x:0,y:18}, contacts:{x:0,y:0} } },
    // 12. Name center, company top-left, contacts bottom-right
    { company: 'top left', name: 'center', title: 'center', contacts: 'bottom right', offs: { company:{x:0,y:0}, name:{x:0,y:-6}, title:{x:0,y:16}, contacts:{x:0,y:0} } },
    // 13. Contacts column on right
    { company: 'top left', name: 'center left', title: 'center left', contacts: 'center right', offs: { company:{x:0,y:0}, name:{x:0,y:-8}, title:{x:0,y:10}, contacts:{x:12,y:0} } },
    // 14. Big name bottom-left, company top-right
    { company: 'top right', name: 'bottom left', title: 'bottom left', contacts: 'bottom right', offs: { company:{x:-6,y:0}, name:{x:0,y:-10}, title:{x:0,y:10}, contacts:{x:0,y:0} } },
    // 15. Vertical company badge (simulated by left-center, shifted up)
    { company: 'center left', name: 'top center', title: 'center', contacts: 'bottom right', offs: { company:{x:-6,y:-30}, name:{x:0,y:0}, title:{x:0,y:18}, contacts:{x:0,y:0} } },
  ]

  const p = PRESETS[i % PRESETS.length]
  const sizeFor = {
    name: (i % 4 === 0) ? 'x-large' : 'large',
    title: (i % 3 === 0) ? 'medium' : 'small',
    company: (i % 5 === 0) ? 'large' : 'medium',
    contacts: 'small'
  }

  return {
    elements: {
      company: { position: p.company, size: sizeFor.company, offsetX: p.offs.company.x, offsetY: p.offs.company.y },
      name: { position: p.name, size: sizeFor.name, offsetX: p.offs.name.x, offsetY: p.offs.name.y },
      title: { position: p.title, size: sizeFor.title, offsetX: p.offs.title.x, offsetY: p.offs.title.y },
      contacts: { position: p.contacts, size: sizeFor.contacts, offsetX: p.offs.contacts.x, offsetY: p.offs.contacts.y }
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
