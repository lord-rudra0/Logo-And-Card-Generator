// Lightweight fallback AI service: ML functionality removed.
// This file provides simple, non-ML placeholders so other modules can continue
// to import these functions without pulling in heavy ML dependencies.

export async function generateCardDesign(genAI, cardData, industry = 'business', count = 10) {
  // Return simple template-based fallback designs.
  const palettes = [
    ['#3b82f6', '#1e40af'],
    ['#ef4444', '#b91c1c'],
    ['#10b981', '#065f46'],
    ['#f59e0b', '#b45309']
  ]
  const fonts = ['Inter', 'Poppins', 'Montserrat', 'Roboto']
  const templates = ['modern', 'classic', 'minimal', 'corporate']

  const items = []
  for (let i = 0; i < (count || 4); i++) {
    const p = palettes[i % palettes.length]
    items.push({
      name: `${cardData.name || 'Name'} Concept ${i + 1}`,
      template: templates[i % templates.length],
      palette: {
        primary: p[0],
        secondary: p[1],
        accent: p[0],
        background: '#ffffff',
        text: '#111827'
      },
      typography: { heading: fonts[i % fonts.length], body: fonts[i % fonts.length] },
      layout: {
        style: ['left-aligned', 'centered', 'split'][i % 3],
        elements: {
          logo: { position: 'top left', size: 'small' },
          name: { position: 'center left', size: 'large', weight: 'semibold' },
          title: { position: 'center left', size: 'medium' },
          company: { position: 'top left', size: 'medium' },
          contacts: { position: 'bottom left', spacing: 'regular' },
          qr: { enabled: false, position: 'bottom right', size: 'small' }
        }
      },
      content: {
        name: cardData?.name || '',
        title: cardData?.title || '',
        company: cardData?.company || '',
        phone: cardData?.phone || '',
        email: cardData?.email || '',
        website: cardData?.website || '',
        address: cardData?.address || ''
      },
      guidelines: 'Fallback design generated without ML.',
      mockPreview: ''
    })
  }
  return items.slice(0, count)
}

export async function generateLogoDesign(genAI, logoData) {
  // Simple deterministic fallbacks (no ML).
  const icons = ['💡', '⚙️', '🔷', '🔶', '✦', '✺']
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']
  return icons.map((icon, i) => ({
    name: `${logoData.companyName || 'Company'} ${i + 1}`,
    style: ['modern', 'minimalist', 'corporate', 'creative'][i % 4],
    colors: { primary: colors[i % colors.length], secondary: colors[(i + 1) % colors.length] },
    icon,
    typography: { font: 'Inter', weight: 400 },
    layout: { template: 'icon-left', spacing: 'regular', alignment: 'left' },
    description: 'Non-ML placeholder logo concept.'
  }))
}

export async function generateCardImage(genAI, cardData, industry = 'business', size = { width: 1050, height: 600 }) {
  // Image generation removed. Signal to caller that ML is not available.
  throw new Error('Card image generation disabled: ML support removed from this build')
}

export async function generateCardSVG(genAI, cardData, options = {}) {
  // Return a tiny, generic SVG placeholder
  const width = options.width || 1050
  const height = options.height || 600
  const name = (cardData && cardData.name) ? cardData.name : 'Name'
  const company = (cardData && cardData.company) ? cardData.company : 'Company'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/><text x="50" y="60" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="#111">${name}</text><text x="50" y="110" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#444">${company}</text></svg>`
  return svg
}

export async function generateLogoSVG(genAI, logoData, options = {}) {
  // Minimal SVG placeholder for a logo
  const size = options.width || 256
  const initials = (logoData && logoData.companyName) ? logoData.companyName.slice(0, 2).toUpperCase() : 'LG'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" rx="24" fill="#3b82f6"/><text x="50%" y="55%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.floor(size/2.8)}" fill="#fff" dy=".35em">${initials}</text></svg>`
  return svg
}