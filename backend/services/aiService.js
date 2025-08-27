export async function generateCardDesign(genAI, cardData, industry = 'business', count = 10) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 5000
      }
    })
    
    const cardDataJson = JSON.stringify(cardData, null, 2)
    const prompt = `
You are a senior brand designer. Create EXACTLY ${count} professional, legible, print-ready business card design suggestions based on the client details below.

Client details (JSON):
${cardDataJson}

Context:
- Industry: ${industry}
- Favor modern, timeless, grid-based compositions with clear visual hierarchy and ample whitespace.
- Enforce high contrast and accessibility. Avoid chaotic or cramped layouts.

Hard constraints (follow strictly):
- Allowed positions: "top left", "top center", "top right", "center left", "center", "center right", "bottom left", "bottom center", "bottom right".
- Contacts should prefer "bottom left" unless there is a strong rationale; never place contacts at the very top.
- Size keywords must be from: "small", "medium", "large", "xlarge".
- Name should be the largest text; Title smaller than Name; Company not larger than Title.
- Keep consistent margins around edges; avoid placing content flush to edges.
- Ensure palette.text has adequate contrast with palette.background (choose text color to maximize readability).

Diversity requirements (follow strictly):
- Each of the ${count} objects MUST be meaningfully different from the others.
- Vary the "template" among: modern, classic, minimal, corporate, tech, creative. Do not repeat the same template more than twice.
- Vary color palettes: do not reuse the same primary/secondary/background combination; cover cool, warm, neutral schemes.
- Vary layout.style across items (e.g., left-aligned, centered, split, banner) and vary element positions within the allowed set.
- Fonts can vary (Google-safe) between heading/body; avoid using the same exact pair for all items.

Output requirements:
- Return a JSON ARRAY only (no prose/markdown/backticks), with EXACTLY ${count} objects.
- Each object MUST match this schema exactly:
  {
    "name": string,
    "template": string,                  // one of [modern, classic, minimal, corporate, tech, creative]
    "palette": {
      "primary": string,                 // hex
      "secondary": string,               // hex
      "accent": string,                  // hex
      "background": string,              // hex
      "text": string                     // hex; MUST contrast background
    },
    "typography": {
      "heading": string,                 // Google-safe font name
      "body": string
    },
    "layout": {
      "style": string,                   // e.g., left-aligned, centered, split, banner
      "elements": {
        "logo": { "position": string, "size": string },
        "name": { "position": string, "size": string, "weight": "regular"|"medium"|"semibold"|"bold" },
        "title": { "position": string, "size": string },
        "company": { "position": string, "size": string },
        "contacts": { "position": string, "spacing": "tight"|"regular"|"roomy" },
        "qr": { "enabled": boolean, "position": string, "size": string }
      }
    },
    "content": {
      "name": string,
      "title": string,
      "company": string,
      "phone": string,
      "email": string,
      "website": string,
      "address": string
    },
    "guidelines": string,
    "mockPreview": string
  }

Design guidance:
- Grid-aligned, balanced composition with consistent spacing scale.
- Avoid top-left clustering of all elements; separate blocks (identity vs contacts).
- Subtle use of accent color; never reduce legibility.

Return ONLY the JSON array.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Try to extract robust JSON
    let designs = []
    try {
      const extracted = extractJsonArray(text)
      if (extracted) {
        designs = extracted
      } else {
        designs = createFallbackDesigns(industry, cardData)
      }
    } catch (parseError) {
      console.log('Failed to parse AI response, using fallback designs')
      designs = createFallbackDesigns(industry, cardData)
    }

    // Return up to `count` designs
    return designs.slice(0, count)
  } catch (error) {
    console.error('AI service error:', error)
    return createFallbackDesigns(industry, cardData, count)
  }
}

export async function generateLogoDesign(genAI, logoData) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    const prompt = `
      Generate 6 professional logo design suggestions for:
      Company: ${logoData.companyName}
      Industry: ${logoData.industry}
      Initials: ${logoData.initials || 'N/A'}
      Tagline: ${logoData.tagline || 'N/A'}
      
      For each design, provide:
      1. Logo concept name
      2. Style (modern, minimalist, corporate, creative, tech, vintage)
      3. Primary color (hex)
      4. Icon/symbol suggestion (emoji)
      5. Typography style
      6. Design rationale
      
      Return as JSON array with objects containing: name, style, primaryColor, icon, typography, description
      Focus on memorable, scalable designs that work across different mediums.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    let designs = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        designs = JSON.parse(jsonMatch[0])
      } else {
        designs = createFallbackLogoDesigns(logoData)
      }
    } catch (parseError) {
      console.log('Failed to parse AI response, using fallback logo designs')
      designs = createFallbackLogoDesigns(logoData)
    }

    return designs.slice(0, 6)
  } catch (error) {
    console.error('AI service error:', error)
    return createFallbackLogoDesigns(logoData)
  }
}

