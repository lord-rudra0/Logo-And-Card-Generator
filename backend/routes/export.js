import express from 'express'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'

const router = express.Router()

// POST /api/export/pdf
// Body: { svg: string, width?: number, height?: number }
router.post('/export/pdf', async (req, res) => {
  try {
    const { svg, width = 256, height = 256 } = req.body || {}
    if (!svg || typeof svg !== 'string') {
      return res.status(400).json({ error: 'Missing svg string in body' })
    }

    const doc = new PDFDocument({ size: [width, height] })

    // Collect PDF into a buffer
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="logo.pdf"')
      res.send(pdfBuffer)
    })

    // Render SVG into PDF
    SVGtoPDF(doc, svg, 0, 0, { assumePt: true })

    doc.end()
  } catch (err) {
    console.error('PDF export error:', err)
    res.status(500).json({ error: 'Failed to render PDF' })
  }
})

export default router
