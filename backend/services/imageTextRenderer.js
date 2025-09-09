import sharp from 'sharp'

// Overlay text onto a background image (data URL) using an SVG rendered by Sharp.
// backgroundDataUrl: data:image/...;base64,...
// cardData: { name, title, company, email, phone }
// options: { width, height, marginPercent, leftReservePercent, fontFamily }
export async function overlayTextOnImage(backgroundDataUrl, cardData = {}, options = {}) {
  // parse base64 image
  const match = backgroundDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL for background image')
  const imgBuf = Buffer.from(match[2], 'base64')

  const width = options.width || 1024
  const height = options.height || 640
  const marginPercent = options.marginPercent || 0.05
  const leftReservePercent = options.leftReservePercent || 0.35
  const fontFamily = options.fontFamily || 'Inter, Arial, sans-serif'

  const marginX = Math.round(width * marginPercent)
  const leftX = Math.round(width * 0.02) + marginX
  const textAreaX = Math.round(width * leftReservePercent)
  const usableWidth = textAreaX - (marginX * 2)

  // scale fonts to image size
  const nameFont = Math.max(18, Math.round(width * 0.05))
  const titleFont = Math.max(12, Math.round(width * 0.028))
  const companyFont = Math.max(12, Math.round(width * 0.024))

  const name = (cardData.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const title = (cardData.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const company = (cardData.company || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const email = (cardData.email || '')
  const phone = (cardData.phone || '')

  // Create SVG overlay with transparent background (so underlying artwork shows)
  const svg = `<?xml version="1.0" encoding="utf-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      .name { font-family: ${fontFamily}; font-size: ${nameFont}px; font-weight: 700; fill: #0b1220 }
      .title { font-family: ${fontFamily}; font-size: ${titleFont}px; fill: #0b1220 }
      .company { font-family: ${fontFamily}; font-size: ${companyFont}px; font-weight: 600; fill: #0b1220 }
      .meta { font-family: ${fontFamily}; font-size: ${companyFont}px; fill: #0b1220 }
    </style>
    <!-- A subtle white translucent rectangle for better contrast if background is busy -->
    <rect x="${marginX}" y="${marginX}" width="${textAreaX - marginX}" height="${height - (marginX * 2)}" rx="4" fill="rgba(255,255,255,0.82)" />
    <g transform="translate(${marginX + 20}, ${marginX + 40})">
      <text class="name">${name}</text>
      <text class="title" y="${Math.round(nameFont * 1.6)}">${title}</text>
      <text class="company" y="${Math.round(nameFont * 1.6 + titleFont * 1.8)}">${company}</text>
      <text class="meta" y="${Math.round(nameFont * 1.6 + titleFont * 1.8 + companyFont * 2.2)}">${email}${email && phone ? ' · ' : ''}${phone}</text>
    </g>
  </svg>`

  const svgBuf = Buffer.from(svg)

  // Ensure background matches requested dimensions: resize/crop if needed
  const backgroundSharp = sharp(imgBuf).rotate()
  const meta = await backgroundSharp.metadata()
  let base = backgroundSharp
  if (!meta.width || !meta.height || meta.width !== width || meta.height !== height) {
    base = backgroundSharp.resize(width, height, { fit: 'cover' })
  }

  // composite SVG over background using Sharp and return data URL PNG
  const composed = await base
    .composite([{ input: svgBuf, left: 0, top: 0 }])
    .png()
    .toBuffer()

  const outDataUrl = `data:image/png;base64,${composed.toString('base64')}`
  return outDataUrl
}

export default overlayTextOnImage