function createFallbackDesigns(industry, cardData, count = 10) {
  const industryStyles = {
    technology: [
      { name: 'Tech Modern', template: 'modern', primaryColor: '#3b82f6', secondaryColor: '#1e40af', font: 'Inter' },
      { name: 'Digital Gradient', template: 'gradient', primaryColor: '#8b5cf6', secondaryColor: '#3b82f6', font: 'Inter' },
      { name: 'Clean Code', template: 'minimal', primaryColor: '#10b981', secondaryColor: '#059669', font: 'Inter' },
      { name: 'Innovation', template: 'creative', primaryColor: '#06b6d4', secondaryColor: '#0891b2', font: 'Inter' }
    ],
    creative: [
      { name: 'Bold Creative', template: 'creative', primaryColor: '#ef4444', secondaryColor: '#dc2626', font: 'Inter' },
      { name: 'Artistic Flow', template: 'modern', primaryColor: '#f59e0b', secondaryColor: '#d97706', font: 'Inter' },
      { name: 'Vibrant Edge', template: 'gradient', primaryColor: '#8b5cf6', secondaryColor: '#7c3aed', font: 'Inter' },
      { name: 'Creative Minimal', template: 'minimal', primaryColor: '#ec4899', secondaryColor: '#be185d', font: 'Inter' }
    ],
    healthcare: [
      { name: 'Medical Trust', template: 'corporate', primaryColor: '#06b6d4', secondaryColor: '#0891b2', font: 'Inter' },
      { name: 'Health Care', template: 'modern', primaryColor: '#10b981', secondaryColor: '#059669', font: 'Inter' },
      { name: 'Professional Care', template: 'minimal', primaryColor: '#3b82f6', secondaryColor: '#1e40af', font: 'Inter' },
      { name: 'Wellness', template: 'classic', primaryColor: '#84cc16', secondaryColor: '#65a30d', font: 'Inter' }
    ]
  }

  const base = industryStyles[industry] || industryStyles.technology
  const templates = ['modern', 'classic', 'minimal', 'corporate', 'tech', 'creative']
  const palettes = [
    ['#3b82f6', '#1e40af', '#111827'],
    ['#ef4444', '#b91c1c', '#111827'],
    ['#10b981', '#065f46', '#0f172a'],
    ['#f59e0b', '#b45309', '#0b1020'],
    ['#8b5cf6', '#4c1d95', '#0a0a0a'],
    ['#06b6d4', '#0e7490', '#0b1320'],
    ['#84cc16', '#3f6212', '#111827'],
    ['#ec4899', '#be185d', '#111827']
  ]

  const fonts = ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'Lato', 'Work Sans', 'Manrope']
  const items = []
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length]
    const p = palettes[i % palettes.length]
    const f = fonts[i % fonts.length]
    items.push({
      name: `${base[i % base.length]?.name || 'Concept'} ${i + 1}`,
      template: t,
      palette: {
        primary: p[0],
        secondary: p[1],
        accent: p[0],
        background: p[2],
        text: '#ffffff'
      },
      typography: { heading: f, body: f },
      layout: {
        style: ['left-aligned', 'centered', 'split', 'banner'][i % 4],
        elements: {
          logo: { position: ['top left', 'top right'][i % 2], size: 'small' },
          name: { position: ['center left', 'center'][i % 2], size: 'large', weight: 'semibold' },
          title: { position: ['center left', 'center'][i % 2], size: 'medium' },
          company: { position: ['top left', 'top center'][i % 2], size: 'medium' },
          contacts: { position: ['bottom left', 'bottom center'][i % 2], spacing: 'regular' },
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
      guidelines: 'Fallback diversified design.',
      mockPreview: ''
    })
  }
  return items
}

// Extract the first valid JSON array from a model response.
function extractJsonArray(text) {
  if (!text) return null
  // Prefer explicit code blocks first
  const codeBlock = text.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/)
  const candidates = []
  if (codeBlock && codeBlock[1]) candidates.push(codeBlock[1])
  // Fallback: any array in the text
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) candidates.push(arrayMatch[0])

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      if (Array.isArray(parsed)) return parsed
      // If object returned, wrap as single-item array
      if (parsed && typeof parsed === 'object') return [parsed]
    } catch (_) {
      // try next candidate
    }
  }
  return null

}

function createFallbackLogoDesigns(logoData) {
  const industryIcons = {
    technology: ['💻', '🚀', '⚡', '🔧', '⚙️', '💡'],
    healthcare: ['🏥', '💊', '🩺', '❤️', '🌿', '💉'],
    creative: ['🎨', '✨', '🎭', '🖌️', '🌈', '💫'],
    finance: ['💼', '📊', '💰', '🏦', '📈', '💎'],
    education: ['📚', '🎓', '✏️', '🔬', '🌍', '💭'],
    retail: ['🛍️', '🏪', '🎁', '📦', '🛒', '💳']
  }

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']
  const styles = ['modern', 'minimalist', 'corporate', 'creative', 'tech', 'vintage']
  const icons = industryIcons[logoData.industry] || industryIcons.technology

  return icons.map((icon, index) => ({
    name: `${logoData.companyName} ${styles[index % styles.length]}`,
    style: styles[index % styles.length],
    primaryColor: colors[index % colors.length],
    icon,
    typography: 'Inter',
    description: `A ${styles[index % styles.length]} logo design for ${logoData.industry} industry`
  }))
}

