// Client utility to export a PDF via backend /api/export/pdf

export async function exportPdfFromSvg(svgString, filename = 'logo.pdf', { width = 256, height = 256 } = {}) {
  const res = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ svg: svgString, width, height })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PDF export failed: ${res.status} ${text}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
