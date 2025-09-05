// Lightweight ML utilities for Phase 1 features (PoC implementations)
// These are deterministic, dependency-free implementations where possible.

function pickPaletteForIndustry(industry) {
  const map = {
    technology: ['#3b82f6', '#6366f1', '#06b6d4', '#06b6d4'],
    healthcare: ['#10b981', '#059669', '#34d399', '#ecfccb'],
    finance: ['#0ea5e9', '#0284c7', '#7dd3fc', '#e6f6ff'],
    creative: ['#f43f5e', '#fb7185', '#f59e0b', '#f97316'],
    real_estate: ['#7c3aed', '#6d28d9', '#a78bfa', '#eef2ff']
  }
  return map[industry] || ['#111827', '#374151', '#6b7280', '#9ca3af']
}

function pickFontsForIndustry(industry) {
  const map = {
    technology: ['Inter', 'Montserrat', 'Roboto'],
    healthcare: ['Nunito', 'Poppins', 'Inter'],
    finance: ['Barlow', 'DM Sans', 'Lato'],
    creative: ['Kanit', 'Playfair Display', 'Poppins'],
    real_estate: ['Merriweather', 'Lora', 'Nunito']
  }
  return map[industry] || ['Inter', 'System UI']
}

export async function recommendStyle({ industry = 'technology', mood = 'professional' } = {}) {
  // Simple mapping + small randomization to keep suggestions varied
  const palette = pickPaletteForIndustry(industry).slice(0, 4)
  const fonts = pickFontsForIndustry(industry)

  // lightweight rules: mood can change priority or suggest accent color
  let accent = palette[1]
  if (mood === 'warm') accent = '#f59e0b'
  if (mood === 'cool') accent = palette[0]

  return {
    industry,
    mood,
    palette: {
      primary: palette[0],
      secondary: palette[1],
      accent
    },
    fonts: {
      heading: fonts[0],
      body: fonts[1] || fonts[0]
    }
  }
}

export async function checkAccessibility(elements = []) {
  // elements: [{ id, textColor, bgColor, fontSize }]
  function hexToRgb(hex) {
    if (!hex) return [0, 0, 0]
    const h = hex.replace('#', '')
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
  }

  function luminance([r, g, b]) {
    const srgb = [r, g, b].map(v => v / 255)
    const lin = srgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  }

  function contrastRatio(hexA, hexB) {
    const la = luminance(hexToRgb(hexA))
    const lb = luminance(hexToRgb(hexB))
    const brighter = Math.max(la, lb)
    const darker = Math.min(la, lb)
    return (brighter + 0.05) / (darker + 0.05)
  }

  const results = elements.map(el => {
    const ratio = contrastRatio(el.textColor || '#000000', el.bgColor || '#ffffff')
    const passAA = ratio >= 4.5
    const passLarge = ratio >= 3.0
    return {
      id: el.id || null,
      contrast: Number(ratio.toFixed(2)),
      passAA,
      passLarge,
      recommendation: passAA ? 'OK' : 'Increase contrast: use darker text or lighter background'
    }
  })

  return { results }
}

export async function ocrFromImageBase64(base64Image) {
  // Attempt to use tesseract.js if installed; otherwise return a helpful message
  try {
    // dynamic require to avoid hard dependency
    // eslint-disable-next-line no-undef
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker()
    await worker.load()
    await worker.loadLanguage('eng')
    await worker.initialize('eng')
    const { data } = await worker.recognize(base64Image)
    await worker.terminate()
    return { text: data.text }
  } catch (err) {
    return { error: 'tesseract.js not installed or failed to run. Install tesseract.js in backend for OCR support.', details: String(err && err.message) }
  }
}
