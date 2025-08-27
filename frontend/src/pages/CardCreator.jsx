import { useState, useEffect, useRef } from 'react'
import IconPicker from '../components/IconPicker.jsx'
import DraggableIcon from '../components/DraggableIcon.jsx'
import { ICONS, getIconById } from '../data/icons.jsx'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import AssetManager from '../components/AssetManager.jsx'
import DraggableImage from '../components/DraggableImage.jsx'
import GENERATED_TEMPLATES from '../data/templates.js'

// ---- Global helpers (usable by both MiniCardPreview and CardCreator) ----
// Basic hex validator
function isHex(val) {
  return typeof val === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val.trim())
}

function hexToRgb(hex) {
  if (!isHex(hex)) return null
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const num = parseInt(h, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function getLuminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  // sRGB to luminance
  const srgb = ['r','g','b'].map(k => {
    let v = rgb[k] / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

function pickContrastingTextColor(bgHex) {
  if (!isHex(bgHex)) return '#ffffff'
  const L = getLuminance(bgHex)
  return L > 0.5 ? '#111111' : '#ffffff'
}

// WCAG contrast ratio between two hex colors
function contrastRatio(hex1, hex2) {
  if (!isHex(hex1) || !isHex(hex2)) return 4.5
  const L1 = getLuminance(hex1)
  const L2 = getLuminance(hex2)
  const light = Math.max(L1, L2)
  const dark = Math.min(L1, L2)
  return (light + 0.05) / (dark + 0.05)
}

// Ensure readable text color against solid or gradient backgrounds
function ensureReadableTextColor({ bg, primary, secondary, proposed }) {
  const black = '#111111'
  const white = '#ffffff'

  // If a solid background is present, validate proposed vs bg
  if (isHex(bg)) {
    if (isHex(proposed) && contrastRatio(proposed, bg) >= 4.5) return proposed
    // pick between black/white
    return contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white
  }

  // Simple vertical collision resolver for text blocks
  // Ensures blocks (company, name, title, contacts) don't overlap by nudging downward
  const resolveOverlaps = (pos, sizes) => {
    const keys = ['company', 'name', 'title', 'contacts']
    const estHeight = (k) => {
      if (k === 'name') return Math.round((sizes.name || 20) * 1.25)
      if (k === 'title') return Math.round((sizes.title || 16) * 1.2)
      if (k === 'company') return Math.round((sizes.company || 14) * 1.15)
      if (k === 'contacts') return 56 // multi-line small text block
      return 18
    }
    const spacing = 6
    const items = keys
      .filter((k) => pos[k])
      .map((k) => ({ key: k, x: pos[k].x, y: pos[k].y, h: estHeight(k) }))
      .sort((a, b) => a.y - b.y)

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]
      const cur = items[i]
      const overlap = prev.y + prev.h + spacing - cur.y
      if (overlap > 0) {
        cur.y += overlap
      }
    }

    // Clamp within card bounds
    const maxY = cardHeight - 10
    items.forEach((it) => { it.y = Math.min(it.y, maxY) })

    const adjusted = { ...pos }
    items.forEach((it) => {
      adjusted[it.key] = { x: it.x, y: it.y }
    })
    return adjusted
  }

  // No solid bg: consider gradient or primary/secondary pair
  const a = isHex(primary) ? primary : '#3b82f6'
  const b = isHex(secondary) ? secondary : '#1e40af'
  const passes = (c) => Math.min(contrastRatio(c, a), contrastRatio(c, b))
  if (isHex(proposed) && passes(proposed) >= 4.5) return proposed
  // choose the color that maximizes the worst-case contrast over both ends
  return passes('#111111') >= passes('#ffffff') ? '#111111' : '#ffffff'
}

// Normalize an AI suggestion to enforce sane defaults and hierarchy
function normalizeSuggestion(suggestion) {
  const s = JSON.parse(JSON.stringify(suggestion || {}))
  s.layout = s.layout || {}
  s.layout.elements = s.layout.elements || {}
  const el = s.layout.elements

  // Default positions if missing
  el.company = el.company || {}
  el.name = el.name || {}
  el.title = el.title || {}
  el.contacts = el.contacts || {}

  const pos = v => (typeof v === 'string' ? v.toLowerCase() : '')

  if (!el.company.position) el.company.position = 'top left'
  if (!el.name.position) el.name.position = 'center left'
  if (!el.title.position) el.title.position = 'center left'
  if (!el.contacts.position) el.contacts.position = 'bottom left'

  // Keep contacts away from top areas unless explicitly bottom/center-bottom/right-bottom
  if (pos(el.contacts.position).includes('top')) {
    el.contacts.position = 'bottom left'
  }

  

  // Allowed size keywords
  const sizeSafelist = ['small','medium','large','xlarge','xl']
  const ensureSize = (val, fallback) => {
    const v = (val || '').toString().toLowerCase()
    if (sizeSafelist.some(k => v.includes(k))) return val
    return fallback
  }
  el.company.size = ensureSize(el.company.size, 'medium')
  el.name.size = ensureSize(el.name.size, 'large')
  el.title.size = ensureSize(el.title.size, 'medium')

  // Palette/text contrast defaulting
  s.palette = s.palette || {}
  const p = s.palette
  // If no text color, derive from background or primary
  if (!p.text || !isHex(p.text)) {
    const bgCandidate = isHex(p.background) ? p.background : (isHex(p.primary) ? p.primary : '#3b82f6')
    p.text = pickContrastingTextColor(bgCandidate)
  }

  return s
}

// Mini preview for AI suggestion thumbnails
function MiniCardPreview({ suggestion }) {
  const W = 300
  const H = 172
  const normalized = normalizeSuggestion(suggestion)
  const palette = normalized?.palette || {}
  const bg = palette.background || null
  const primary = palette.primary || '#3b82f6'
  const secondary = palette.secondary || '#1e40af'
  const text = ensureReadableTextColor({ bg, primary, secondary, proposed: palette.text })
  const template = normalized?.template || 'modern'
  const typography = normalized?.typography || {}
  const fontFamily = typography.heading || typography.body || 'Inter, Arial, sans-serif'
  const shapes = normalized?.shapes || []

  const styleBase = {
    width: W,
    height: H,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid var(--panel-muted)',
    color: text,
    fontFamily
  }
  const styleBg = () => {
    if (bg) return { background: bg }
    if (template === 'classic') return { background: '#ffffff', border: `2px solid ${primary}` }
    if (template === 'minimal') return { background: '#ffffff', borderLeft: `4px solid ${primary}` }
    // default modern gradient if no bg provided
    return { background: `linear-gradient(135deg, ${primary}, ${secondary})` }
  }

  const renderShapeMini = (s, idx) => {
    if (!s || !s.type) return null
    const base = { position: 'absolute', opacity: s.opacity ?? 1, pointerEvents: 'none' }
    if (s.type === 'band') {
      const width = Math.round((s.widthPct ?? 140) * W / 100)
      const height = s.heightPx ?? 60
      const x = (s.offsetX ?? 0)
      const y = (s.offsetY ?? 0)
      return (
        <div key={idx}
          style={{
            ...base,
            left: x,
            top: y,
            width,
            height,
            background: s.color || primary,
            transform: `rotate(${s.angle ?? 0}deg)`,
            borderRadius: 12
          }}
        />
      )
    }
    if (s.type === 'arc') {
      const size = s.sizePx ?? 200
      const pos = (s.position || 'top-right').toLowerCase()
      const st = { ...base, width: size, height: size, background: s.color || primary, borderRadius: '50%' }
      if (pos.includes('top')) st.top = (s.offsetY ?? -40)
      if (pos.includes('bottom')) st.bottom = (s.offsetY ?? -40)
      if (pos.includes('left')) st.left = (s.offsetX ?? -40)
      if (pos.includes('right')) st.right = (s.offsetX ?? -40)
      return <div key={idx} style={st} />
    }
    if (s.type === 'curve') {
      const width = Math.round((s.widthPct ?? 160) * W / 100)
      const height = s.heightPx ?? 120
      const pos = (s.position || 'bottom-left').toLowerCase()
      const st = { ...base, width, height, background: s.color || secondary, transform: `rotate(${s.angle ?? 0}deg)` }
      st.borderRadius = `${Math.round(height)}px / ${Math.round(height)}px`
      if (pos.includes('top')) st.top = (s.offsetY ?? -20)
      if (pos.includes('bottom')) st.bottom = (s.offsetY ?? -20)
      if (pos.includes('left')) st.left = (s.offsetX ?? -40)
      if (pos.includes('right')) st.right = (s.offsetX ?? -40)
      return <div key={idx} style={st} />
    }
    return null
  }

  const sizeToPxMini = (kind, value) => {
    const v = (value || '').toString().toLowerCase()
    const map = { name: { small: 14, medium: 16, large: 20 }, title: { small: 10, medium: 12, large: 14 }, company: { small: 10, medium: 12, large: 14 } }
    const m = map[kind] || {}
    if (v.includes('x-large') || v.includes('xl')) return (m.large || 18)
    if (v.includes('large') || v.includes('lg')) return (m.large || 18)
    if (v.includes('medium') || v.includes('md')) return (m.medium || 14)
    if (v.includes('small') || v.includes('sm')) return (m.small || 12)
    const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
    return Number.isNaN(n) ? (kind === 'name' ? 16 : kind === 'title' ? 12 : 12) : Math.max(10, Math.min(22, Math.round(n * 0.6)))
  }

  const positionToCoordsMini = (label) => {
    const l = (label || '').toString().toLowerCase()
    const padding = 12
    const centers = { x: W / 2 - 80, y: H / 2 - 8 }
    if (l.includes('top') && l.includes('left')) return { x: padding, y: padding }
    if (l.includes('top') && l.includes('center')) return { x: centers.x, y: padding }
    if (l.includes('top') && l.includes('right')) return { x: W - 160 - padding, y: padding }
    if ((l.includes('center') || l.includes('middle')) && l.includes('left')) return { x: padding, y: centers.y }
    if (l.includes('center') || l.includes('middle')) return { x: centers.x, y: centers.y }
    if ((l.includes('center') || l.includes('middle')) && l.includes('right')) return { x: W - 160 - padding, y: centers.y }
    if (l.includes('bottom') && l.includes('left')) return { x: padding, y: H - 50 }
    if (l.includes('bottom') && l.includes('center')) return { x: centers.x, y: H - 50 }
    if (l.includes('bottom') && l.includes('right')) return { x: W - 160 - padding, y: H - 50 }
    return { x: padding, y: padding }
  }

  const elements = (normalized?.layout && normalized.layout.elements) || {}
  const nameMeta = elements.name || {}
  const titleMeta = elements.title || {}
  const companyMeta = elements.company || {}

  const namePos = positionToCoordsMini(nameMeta.position)
  const titlePos = positionToCoordsMini(titleMeta.position)
  const companyPos = positionToCoordsMini(companyMeta.position)

  const sample = normalized?.content || {}

  return (
    <div style={{ ...styleBase, ...styleBg(), boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
      {/* Decorative shapes */}
      {shapes.map((s, idx) => renderShapeMini(s, idx))}
      <div style={{ position: 'absolute', left: companyPos.x, top: companyPos.y, fontSize: sizeToPxMini('company', companyMeta.size), opacity: 0.95 }}>
        {sample.company || 'Company'}
      </div>
      <div style={{ position: 'absolute', left: namePos.x, top: namePos.y + 20, fontWeight: 600, fontSize: sizeToPxMini('name', nameMeta.size) }}>
        {sample.name || 'Your Name'}
      </div>
      <div style={{ position: 'absolute', left: titlePos.x, top: titlePos.y + 44, fontSize: sizeToPxMini('title', titleMeta.size), opacity: 0.9 }}>
        {sample.title || 'Title'}
      </div>
    </div>
  )
}

const CardCreator = () => {
  const [cardData, setCardData] = useState({
    name: '',
    title: '',
    company: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    extra: ''
  })

  const [design, setDesign] = useState({
    template: 'modern',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    font: 'Inter',
    logoUrl: '',
    qrCode: ''
  })

  const [aiSuggestions, setAiSuggestions] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationMode, setGenerationMode] = useState('svg') // 'svg' | 'png'

  // Template library pagination
  const [templatesPage, setTemplatesPage] = useState(1)
  const pageSize = 24
  const totalPages = Math.ceil((GENERATED_TEMPLATES?.length || 0) / pageSize) || 1
  const currentTemplates = GENERATED_TEMPLATES.slice((templatesPage - 1) * pageSize, templatesPage * pageSize)

  // Dynamic controls state
  const [nameSize, setNameSize] = useState(22)
  const [titleSize, setTitleSize] = useState(14)
  const [companySize, setCompanySize] = useState(12)
  const [nameColor, setNameColor] = useState('#ffffff')
  const [titleColor, setTitleColor] = useState('#ffffff')
  const [companyColor, setCompanyColor] = useState('#ffffff')
  const [bodyColor, setBodyColor] = useState('#ffffff')
  const [align, setAlign] = useState('left') // 'left' | 'center' | 'right'
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [bgType, setBgType] = useState('auto') // 'auto' | 'solid' | 'gradient'
  const [bgColor, setBgColor] = useState('#1f2937')
  const [gradFrom, setGradFrom] = useState('#3b82f6')
  const [gradTo, setGradTo] = useState('#1e40af')
  const [gradAngle, setGradAngle] = useState(135)

  // Draggable positions for each text block
  const [positions, setPositions] = useState({
    name: { x: 20, y: 30 },
    title: { x: 20, y: 70 },
    company: { x: 20, y: 100 },
    contacts: { x: 20, y: 140 }
  })

  // Positioning behavior
  const [locked, setLocked] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [gridSize, setGridSize] = useState(8)
  // Keep house layout when applying AI (AI only skins palette/typography)
  const [useHouseLayout, setUseHouseLayout] = useState(true)

  const cardRef = useRef(null)
  const draggingKeyRef = useRef(null)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 })
  const [cardWidth, setCardWidth] = useState(500)
  const [cardHeight, setCardHeight] = useState(280)

  // Icons state
  const [icons, setIcons] = useState([]) // {id: string, iconId: string, x,y,size,color}
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  // Assets: background image and draggable images/logos
  const [bgImageUrl, setBgImageUrl] = useState('')
  const [images, setImages] = useState([]) // { id, src, x, y, width, height, rotation, brightness, contrast, saturation, hue, opacity }
  const [selectedImageId, setSelectedImageId] = useState(null)
  // Decorative shapes (bands/arcs/curves) from templates
  const [shapes, setShapes] = useState([])

  // Asset handlers
  const onSetBackground = (url) => setBgImageUrl(url)
  const onAddLogo = (url) => {
    if (!url) return
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    setImages(prev => ([
      ...prev,
      { id, src: url, x: 24, y: 24, width: 80, height: 80, rotation: 0, brightness: 1, contrast: 1, saturation: 1, hue: 0, opacity: 1 }
    ]))
    setSelectedImageId(id)
  }
  const onRemoveLogo = (url) => setImages(prev => prev.filter(it => it.src !== url))

// Helpers to update selected image
const updateSelectedImage = (partial) => {
  if (!selectedImageId) return
  setImages(prev => prev.map(it => it.id === selectedImageId ? { ...it, ...partial } : it))
}
const deleteSelectedImage = () => {
  if (!selectedImageId) return
  setImages(prev => prev.filter(it => it.id !== selectedImageId))
  setSelectedImageId(null)
}

  const templates = [
    { id: 'modern', name: 'Modern', preview: '🎯' },
    { id: 'classic', name: 'Classic', preview: '📋' },
    { id: 'creative', name: 'Creative', preview: '🎨' },
    { id: 'minimal', name: 'Minimal', preview: '⚡' },
    { id: 'corporate', name: 'Corporate', preview: '🏢' },
    { id: 'tech', name: 'Tech', preview: '💻' }
  ]

  // Opinionated house layout templates (positions only)
  const houseTemplates = [
    { id: 'left-grid', name: 'Left Grid', desc: 'Company top-left, name/title below, contacts bottom-left' },
    { id: 'centered', name: 'Centered', desc: 'Identity centered, contacts bottom-center' },
    { id: 'split-banner', name: 'Split Banner', desc: 'Company top-left, name/title center-left, contacts bottom-left' }
  ]

  // Auto tidy: reflow to a clean, readable grid based on current card size and align
  const tidyLayout = () => {
    const padding = 24
    const w = cardWidth, h = cardHeight
    const midX = Math.round(w / 2)
    const leftX = padding
    const rightX = Math.max(padding, w - 220)
    const centerX = Math.max(padding, midX - 110)

    const base = {
      name: { x: leftX, y: 80 },
      title: { x: leftX, y: 110 },
      company: { x: leftX, y: 48 },
      contacts: { x: leftX, y: h - 90 }
    }
    if (align === 'center') {
      base.company = { x: centerX, y: 56 }
      base.name = { x: centerX, y: 92 }
      base.title = { x: centerX, y: 122 }
      base.contacts = { x: centerX, y: h - 90 }
    } else if (align === 'right') {
      base.company = { x: rightX, y: 48 }
      base.name = { x: rightX, y: 80 }
      base.title = { x: rightX, y: 110 }
      base.contacts = { x: rightX, y: h - 90 }
    }
    setPositions(base)
    // Enforce readable hierarchy
    setNameSize(s => Math.max(22, s))
    setTitleSize(t => Math.min(Math.max(12, t), nameSize - 2))
    setCompanySize(c => Math.min(Math.max(11, c), Math.max(12, titleSize - 1)))
  }

  // Apply an opinionated house template (positions only)
  const applyHouseTemplate = (tplId) => {
    const padding = 24
    const w = cardWidth, h = cardHeight
    if (tplId === 'left-grid') {
      setPositions({ name: { x: padding, y: 80 }, title: { x: padding, y: 110 }, company: { x: padding, y: 48 }, contacts: { x: padding, y: h - 90 } })
      setAlign('left')
    } else if (tplId === 'centered') {
      const cx = Math.max(padding, Math.round(w / 2) - 110)
      setPositions({ name: { x: cx, y: 92 }, title: { x: cx, y: 122 }, company: { x: cx, y: 56 }, contacts: { x: cx, y: h - 90 } })
      setAlign('center')
    } else if (tplId === 'split-banner') {
      const leftX = padding
      const centerLeft = Math.max(padding, Math.round(w / 2) - 140)
      setPositions({ name: { x: centerLeft, y: 96 }, title: { x: centerLeft, y: 126 }, company: { x: leftX, y: 48 }, contacts: { x: leftX, y: h - 90 } })
      setAlign('left')
    }
  }

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ]

  const generateAIDesign = async () => {
    if (!cardData.name || !cardData.company) {
      alert('Please fill in at least your name and company to generate AI suggestions')
      return
    }

    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/generate-card-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cardData,
          industry: getIndustryFromData(),
          count: 10
        })
      })

      const suggestions = await response.json()
      setAiSuggestions(suggestions.designs || [])
    } catch (error) {
      console.error('Error generating AI design:', error)
      alert('Error generating AI design. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // AI vector (SVG) generation via backend
  const generateAISVG = async () => {
    if (!cardData.name || !cardData.company) {
      alert('Please fill in at least your name and company to generate AI SVG')
      return
    }
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-card-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardData,
          options: {
            width: cardWidth,
            height: cardHeight,
            template: design.template,
            palette: {
              primary: design.primaryColor,
              secondary: design.secondaryColor,
              background: design.backgroundColor,
              text: bodyColor
            },
            font: design.font
          }
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate SVG')
      }
      const svg = data?.svg
      if (!svg || typeof svg !== 'string') {
        alert('The AI did not return a valid SVG. Please try again.')
        return
      }
      // Open SVG in a new tab for preview/download
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      console.error('AI SVG error:', err)
      alert(`Error generating AI SVG: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  // AI raster (PNG) generation via backend
  const generateAIImage = async () => {
    if (!cardData.name || !cardData.company) {
      alert('Please fill in at least your name and company to generate AI Image')
      return
    }
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-card-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardData,
          industry: getIndustryFromData(),
          size: { width: cardWidth, height: cardHeight }
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate image')
      }
      const imageBase64 = data?.imageBase64
      if (!imageBase64) {
        alert('No image returned by AI. Please try again.')
        return
      }
      const link = document.createElement('a')
      link.download = `business-card-${cardData.name}.png`
      link.href = `data:image/png;base64,${imageBase64}`
      link.click()
    } catch (err) {
      console.error('AI Image error:', err)
      alert(`Error generating AI Image: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const getIndustryFromData = () => {
    const title = cardData.title.toLowerCase()
    if (title.includes('tech') || title.includes('developer') || title.includes('engineer')) {
      return 'technology'
    }
    if (title.includes('design') || title.includes('creative') || title.includes('art')) {
      return 'creative'
    }
    if (title.includes('doctor') || title.includes('medical') || title.includes('health')) {
      return 'healthcare'
    }
    return 'business'
  }

  const generateQRCode = async () => {
    if (!cardData.website && !cardData.email) {
      alert('Please add a website or email to generate QR code')
      return
    }

    try {
      const qrData = cardData.website || `mailto:${cardData.email}`
      const qrCodeUrl = await QRCode.toDataURL(qrData)
      setDesign(prev => ({ ...prev, qrCode: qrCodeUrl }))
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const exportCard = async (format) => {
    const cardElement = document.getElementById('business-card-preview')
    
    if (format === 'png') {
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 3
      })
      
      const link = document.createElement('a')
      link.download = `business-card-${cardData.name}.png`
      link.href = canvas.toDataURL()
      link.click()
    } else if (format === 'pdf') {
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 3
      })
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [89, 51] // Standard business card size
      })
      
      pdf.addImage(canvas.toDataURL(), 'PNG', 0, 0, 89, 51)
      pdf.save(`business-card-${cardData.name}.pdf`)
    }
  }

  const handleInputChange = (field, value) => {
    setCardData(prev => ({ ...prev, [field]: value }))
  }

  const handleDesignChange = (field, value) => {
    setDesign(prev => ({ ...prev, [field]: value }))
  }

  // On mount: restore cached font if present
  useEffect(() => {
    try {
      const cachedFont = localStorage.getItem('card_font')
      if (cachedFont) {
        setDesign(prev => ({ ...prev, font: cachedFont }))
        loadGoogleFont(cachedFont)
      }
    } catch (_) { /* ignore */ }
  }, [])

  // Map common AI size keywords to pixel values for our UI
  const sizeToPx = (kind, value) => {
    const v = (value || '').toString().toLowerCase()
    const map = {
      name: { small: 18, medium: 22, large: 28, xlarge: 32 },
      title: { small: 12, medium: 14, large: 16 },
      company: { small: 11, medium: 12, large: 14 }
    }
    const m = map[kind] || {}
    if (v.includes('x-large') || v.includes('xl')) return m.xlarge || m.large || 28
    if (v.includes('large') || v.includes('lg')) return m.large || 24
    if (v.includes('medium') || v.includes('md')) return m.medium || 16
    if (v.includes('small') || v.includes('sm')) return m.small || 12
    // fallback: try to parse number like '24px'
    const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(n)) return n
    return kind === 'name' ? 22 : kind === 'title' ? 14 : 12
  }

  // Convert AI position labels into approximate coordinates on our card
  const positionToCoords = (label) => {
    const l = (label || '').toString().toLowerCase()
    const w = cardWidth, h = cardHeight
    const padding = 20
    const centers = { x: w / 2 - 100, y: h / 2 - 10 }
    if (l.includes('top') && l.includes('left')) return { x: padding, y: padding + 10 }
    if (l.includes('top') && l.includes('center')) return { x: centers.x, y: padding + 10 }
    if (l.includes('top') && l.includes('right')) return { x: w - 200 - padding, y: padding + 10 }
    if ((l.includes('center') || l.includes('middle')) && l.includes('left')) return { x: padding, y: centers.y }
    if (l.includes('center') || l.includes('middle')) return { x: centers.x, y: centers.y }
    if ((l.includes('center') || l.includes('middle')) && l.includes('right')) return { x: w - 200 - padding, y: centers.y }
    if (l.includes('bottom') && l.includes('left')) return { x: padding, y: h - 80 }
    if (l.includes('bottom') && l.includes('center')) return { x: centers.x, y: h - 80 }
    if (l.includes('bottom') && l.includes('right')) return { x: w - 200 - padding, y: h - 80 }
    // defaults
    return { x: padding, y: padding + 10 }
  }

  // Apply AI suggestion to current design (template, colors, font, sizes, positions)
  const applyAiSuggestion = (suggestion, opts = {}) => {
    if (!suggestion) return
    const normalized = normalizeSuggestion(suggestion)

    const nextDesign = {}
    // Template
    if (normalized.template) nextDesign.template = normalized.template
    // Palette with contrast-aware text
    const palette = normalized.palette || {}
    if (isValidHexColor(palette.primary)) nextDesign.primaryColor = palette.primary
    if (isValidHexColor(palette.secondary)) nextDesign.secondaryColor = palette.secondary
    if (isValidHexColor(palette.background)) nextDesign.backgroundColor = palette.background
    if (typeof normalized.font === 'string') nextDesign.font = normalized.font

    // Compute safe text color regardless of what AI sent
    const safeText = ensureReadableTextColor({
      bg: isHex(palette.background) ? palette.background : null,
      primary: palette.primary || design.primaryColor,
      secondary: palette.secondary || design.secondaryColor,
      proposed: palette.text || design.textColor
    })
    nextDesign.textColor = safeText
    // Typography
    const typography = normalized.typography || {}
    if (typography.heading || typography.body) {
      const chosen = typography.heading || typography.body
      nextDesign.font = chosen
      loadGoogleFont(chosen)
      try { localStorage.setItem('card_font', chosen) } catch (_) { /* ignore */ }
    }
    setDesign(prev => ({ ...prev, ...nextDesign }))
    // Also update per-element colors to ensure visibility in the main preview
    setNameColor(safeText)
    setTitleColor(safeText)
    setCompanyColor(safeText)
    setBodyColor(safeText)
    // Apply decorative shapes
    setShapes(Array.isArray(normalized.shapes) ? normalized.shapes : [])

    // Sizes and positions (with hierarchy and layout guards)
    const elements = (normalized.layout && normalized.layout.elements) || {}
    const nameMeta = elements.name || {}
    const titleMeta = elements.title || {}
    const companyMeta = elements.company || {}
    const contactsMeta = elements.contacts || {}

    const shouldApplyPositions = Boolean(opts.forcePositions) || !useHouseLayout
    if (shouldApplyPositions) {
      let namePx = sizeToPx('name', nameMeta.size)
      let titlePx = sizeToPx('title', titleMeta.size)
      let companyPx = sizeToPx('company', companyMeta.size)
      // Enforce hierarchy: name >= title >= company
      titlePx = Math.min(titlePx, namePx - 2)
      companyPx = Math.min(companyPx, titlePx - 1)
      // Clamp floors
      namePx = Math.max(18, namePx)
      titlePx = Math.max(12, titlePx)
      companyPx = Math.max(11, companyPx)

      setNameSize(namePx)
      setTitleSize(titlePx)
      setCompanySize(companyPx)

      let newPositions = { ...positions }
      if (nameMeta.position) newPositions.name = positionToCoords(nameMeta.position)
      if (titleMeta.position) newPositions.title = positionToCoords(titleMeta.position)
      if (companyMeta.position) newPositions.company = positionToCoords(companyMeta.position)
      if (contactsMeta.position) newPositions.contacts = positionToCoords(contactsMeta.position)
      // De-overlap text blocks
      newPositions = resolveOverlaps(newPositions, { name: namePx, title: titlePx, company: companyPx })
      setPositions(newPositions)

      // Adjust text alignment to better match template intent
      const posStr = (nameMeta.position || '').toString().toLowerCase()
      if (posStr.includes('right')) setAlign('right')
      else if (posStr.includes('center') && !posStr.includes('left') && !posStr.includes('right')) setAlign('center')
      else setAlign('left')
    }
  }

  // Load Google Font dynamically based on AI suggestion
  const loadGoogleFont = (family) => {
    if (!family) return
    const id = `gf-${family.replace(/\s+/g, '-')}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    const familyParam = family.replace(/\s+/g, '+')
    link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@300;400;500;600;700&display=swap`
    document.head.appendChild(link)
  }

  // Validate hex colors like #RGB or #RRGGBB
  const isValidHexColor = (val) => {
    return typeof val === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val.trim())
  }

  // Compute card wrapper style including background logic
  const getCardStyle = () => {
    const baseStyle = {
      color: bodyColor,
      fontFamily: design.font || 'Inter, Arial, sans-serif',
      width: `${cardWidth}px`,
      height: `${cardHeight}px`,
      position: 'relative',
      overflow: 'hidden'
    }

    // Background image wins over everything
    if (bgImageUrl) {
      return {
        ...baseStyle,
        background: `url("${bgImageUrl}") center/cover no-repeat`
      }
    }

    // Manual background modes
    if (bgType === 'solid') {
      return { ...baseStyle, background: bgColor }
    }
    if (bgType === 'gradient') {
      return { ...baseStyle, background: `linear-gradient(${gradAngle}deg, ${gradFrom}, ${gradTo})` }
    }

    // Auto mode: derive from template/design
    const hasBg = isValidHexColor(design.backgroundColor)
    if (design.template === 'classic') {
      return {
        ...baseStyle,
        background: hasBg ? design.backgroundColor : '#ffffff',
        border: `2px solid ${design.primaryColor}`
      }
    }
    if (design.template === 'minimal') {
      return {
        ...baseStyle,
        background: hasBg ? design.backgroundColor : '#ffffff',
        borderLeft: `4px solid ${design.primaryColor}`
      }
    }
    // default/modern/others: gradient if no explicit background
    return {
      ...baseStyle,
      background: hasBg
        ? design.backgroundColor
        : `linear-gradient(135deg, ${design.primaryColor}, ${design.secondaryColor})`
    }
  }

  // Render decorative shapes in main preview
  const renderShape = (s, idx) => {
    if (!s || !s.type) return null
    const base = { position: 'absolute', opacity: s.opacity ?? 1, pointerEvents: 'none' }
    if (s.type === 'band') {
      const width = Math.round((s.widthPct ?? 140) * cardWidth / 100)
      const height = s.heightPx ?? 70
      const x = (s.offsetX ?? 0)
      const y = (s.offsetY ?? 0)
      return (
        <div key={idx}
          style={{
            ...base,
            left: x,
            top: y,
            width,
            height,
            background: s.color || design.primaryColor,
            transform: `rotate(${s.angle ?? 0}deg)`,
            borderRadius: 14,
            zIndex: 0
          }}
        />
      )
    }
    if (s.type === 'arc') {
      const size = s.sizePx ?? Math.min(cardWidth, cardHeight)
      const pos = (s.position || 'top-right').toLowerCase()
      const st = { ...base, width: size, height: size, background: s.color || design.primaryColor, borderRadius: '50%', zIndex: 0 }
      if (pos.includes('top')) st.top = (s.offsetY ?? -40)
      if (pos.includes('bottom')) st.bottom = (s.offsetY ?? -40)
      if (pos.includes('left')) st.left = (s.offsetX ?? -40)
      if (pos.includes('right')) st.right = (s.offsetX ?? -40)
      return <div key={idx} style={st} />
    }
    if (s.type === 'curve') {
      const width = Math.round((s.widthPct ?? 160) * cardWidth / 100)
      const height = s.heightPx ?? Math.round(cardHeight * 0.45)
      const pos = (s.position || 'bottom-left').toLowerCase()
      const st = { ...base, width, height, background: s.color || design.secondaryColor, transform: `rotate(${s.angle ?? 0}deg)`, zIndex: 0 }
      st.borderRadius = `${Math.round(height)}px / ${Math.round(height)}px`
      if (pos.includes('top')) st.top = (s.offsetY ?? -20)
      if (pos.includes('bottom')) st.bottom = (s.offsetY ?? -20)
      if (pos.includes('left')) st.left = (s.offsetX ?? -40)
      if (pos.includes('right')) st.right = (s.offsetX ?? -40)
      return <div key={idx} style={st} />
    }
    return null
  }

  const contentWrapperStyle = {
    textAlign: align,
    transform: `translate(${offsetX}px, ${offsetY}px)`
  }

  // Utility to clamp a value between min and max
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

  const snap = (v) => (gridSize > 0 ? Math.round(v / gridSize) * gridSize : v)

  // Begin dragging a specific key ('name' | 'title' | 'company' | 'contacts')
  const onDragStart = (key, e) => {
    if (locked) return
    draggingKeyRef.current = key
    const isTouch = e.type === 'touchstart'
    const point = isTouch ? e.touches[0] : e
    dragStartRef.current = {
      mouseX: point.clientX,
      mouseY: point.clientY,
      startX: positions[key].x,
      startY: positions[key].y
    }

    // Add listeners on document to capture movement outside the element
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
    document.addEventListener('touchmove', onDragMove, { passive: false })
    document.addEventListener('touchend', onDragEnd)
  }

  const onDragMove = (e) => {
    if (locked) return
    if (!draggingKeyRef.current) return
    const key = draggingKeyRef.current
    const isTouch = e.type === 'touchmove'
    const point = isTouch ? e.touches[0] : e
    if (isTouch) e.preventDefault()

    const dx = point.clientX - dragStartRef.current.mouseX
    const dy = point.clientY - dragStartRef.current.mouseY

    let nextX = dragStartRef.current.startX + dx
    let nextY = dragStartRef.current.startY + dy

    // Clamp within card bounds
    const card = cardRef.current
    if (card) {
      const rect = card.getBoundingClientRect()
      // We don't know the exact element size here; add a small margin
      const maxX = rect.width - 20
      const maxY = rect.height - 20
      if (snapToGrid) {
        nextX = snap(nextX)
        nextY = snap(nextY)
      }
      setPositions(prev => ({
        ...prev,
        [key]: {
          x: clamp(nextX, 0, maxX),
          y: clamp(nextY, 0, maxY)
        }
      }))
    } else {
      if (snapToGrid) {
        nextX = snap(nextX)
        nextY = snap(nextY)
      }
      setPositions(prev => ({ ...prev, [key]: { x: nextX, y: nextY } }))
    }
  }

  const onDragEnd = () => {
    draggingKeyRef.current = null
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.removeEventListener('touchmove', onDragMove)
    document.removeEventListener('touchend', onDragEnd)
  }

  // Icons: persistence
  useEffect(() => {
    try {
      const cached = localStorage.getItem('card_icons')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) setIcons(parsed)
      }
    } catch (_) { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('card_icons', JSON.stringify(icons))
    } catch (_) { /* ignore */ }
  }, [icons])

  const addIcon = (iconId) => {
    const id = `icon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setIcons(prev => ([...prev, { id, iconId, x: 16 + prev.length * 8, y: 16 + prev.length * 8, size: 24, color: '#ffffff' }]))
    setIconPickerOpen(false)
  }

  const updateIcon = (id, partial) => {
    setIcons(prev => prev.map(it => it.id === id ? { ...it, ...partial } : it))
  }

  const clearIcons = () => setIcons([])

  // Persist positions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('card_positions', JSON.stringify(positions))
    } catch (_) { /* ignore */ }
  }, [positions])

  // Load positions on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('card_positions')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object') {
          setPositions(prev => ({ ...prev, ...parsed }))
        }
      }
    } catch (_) { /* ignore */ }
  }, [])

  const resetPositions = () => {
    const defaults = { name: { x: 20, y: 30 }, title: { x: 20, y: 70 }, company: { x: 20, y: 100 }, contacts: { x: 20, y: 140 } }
    setPositions(defaults)
  }

  return (
    <div className="creator-container">
      {/* Left tools column */}
      <div className="creator-leftbar animate-fade-up animate-delay-1">
        <h3>Design Tools</h3>

        <h4 style={{ marginTop: 'var(--spacing-2)' }}>Assets</h4>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
          <AssetManager
            title="Assets"
            onSetBackground={onSetBackground}
            onAddLogo={onAddLogo}
            onRemoveLogo={onRemoveLogo}
          />
        </div>

        <h4 style={{ marginTop: 'var(--spacing-2)' }}>Colors</h4>
        <div className="color-picker-grid">
          {colors.map(color => (
            <div
              key={color}
              className={`color-option ${design.primaryColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleDesignChange('primaryColor', color)}
            />
          ))}
        </div>

        {/* Icons controls */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Icons</h4>
        <div className="form-group" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setIconPickerOpen(true)}>➕ Add Icon</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={clearIcons}>🗑️ Clear</button>
        </div>

        {icons.length > 0 && (
          <div className="form-group" style={{ marginTop: 'var(--spacing-3)', display: 'grid', gap: 'var(--spacing-2)' }}>
            {icons.map(ic => {
              const meta = ICONS.find(m => m.id === ic.iconId)
              const Preview = meta?.Svg
              return (
                <div key={ic.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', background: 'var(--panel-muted)', borderRadius: 8 }}>
                    {Preview ? <Preview size={20} color={ic.color} /> : <span>{ic.iconId}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                    <label className="form-label" style={{ minWidth: 40 }}>Size</label>
                    <input
                      type="number"
                      className="input"
                      min="8"
                      max="128"
                      value={ic.size}
                      onChange={(e) => updateIcon(ic.id, { size: Math.max(8, Math.min(128, parseInt(e.target.value || '0', 10))) })}
                      style={{ width: 90 }}
                    />
                    <label className="form-label" style={{ minWidth: 48 }}>Color</label>
                    <input
                      type="color"
                      value={ic.color}
                      onChange={(e) => updateIcon(ic.id, { color: e.target.value })}
                    />
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIcons(prev => prev.filter(x => x.id !== ic.id))}
                    title="Delete icon"
                  >🗑️</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Layout controls */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Layout</h4>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
          <button
            className={`btn ${align === 'left' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAlign('left')}
            style={{ flex: 1 }}
          >
            Left
          </button>
          <button
            className={`btn ${align === 'center' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAlign('center')}
            style={{ flex: 1 }}
          >
            Center
          </button>
          <button
            className={`btn ${align === 'right' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAlign('right')}
            style={{ flex: 1 }}
          >
            Right
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">Offset X ({offsetX}px)</label>
          <input
            type="range"
            min="-200"
            max="200"
            value={offsetX}
            onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Offset Y ({offsetY}px)</label>
          <input
            type="range"
            min="-200"
            max="200"
            value={offsetY}
            onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
          />
        </div>

        {/* Layout helpers */}
        <div className="form-group" style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-3)' }}>
          <button className="btn btn-primary" onClick={tidyLayout}>✨ Auto tidy layout</button>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="keep-layout" type="checkbox" checked={useHouseLayout} onChange={(e) => setUseHouseLayout(e.target.checked)} />
          <label htmlFor="keep-layout" className="form-label" style={{ margin: 0 }}>Keep house layout when applying AI</label>
        </div>

        {/* House templates */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>House Templates</h4>
        <div style={{ display: 'grid', gap: '8px' }}>
          {houseTemplates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--panel-muted)', padding: '8px 10px', borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>{t.desc}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => applyHouseTemplate(t.id)}>Apply</button>
            </div>
          ))}
        </div>

        {/* Card size controls */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Card Size</h4>
        <div className="form-group">
          <label className="form-label">Width (px)</label>
          <input
            type="number"
            className="input"
            min="200"
            max="1200"
            value={cardWidth}
            onChange={(e) => setCardWidth(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Height (px)</label>
          <input
            type="number"
            className="input"
            min="120"
            max="800"
            value={cardHeight}
            onChange={(e) => setCardHeight(parseInt(e.target.value || '0', 10))}
          />
        </div>

        {/* Typography controls */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Typography</h4>
        <div className="form-group">
          <label className="form-label">Name Size ({nameSize}px)</label>
          <input
            type="range"
            min="12"
            max="48"
            value={nameSize}
            onChange={(e) => setNameSize(parseInt(e.target.value, 10))}
          />
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <label className="form-label" style={{ display: 'block' }}>Name Color</label>
            <input
              type="color"
              value={nameColor}
              onChange={(e) => setNameColor(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Title Size ({titleSize}px)</label>
          <input
            type="range"
            min="10"
            max="36"
            value={titleSize}
            onChange={(e) => setTitleSize(parseInt(e.target.value, 10))}
          />
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <label className="form-label" style={{ display: 'block' }}>Title Color</label>
            <input
              type="color"
              value={titleColor}
              onChange={(e) => setTitleColor(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Company Size ({companySize}px)</label>
          <input
            type="range"
            min="10"
            max="30"
            value={companySize}
            onChange={(e) => setCompanySize(parseInt(e.target.value, 10))}
          />
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <label className="form-label" style={{ display: 'block' }}>Company Color</label>
            <input
              type="color"
              value={companyColor}
              onChange={(e) => setCompanyColor(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Contacts/Text Color</label>
          <input
            type="color"
            value={bodyColor}
            onChange={(e) => setBodyColor(e.target.value)}
          />
        </div>

        {/* Background controls */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Background</h4>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
          <button
            className={`btn ${bgType === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBgType('auto')}
            style={{ flex: 1 }}
          >
            Auto
          </button>
          <button
            className={`btn ${bgType === 'solid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBgType('solid')}
            style={{ flex: 1 }}
          >
            Solid
          </button>
          <button
            className={`btn ${bgType === 'gradient' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBgType('gradient')}
            style={{ flex: 1 }}
          >
            Gradient
          </button>
        </div>

        {bgType === 'solid' && (
          <div className="form-group">
            <label className="form-label">Background Color</label>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
            />
          </div>
        )}

        {bgType === 'gradient' && (
          <div>
            <div className="form-group">
              <label className="form-label">From</label>
              <input
                type="color"
                value={gradFrom}
                onChange={(e) => setGradFrom(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input
                type="color"
                value={gradTo}
                onChange={(e) => setGradTo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Angle ({gradAngle}°)</label>
              <input
                type="range"
                min="0"
                max="360"
                value={gradAngle}
                onChange={(e) => setGradAngle(parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <button 
            onClick={generateQRCode} 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
          >
            📱 Add QR Code
          </button>
        </div>

        {/* Positioning behavior controls */}
        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Positioning</h4>
        <div className="form-group" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <button
            className={`btn ${locked ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setLocked(v => !v)}
          >
            {locked ? 'Unlock' : 'Lock'}
          </button>
          <button
            className={`btn ${snapToGrid ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setSnapToGrid(v => !v)}
          >
            {snapToGrid ? 'Snap: On' : 'Snap: Off'}
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">Grid Size (px)</label>
          <input
            type="number"
            className="input"
            min="1"
            max="64"
            value={gridSize}
            onChange={(e) => setGridSize(Math.max(1, parseInt(e.target.value || '8', 10)))}
          />
        </div>
        <div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={resetPositions}>↩️ Reset Positions</button>
        </div>

        {/* Icon Picker modal */}
        <IconPicker open={iconPickerOpen} onClose={() => setIconPickerOpen(false)} onSelect={addIcon} />
      </div>

      <div className="creator-main animate-fade-up animate-delay-2">
        <div className="preview-sticky-wrap" style={{ marginBottom: 'var(--spacing-6)' }}>
          <h2>Business Card Preview</h2>
          <div ref={cardRef} className="business-card-preview animate-scale-in" id="business-card-preview" style={getCardStyle()}>
            {(() => { /* small left padding boost for text when left-aligned */ })()}
            {/* Decorative shapes below all content */}
            {shapes.map((s, idx) => renderShape(s, idx))}
            {design.qrCode && (
              <img 
                src={design.qrCode} 
                alt="QR Code" 
                style={{ 
                  position: 'absolute', 
                  top: '10px', 
                  right: '10px', 
                  width: '40px', 
                  height: '40px' 
                }} 
              />
            )}

            {/* Placeholder initials logo — shown only when there are no logos */}
            {images.length === 0 && (
              <div
                title="Placeholder logo (hidden when you add a logo)"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: design.primaryColor,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: 0.5,
                  zIndex: 5,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                }}
              >
                {(() => {
                  const name = (cardData.name || '').trim()
                  if (!name) return 'AA'
                  const parts = name.split(/\s+/).filter(Boolean)
                  const a = parts[0]?.[0]?.toUpperCase() || 'A'
                  const b = parts[1]?.[0]?.toUpperCase() || parts[0]?.[1]?.toUpperCase() || 'A'
                  return `${a}${b}`
                })()}
              </div>
            )}

            {/* Draggable images/logos */}
            {images.map(img => {
              const shapeStyle =
                img.shape === 'circle' ? { borderRadius: '50%' } :
                img.shape === 'rounded' ? { borderRadius: 12 } :
                img.shape === 'oval' ? { borderRadius: '50% / 35%' } :
                img.shape === 'diamond' ? { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' } :
                img.shape === 'hexagon' ? { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' } :
                {}
              return (
                <DraggableImage
                  key={img.id}
                  src={img.src}
                  x={img.x}
                  y={img.y}
                  width={img.width}
                  height={img.height}
                  rotation={img.rotation}
                  locked={locked}
                  snapToGrid={snapToGrid}
                  gridSize={gridSize}
                  getBounds={() => cardRef.current?.getBoundingClientRect()}
                  style={{ zIndex: 10 }}
                  imageStyle={shapeStyle}
                  // selection + resize
                  selected={selectedImageId === img.id}
                  onSelect={() => setSelectedImageId(img.id)}
                  // filters
                  brightness={img.brightness}
                  contrast={img.contrast}
                  saturation={img.saturation}
                  hue={img.hue}
                  opacity={img.opacity}
                  onChange={(partial) => {
                    setImages(prev => prev.map(it => it.id === img.id ? { ...it, ...partial } : it))
                  }}
                />
              )
            })}

            {/* Icons */}
            {icons.map(ic => (
              <DraggableIcon
                key={ic.id}
                iconId={ic.iconId}
                x={ic.x}
                y={ic.y}
                size={ic.size}
                color={ic.color}
                locked={locked}
                snapToGrid={snapToGrid}
                gridSize={gridSize}
                getBounds={() => cardRef.current?.getBoundingClientRect()}
                onChange={({ x, y }) => updateIcon(ic.id, { x, y })}
              />
            ))}

            {/* Draggable text blocks */}
            {(() => { const padX = align === 'left' ? 16 : 0; return (
            <div style={{ position: 'absolute', left: positions.name.x + padX, top: positions.name.y, zIndex: 1, cursor: 'move' }}
                 onMouseDown={(e) => onDragStart('name', e)}
                 onTouchStart={(e) => onDragStart('name', e)}>
              <h3 style={{ margin: 0, fontSize: `${nameSize}px`, color: nameColor }}>
                {cardData.name || 'Your Name'}
              </h3>
            </div>
            )})()}

            {(() => { const padX = align === 'left' ? 16 : 0; return (
            <div style={{ position: 'absolute', left: positions.title.x + padX, top: positions.title.y, zIndex: 1, cursor: 'move' }}
                 onMouseDown={(e) => onDragStart('title', e)}
                 onTouchStart={(e) => onDragStart('title', e)}>
              <p style={{ margin: 0, opacity: 0.9, fontSize: `${titleSize}px`, color: titleColor }}>
                {cardData.title || 'Your Title'}
              </p>
            </div>
            )})()}

            {(() => { const padX = align === 'left' ? 16 : 0; return (
            <div style={{ position: 'absolute', left: positions.company.x + padX, top: positions.company.y, zIndex: 1, cursor: 'move' }}
                 onMouseDown={(e) => onDragStart('company', e)}
                 onTouchStart={(e) => onDragStart('company', e)}>
              <p style={{ margin: 0, opacity: 0.9, fontSize: `${companySize}px`, color: companyColor }}>
                {cardData.company || 'Your Company'}
              </p>
            </div>
            )})()}

            {(() => { const padX = align === 'left' ? 16 : 0; return (
            <div style={{ position: 'absolute', left: positions.contacts.x + padX, top: positions.contacts.y, zIndex: 1, cursor: 'move', color: bodyColor }}
                 onMouseDown={(e) => onDragStart('contacts', e)}
                 onTouchStart={(e) => onDragStart('contacts', e)}>
                <div style={{ margin: 0, fontSize: '12px', opacity: 0.9, display: 'grid', gap: 6 }}>
                {cardData.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(() => { const Icon = getIconById('email')?.Svg; return Icon ? <Icon size={14} color={bodyColor} /> : null })()}
                    <span>{cardData.email}</span>
                  </div>
                )}
                {cardData.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(() => { const Icon = getIconById('phone')?.Svg; return Icon ? <Icon size={14} color={bodyColor} /> : null })()}
                    <span>{cardData.phone}</span>
                  </div>
                )}
                {cardData.website && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(() => { const Icon = getIconById('globe')?.Svg; return Icon ? <Icon size={14} color={bodyColor} /> : null })()}
                    <span>{cardData.website}</span>
                  </div>
                )}
                {cardData.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(() => { const Icon = getIconById('location')?.Svg; return Icon ? <Icon size={14} color={bodyColor} /> : null })()}
                    <span>{cardData.address}</span>
                  </div>
                )}
                {cardData.extra && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{cardData.extra}</span>
                  </div>
                )}
              </div>
            </div>
            )})()}
          </div>

          <div className="flex" style={{ gap: 'var(--spacing-3)', justifyContent: 'center' }}>
            <button onClick={() => exportCard('png')} className="btn btn-secondary">
              📸 Export PNG
            </button>
            <button onClick={() => exportCard('pdf')} className="btn btn-secondary">
              📄 Export PDF
            </button>
          </div>
          {/* Selected Logo controls placed under export buttons.
              Show only when a logo is selected. */}
          {(() => {
            const img = images.find(i => i.id === selectedImageId)
            if (!img) return null
            const maxW = Math.max(16, cardWidth - img.x)
            const maxH = Math.max(16, cardHeight - img.y)
            return (
              <div
                style={{
                  marginTop: 'var(--spacing-4)',
                  background: 'var(--panel, #0f172a)',
                  border: '1px solid var(--panel-muted, rgba(255,255,255,0.08))',
                  borderRadius: 8,
                  padding: 12,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>Selected Logo</h4>
                  <button className="btn btn-secondary" onClick={() => setSelectedImageId(null)}>✖ Close</button>
                </div>
                <div className="form-group" style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Shape</label>
                      <select className="input" value={img.shape || 'square'} onChange={(e) => updateSelectedImage({ shape: e.target.value })}>
                        <option value="square">Square</option>
                        <option value="rounded">Rounded</option>
                        <option value="circle">Circle</option>
                        <option value="oval">Oval</option>
                        <option value="diamond">Diamond</option>
                        <option value="hexagon">Hexagon</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Width (px)</label>
                      <input
                        type="number"
                        className="input"
                        min={16}
                        max={maxW}
                        value={img.width}
                        onChange={(e) => {
                          const v = Math.max(16, Math.min(maxW, parseInt(e.target.value || '0', 10)))
                          updateSelectedImage({ width: v })
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Height (px)</label>
                      <input
                        type="number"
                        className="input"
                        min={16}
                        max={maxH}
                        value={img.height}
                        onChange={(e) => {
                          const v = Math.max(16, Math.min(maxH, parseInt(e.target.value || '0', 10)))
                          updateSelectedImage({ height: v })
                        }}
                      />
                    </div>
                  </div>

                  <label className="form-label">Brightness ({img.brightness.toFixed(2)})</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={img.brightness}
                    onChange={(e) => updateSelectedImage({ brightness: parseFloat(e.target.value) })}
                  />

                  <label className="form-label">Contrast ({img.contrast.toFixed(2)})</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={img.contrast}
                    onChange={(e) => updateSelectedImage({ contrast: parseFloat(e.target.value) })}
                  />

                  <label className="form-label">Saturation ({img.saturation.toFixed(2)})</label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.01"
                    value={img.saturation}
                    onChange={(e) => updateSelectedImage({ saturation: parseFloat(e.target.value) })}
                  />

                  <label className="form-label">Hue ({img.hue}°)</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={img.hue}
                    onChange={(e) => updateSelectedImage({ hue: parseInt(e.target.value || '0', 10) })}
                  />

                  <label className="form-label">Opacity ({img.opacity.toFixed(2)})</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={img.opacity}
                    onChange={(e) => updateSelectedImage({ opacity: parseFloat(e.target.value) })}
                  />

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" onClick={() => deleteSelectedImage()}>🗑️ Remove</button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Template Library */}
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <h3>Template Library</h3>
          <div className="ai-suggestions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {currentTemplates.map((tpl) => (
              <div key={tpl.id} className="suggestion-card" onClick={() => applyAiSuggestion(tpl, { forcePositions: true })} style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--panel-muted)' }}>
                <div style={{ padding: 8, fontSize: 12, fontWeight: 600 }}>{tpl.name}</div>
                <div style={{ padding: 8 }}>
                  <MiniCardPreview suggestion={tpl} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 'var(--spacing-3)' }}>
            <button className="btn btn-secondary" disabled={templatesPage <= 1} onClick={() => setTemplatesPage(p => Math.max(1, p - 1))}>Prev</button>
            <div style={{ fontSize: 12 }}>Page {templatesPage} / {totalPages}</div>
            <button className="btn btn-secondary" disabled={templatesPage >= totalPages} onClick={() => setTemplatesPage(p => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>

        {aiSuggestions.length > 0 && (
          <div>
            <h3>AI Generated Suggestions</h3>
            <div className="ai-suggestions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {aiSuggestions.map((s, idx) => (
                <div key={idx} className="suggestion-card" onClick={() => applyAiSuggestion(s)} style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--panel-muted)' }}>
                  <div style={{ padding: 8, fontSize: 12, fontWeight: 600 }}>{s.name || 'Concept'}</div>
                  <div style={{ padding: 8 }}>
                    <MiniCardPreview suggestion={s} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="creator-sidebar animate-fade-up animate-delay-3">
        <h3>Card Details</h3>
        
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input 
            type="text" 
            className="input"
            value={cardData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Job Title</label>
          <input 
            type="text" 
            className="input"
            value={cardData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Software Developer"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Company</label>
          <input 
            type="text" 
            className="input"
            value={cardData.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
            placeholder="Tech Company Inc."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input 
            type="email" 
            className="input"
            value={cardData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="john@company.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone</label>
          <input 
            type="tel" 
            className="input"
            value={cardData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Website</label>
          <input 
            type="url" 
            className="input"
            value={cardData.website}
            onChange={(e) => handleInputChange('website', e.target.value)}
            placeholder="www.company.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Address</label>
          <input 
            type="text" 
            className="input"
            value={cardData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="123 Street, City, Country"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Extra (optional)</label>
          <input 
            type="text" 
            className="input"
            value={cardData.extra}
            onChange={(e) => handleInputChange('extra', e.target.value)}
            placeholder="Any additional info"
          />
        </div>

        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <button 
            onClick={generateAIDesign} 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={isGenerating}
          >
            {isGenerating ? '🤖 Generating...' : '✨ Generate AI Design'}
          </button>
        </div>

        <h4>AI Output Mode</h4>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
          <button
            className={`btn ${generationMode === 'svg' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGenerationMode('svg')}
            style={{ flex: 1 }}
          >
            Vector (SVG)
          </button>
          <button
            className={`btn ${generationMode === 'png' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGenerationMode('png')}
            style={{ flex: 1 }}
          >
            Image (PNG)
          </button>
        </div>

        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          {generationMode === 'svg' ? (
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={generateAISVG}>
              🧩 Generate AI SVG (preview)
            </button>
          ) : (
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={generateAIImage}>
              🖼️ Generate AI Image (preview)
            </button>
          )}
        </div>

        <h4>Templates</h4>
        <div className="template-grid">
          {templates.map(template => (
            <div
              key={template.id}
              className={`template-item ${design.template === template.id ? 'active' : ''}`}
              onClick={() => handleDesignChange('template', template.id)}
            >
              <div style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>{template.preview}</div>
                <div style={{ fontSize: '0.75rem' }}>{template.name}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Left column now contains Colors/Layout/Size/Typography/Background/QR Code */}
      </div>
    </div>
  )
}

export default CardCreator