// Generate a raster image (PNG/JPG) using a configurable Google Image provider endpoint.
// This is provider-agnostic: set GOOGLE_IMAGE_API_URL and GOOGLE_IMAGE_API_KEY in .env.
export async function generateCardImage(genAI, cardData, industry = 'business', size = { width: 1050, height: 600 }) {
  const prompt = buildCardImagePrompt(cardData, industry, size)
  const { width, height } = size || {}
  const imageBase64 = await callGoogleImageAPI({ prompt, width, height })
  return imageBase64
}

function buildCardImagePrompt(cardData, industry, size) {
  const { width = 1050, height = 600 } = size || {}
  const lines = [
    'Create a photorealistic, print-ready business card image with professional layout and strong hierarchy.',
    `Target size: ${width}x${height} pixels. High contrast and legible typography. Style: modern and professional for ${industry}.`,
    'Include the following content:',
    `- Name: ${cardData.name || ''}`,
    `- Title: ${cardData.title || ''}`,
    `- Company: ${cardData.company || ''}`,
    cardData.email ? `- Email: ${cardData.email}` : '',
    cardData.phone ? `- Phone: ${cardData.phone}` : '',
    cardData.website ? `- Website: ${cardData.website}` : '',
    cardData.address ? `- Address: ${cardData.address}` : '',
    'Design constraints: ample whitespace, clean alignment, avoid kitschy icons, keep it brand-appropriate.',
  ].filter(Boolean)
  return lines.join('\n')
}

async function callGoogleImageAPI({ prompt, width = 1050, height = 600 }) {
  const url = process.env.GOOGLE_IMAGE_API_URL
  const apiKey = process.env.GOOGLE_IMAGE_API_KEY
  if (!url || !apiKey) {
    const missing = []
    if (!url) missing.push('GOOGLE_IMAGE_API_URL')
    if (!apiKey) missing.push('GOOGLE_IMAGE_API_KEY')
    throw new Error(`Image generation not configured. Missing ${missing.join(', ')}`)
  }

  const body = {
    prompt,
    size: { width, height }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Image API error (${res.status}): ${text || res.statusText}`)
  }

  const data = await res.json()
  // Expect provider to return { imageBase64: '...' }
  const imageBase64 = data.imageBase64 || data.image || data.data
  if (!imageBase64) {
    throw new Error('Image API response missing imageBase64 field')
  }
  return imageBase64
}

// === SVG generation helpers ===
// Extract the first <svg>...</svg> block
function extractSVGBlock(text) {
  if (!text) return null
  const codeBlock = text.match(/```(?:svg|SVG)?\s*([\s\S]*?)\s*```/)
  const candidates = []
  if (codeBlock && codeBlock[1]) candidates.push(codeBlock[1])
  candidates.push(text)
  for (const c of candidates) {
    const m = c.match(/<svg[\s\S]*?<\/svg>/i)
    if (m) return m[0]
  }
  return null
}

// Generate card SVG using Gemini text model
export async function generateCardSVG(genAI, cardData, options = {}) {
  const {
    industry = 'business',
    width = 1050,
    height = 600,
    background = '#ffffff'
  } = options || {}

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const prompt = `You are a professional vector designer. Create a clean, modern business card FRONT as an inline SVG.\nReturn ONLY a single <svg> element, no explanations.\n\nRequirements:\n- Dimensions: ${width}x${height} (set width and height attributes explicitly)\n- Background color: ${background}\n- Style suitable for ${industry}\n- Include text fields if present: Name (${cardData.name || ''}), Title (${cardData.title || ''}), Company (${cardData.company || ''}), Email (${cardData.email || ''}), Phone (${cardData.phone || ''}), Website (${cardData.website || ''}), Address (${cardData.address || ''})\n- Use accessible contrast and legible font sizes\n- No external fonts; use system-safe fonts (e.g., 'Inter', 'Arial', 'Helvetica', 'sans-serif')\n- Do not embed rasters; vector shapes only\n- Avoid scripts or event handlers\n\nOutput: A single valid, minimal SVG markup.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text() || ''
  const svg = extractSVGBlock(text)
  if (!svg) throw new Error('Failed to generate SVG')
  return svg
}

// Generate logo SVG using Gemini text model
export async function generateLogoSVG(genAI, logoData, options = {}) {
  const { width = 256, height = 256, background = 'transparent' } = options || {}
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const prompt = `Design a minimal, scalable LOGO as an inline SVG.\nReturn ONLY a single <svg> element.\n\nCompany: ${logoData.companyName}\nIndustry: ${logoData.industry || 'general'}\nInitials: ${logoData.initials || ''}\nTagline: ${logoData.tagline || ''}\nPreferred color: ${logoData.primaryColor || '#3b82f6'}\n\nConstraints:\n- Dimensions: ${width}x${height}\n- Background: ${background}\n- Clean shapes, balanced composition, readable at small sizes\n- No raster images or scripts\n- Use geometric forms and typography when suitable.`

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text() || ''
  const svg = extractSVGBlock(text)
  if (!svg) throw new Error('Failed to generate logo SVG')
  return svg
}