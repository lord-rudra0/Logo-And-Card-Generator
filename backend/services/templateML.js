import fs from 'fs'
import path from 'path'

// Resolve templates directory relative to this service file first (works when backend is started from /backend)
// Fallback to process.cwd() based path for other start contexts.
const _here = path.dirname(new URL(import.meta.url).pathname)
const candidateDirs = [
  path.join(_here, '..', '..', 'ml', 'scraped_images_bcards'), // repo-root/ml/...
  path.join(_here, '..', 'ml', 'scraped_images_bcards'), // backend/../ml
  path.join(process.cwd(), 'ml', 'scraped_images_bcards') // process cwd fallback
]
const TEMPLATES_DIR = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0]
// debug: print resolved templates dir when module is loaded
try {
  console.debug('[templateML] candidateDirs=', candidateDirs)
  console.debug('[templateML] resolved TEMPLATES_DIR=', TEMPLATES_DIR, 'exists=', fs.existsSync(TEMPLATES_DIR))
} catch (e) {
  // ignore
}

const PALETTES = [
  { primary: '#3b82f6', secondary: '#1e40af', background: '#ffffff' },
  { primary: '#06b6d4', secondary: '#075985', background: '#ffffff' },
  { primary: '#ef4444', secondary: '#b91c1c', background: '#ffffff' },
  { primary: '#10b981', secondary: '#047857', background: '#ffffff' }
]

const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Raleway', 'Lato', 'Nunito']

function listTemplates() {
  try {
    console.debug('[templateML] listTemplates checking TEMPLATES_DIR=', TEMPLATES_DIR)
    if (!fs.existsSync(TEMPLATES_DIR)) {
      console.debug('[templateML] TEMPLATES_DIR does not exist')
      return []
    }
    const files = fs.readdirSync(TEMPLATES_DIR)
      .filter(f => /\.(png|jpe?g)$/i.test(f))
      .map(f => f)
    return files
  } catch (e) {
    console.error('[templateML] listTemplates error', e && e.message)
    return []
  }
}

function pickBySeed(arr, seed) {
  if (!arr || arr.length === 0) return null
  const h = typeof seed === 'number' ? seed : (String(seed || '').split('').reduce((s,c)=>s+c.charCodeAt(0),0))
  const idx = Math.abs(Number(h)) % arr.length
  return arr[idx]
}

async function suggestForTemplate(templateName, fields = {}) {
  // Simple deterministic suggestion based on template name
  const palettes = PALETTES
  const fonts = FONTS
  const pick = pickBySeed(palettes, templateName) || palettes[0]
  const font = pickBySeed(fonts, templateName) || fonts[0]

  const suggestion = {
    template: templateName,
    palette: { primary: pick.primary, secondary: pick.secondary, background: pick.background, text: '#111111' },
    typography: { heading: font, body: font },
    layout: {
      elements: {
        company: { position: 'top left', size: 'medium' },
        name: { position: 'center left', size: 'large' },
        title: { position: 'center left', size: 'medium' },
        contacts: { position: 'bottom left', size: 'small' }
      }
    },
    shapes: []
  }
  return suggestion
}

async function suggestFromInput({ companyName = '', industry = '', mood = '', preferredColor = '' } = {}) {
  // Pick palette by industry keywords
  let pick = PALETTES[0]
  if (industry && /tech|software|it/i.test(industry)) pick = PALETTES[0]
  else if (industry && /health|medical/i.test(industry)) pick = PALETTES[2]
  else if (industry && /creative|design|art/i.test(industry)) pick = PALETTES[1]

  const font = FONTS[Math.abs(companyName.split('').reduce((s,c)=>s+c.charCodeAt(0),0)) % FONTS.length]

  return {
    template: null,
    palette: { primary: preferredColor || pick.primary, secondary: pick.secondary, background: pick.background, text: '#111111' },
    typography: { heading: font, body: font },
    layout: {
      elements: {
        company: { position: 'top left', size: 'medium' },
        name: { position: 'center left', size: 'large' },
        title: { position: 'center left', size: 'medium' },
        contacts: { position: 'bottom left', size: 'small' }
      }
    },
    shapes: []
  }
}

export default {
  listTemplates,
  suggestForTemplate,
  suggestFromInput,
  pickBySeed
}
