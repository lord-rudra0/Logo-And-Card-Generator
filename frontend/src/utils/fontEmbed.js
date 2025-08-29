// Utilities to embed a font into SVG export and prepare payload for PDF

// Fetch a font as ArrayBuffer and return a data URL
export async function fetchFontAsDataUrl(fontUrl, mime = 'font/woff2') {
  const res = await fetch(fontUrl)
  if (!res.ok) throw new Error(`Failed to fetch font: ${res.status}`)
  const buf = await res.arrayBuffer()
  const base64 = arrayBufferToBase64(buf)
  return `data:${mime};base64,${base64}`
}

export function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Inject @font-face into an SVG element and set text to use that family
export function embedFontInSvg(svgEl, { family = 'EmbeddedFont', dataUrl, format = 'woff2' }) {
  if (!svgEl || !dataUrl) return
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.setAttribute('type', 'text/css')
  style.textContent = `@font-face{font-family:'${family}';src:url('${dataUrl}') format('${format}');font-weight:400;font-style:normal;}
text{font-family:'${family}', sans-serif;}`
  svgEl.insertBefore(style, svgEl.firstChild)
}
