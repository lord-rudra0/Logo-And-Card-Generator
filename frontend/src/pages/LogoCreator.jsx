import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import PrebuiltLogosGrid from '../components/PrebuiltLogosGrid.jsx'
import IconsDropdown from '../components/IconsDropdown.jsx'
import PREBUILT_LOGO_TEMPLATES from '../data/logoTemplates.js'
import EMOJI_ICONS from '../data/emojiIcons.js'
import { loadEmojis } from '../utils/emojiLoader.js'
import { mapTypographyToFont, guessLayoutTemplate, guessShape } from '../utils/aiMappers.js'
import FontSelectDropdown from '../components/FontSelectDropdown.jsx'
import ColorPalettesDropdown from '../components/ColorPalettesDropdown.jsx'
import ShapesDropdown from '../components/ShapesDropdown.jsx'
import LayoutTemplatesDropdown from '../components/LayoutTemplatesDropdown.jsx'
import StylesDropdown from '../components/StylesDropdown.jsx'
import { postJson } from '../utils/api.js'
import ExampleLogosSearchDropdown from '../components/ExampleLogosSearchDropdown.jsx'
import LogoRendererSVG from '../renderers/LogoRendererSVG.jsx'
import EXAMPLE_TEMPLATES from '../data/logoExampleTemplates.jsx'
import { buildLogoRequestFromState } from '../types/logoSchema.js'
import IconControls from '../components/IconControls.jsx'
import { exportSvgElement } from '../utils/svgExport.js'
import LayoutControls from '../components/LayoutControls.jsx'
import GradientControls from '../components/GradientControls.jsx'
import { exportPdfFromSvg } from '../utils/pdfExport.js'
import TextToImageGenerator from '../components/TextToImageGenerator.jsx'

const LogoCreator = () => {
  const [logoData, setLogoData] = useState({
    companyName: '',
    initials: '',
    tagline: '',
    industry: 'technology'
  })

  const [exportSize, setExportSize] = useState(512)

  const [design, setDesign] = useState({
    style: 'modern',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    font: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    icon: '💼',
    layout: 'horizontal', // legacy layout (horizontal ~ icon-beside, vertical ~ icon-above)
    shape: 'none',
    layoutTemplate: 'icon-beside',
    layoutOptions: { template: 'icon-beside', alignment: 'center', spacing: 12 },
    gradient: { type: 'linear', angle: 45, stops: [ { color: '#3b82f6', at: 0 }, { color: '#9333ea', at: 100 } ] },
    iconOptions: {
      family: 'abstract',
      strokeWidth: 10,
      cornerRadius: 8,
      symmetry: 'none',
      rotation: 0,
      complexity: 'medium'
    }
  })

  const [aiSuggestions, setAiSuggestions] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [exampleTemplateId, setExampleTemplateId] = useState('')
  const svgRef = useRef(null)

  const styles = [
    { id: 'modern', name: 'Modern', icon: '🎯' },
    { id: 'minimalist', name: 'Minimalist', icon: '⚡' },
    { id: 'corporate', name: 'Corporate', icon: '🏢' },
    { id: 'creative', name: 'Creative', icon: '🎨' },
    { id: 'tech', name: 'Tech', icon: '💻' },
    { id: 'vintage', name: 'Vintage', icon: '📜' }
  ]

  const industries = [
    'technology', 'healthcare', 'finance', 'education', 'retail',
    'consulting', 'creative', 'real-estate', 'food', 'fitness'
  ]

  const [icons, setIcons] = useState(EMOJI_ICONS)
  const [iconsLoaded, setIconsLoaded] = useState(false)

  const ensureLargeEmojiSet = async () => {
    if (iconsLoaded) return
    const big = await loadEmojis(1200)
    if (big && big.length) {
      setIcons(big)
      setIconsLoaded(true)
    }

  }

  const autoStyleWithAI = async () => {
    if (!logoData.companyName) {
      alert('Please enter a company name to auto-style with AI')
      return
    }
    setIsGenerating(true)
    try {
      const req = buildLogoRequestFromState({
        companyName: logoData.companyName,
        industry: logoData.industry,
        initials: logoData.initials,
        tagline: logoData.tagline,
        primaryColor: design.primaryColor,
        secondaryColor: design.secondaryColor,
        selectedExampleTemplateId: exampleTemplateId,
        selectedFont: design.font
      })
      const { ok, status, data, text } = await postJson('/api/generate-logo-design', req)
      if (!ok) {
        const msg = (data && (data.error || data.message)) || text || `HTTP ${status}`
        throw new Error(msg)
      }
      const payload = data || {}
      const suggestion = (payload.designs && payload.designs[0]) || null
      if (!suggestion) throw new Error('No AI suggestion returned')

      const primary = suggestion.colors?.primary || suggestion.primaryColor || design.primaryColor
      const secondary = suggestion.colors?.secondary || suggestion?.gradient?.stops?.[1]?.color || design.secondaryColor || primary
      const font = mapTypographyToFont(suggestion.typography?.font || suggestion.typography)
      const tplFromAI = suggestion.layout?.template
      const tpl = guessLayoutTemplate(suggestion, logoData)
      const shp = guessShape(logoData)

      setDesign(prev => ({
        ...prev,
        style: suggestion.style || prev.style,
        icon: suggestion.icon?.emoji || suggestion.icon || prev.icon,
        primaryColor: primary,
        secondaryColor: secondary,
        font,
        layoutTemplate: tplFromAI || tpl,
        shape: shp
      }))
      // Switch to a specific SVG template if AI suggested one
      if (tplFromAI) {
        setExampleTemplateId(tplFromAI)
      } else {
        // default to procedural unique icon
        setExampleTemplateId('abstract-duotone-procedural')
      }
    } catch (e) {
      console.error('Auto-style failed:', e)
      alert(`Auto-style failed: ${e.message || e}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ]

  const showLogoIcon = true

  const generateAILogo = async () => {
    if (!logoData.companyName) {
      alert('Please enter a company name to generate AI suggestions')
      return
    }

    setIsGenerating(true)
    
    try {
      const req = buildLogoRequestFromState({
        companyName: logoData.companyName,
        industry: logoData.industry,
        initials: logoData.initials,
        tagline: logoData.tagline,
        primaryColor: design.primaryColor,
        secondaryColor: design.secondaryColor,
        selectedExampleTemplateId: exampleTemplateId,
        selectedFont: design.font
      })
      const { ok, status, data, text } = await postJson('/api/generate-logo-design', req)
      if (!ok) {
        const msg = (data && (data.error || data.message)) || text || `HTTP ${status}`
        throw new Error(msg)
      }
      setAiSuggestions((data && data.designs) || [])
    } catch (error) {
      console.error('Error generating AI logo:', error)
      alert(`Error generating AI logo: ${error.message || error}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const exportLogo = async (format) => {
    const logoElement = document.getElementById('logo-preview')
    
    if (format === 'png') {
      const canvas = await html2canvas(logoElement, {
        backgroundColor: null,
        scale: 4
      })
      
      const link = document.createElement('a')
      link.download = `logo-${logoData.companyName}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } else if (format === 'svg') {
      const selected = EXAMPLE_TEMPLATES.find(t => t.id === exampleTemplateId)
      if (selected && svgRef.current) {
        exportSvgElement(svgRef.current, `logo-${logoData.companyName || 'brand'}.svg`, {
          title: logoData.companyName || 'Logo',
          description: logoData.tagline || 'Generated with CardGEN',
          generator: 'CardGEN'
        })
      } else {
        alert('Select an example SVG template to export as SVG.')
      }
    } else if (format === 'pdf') {
      const selected = EXAMPLE_TEMPLATES.find(t => t.id === exampleTemplateId)
      if (selected && svgRef.current) {
        const serializer = new XMLSerializer()
        const svgString = serializer.serializeToString(svgRef.current)
        await exportPdfFromSvg(svgString, `logo-${logoData.companyName || 'brand'}.pdf`, { width: exportSize, height: exportSize })
      } else {
        alert('Select an example SVG template to export as PDF.')
      }
    }
  }

  const handleDataChange = (field, value) => {
    setLogoData(prev => ({ ...prev, [field]: value }))
  }

  const handleDesignChange = (field, value) => {
    setDesign(prev => ({ ...prev, [field]: value }))
  }

  // Apply a prebuilt template (gradient-aware)
  const applyPrebuiltTemplate = (tpl) => {
    const secondary = tpl?.gradient?.stops?.[1]?.color || design.secondaryColor || tpl.primaryColor
    setDesign(prev => ({
      ...prev,
      style: tpl.style || prev.style,
      icon: tpl.icon || prev.icon,
      primaryColor: tpl.primaryColor || prev.primaryColor,
      secondaryColor: secondary,
      font: tpl.typography || prev.font
    }))
  }

  // For now, do not show any icon in preview (component-scope const)
  // (Already declared above)

  const getLogoStyle = () => {
    const baseStyle = {
      fontFamily: design.font,
      color: design.primaryColor
    }

    switch (design.style) {
      case 'modern':
        return {
          ...baseStyle,
          background: `linear-gradient(135deg, ${design.primaryColor}, ${design.secondaryColor})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }
      case 'minimalist':
        return {
          ...baseStyle,
          fontWeight: '300'
        }
      case 'corporate':
        return {
          ...baseStyle,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }
      default:
        return baseStyle
    }
  }

  const getShapeBox = () => {
    if (!logoData.initials || design.shape === 'none') return null
    const size = 64
    const common = {
      width: size,
      height: size,
      background: design.primaryColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontWeight: 700,
      letterSpacing: '1px'
    }

    const shapeStyle = (() => {
      switch (design.shape) {
        case 'circle':
          return { borderRadius: '50%' }
        case 'square':
          return { borderRadius: 8 }
        case 'hexagon':
          return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }
        case 'triangle':
          return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }
        default:
          return {}
      }
    })()

    return (
      <div style={{ ...common, ...shapeStyle }}>
        <span style={{ fontFamily: design.font }}>{logoData.initials.slice(0, 3).toUpperCase()}</span>
      </div>
    )
  }

  return (
    <div className="creator-container">
      {/* Left tools column to match Business Card 3-column layout */}
      <div className="creator-leftbar animate-fade-up animate-delay-1">
        <h3>Design Tools</h3>

        <div style={{ marginBottom: 'var(--spacing-6)', display: 'grid', gap: '8px' }}>
          <button 
            onClick={generateAILogo} 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={isGenerating}
          >
            {isGenerating ? '🤖 Generating...' : '✨ Generate AI Logo'}
          </button>
          <button 
            onClick={autoStyleWithAI} 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            disabled={isGenerating}
          >
            {isGenerating ? '🎛️ Applying...' : '🎛️ Auto Style with AI'}
          </button>
        </div>

        <StylesDropdown
          value={design.style}
          onChange={(val) => handleDesignChange('style', val)}
        />

        <ExampleLogosSearchDropdown
          value={exampleTemplateId}
          onChange={(id) => setExampleTemplateId(id)}
        />

        <IconsDropdown
          icons={icons}
          value={design.icon}
          onChange={(icon) => handleDesignChange('icon', icon)}
          onFocus={ensureLargeEmojiSet}
        />

        <IconControls
          value={design.iconOptions}
          onChange={(opts) => setDesign(prev => ({ ...prev, iconOptions: opts }))}
        />

        <LayoutControls
          value={design.layoutOptions}
          onChange={(opts) => setDesign(prev => ({ ...prev, layoutOptions: opts }))}
        />

        <GradientControls
          value={design.gradient}
          onChange={(g) => setDesign(prev => ({ ...prev, gradient: g }))}
        />

        <FontSelectDropdown
          value={design.font}
          onChange={(stack) => handleDesignChange('font', stack)}
        />

        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Colors</h4>
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

        <ColorPalettesDropdown
          primary={design.primaryColor}
          secondary={design.secondaryColor}
          onChange={(p, s) => {
            handleDesignChange('primaryColor', p)
            handleDesignChange('secondaryColor', s)
          }}
        />

        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Layout</h4>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <button
            className={`btn ${design.layout === 'horizontal' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleDesignChange('layout', 'horizontal')}
            style={{ flex: 1 }}
          >
            Horizontal
          </button>
          <button
            className={`btn ${design.layout === 'vertical' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleDesignChange('layout', 'vertical')}
            style={{ flex: 1 }}
          >
            Vertical
          </button>
        </div>

        <LayoutTemplatesDropdown
          value={design.layoutTemplate}
          onChange={(tpl) => handleDesignChange('layoutTemplate', tpl)}
        />

        <ShapesDropdown
          value={design.shape}
          onChange={(shape) => handleDesignChange('shape', shape)}
        />
      </div>

      <div className="creator-main animate-fade-up animate-delay-2">
        <div className="preview-sticky-wrap" style={{ marginBottom: 'var(--spacing-6)' }}>
          <h2>Logo Preview</h2>
          <div
            className="logo-preview"
            id="logo-preview"
            style={{
              background: design?.gradient?.stops?.length >= 2
                ? `linear-gradient(${design.gradient.angle ?? 45}deg, ${design.gradient.stops.map(s => `${s.color} ${typeof s.at === 'number' ? s.at + '%' : ''}`).join(', ')})`
                : undefined
            }}
          >
            <div style={{ textAlign: 'center' }}>
              {exampleTemplateId ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <LogoRendererSVG
                    ref={svgRef}
                    template={EXAMPLE_TEMPLATES.find(t => t.id === exampleTemplateId)}
                    companyName={logoData.companyName}
                    initials={logoData.initials}
                    primaryColor={design.primaryColor}
                    secondaryColor={design.secondaryColor}
                    font={design.font}
                    iconOptions={design.iconOptions}
                    layoutOptions={design.layoutOptions}
                    gradient={design.gradient}
                  />
                </div>
              ) : (
              (() => {
                const title = (
                  <div style={{ ...getLogoStyle(), fontSize: '1.5rem', fontWeight: '600' }}>
                    {logoData.companyName || 'Company Name'}
                  </div>
                )
                const tag = logoData.tagline ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-1)' }}>
                    {logoData.tagline}
                  </div>
                ) : null

                const iconEl = showLogoIcon ? (
                  <div style={{ fontSize: '2.5rem' }}>{design.icon}</div>
                ) : null

                const shapeEl = getShapeBox()

                switch (design.layoutTemplate) {
                  case 'icon-above':
                    return (
                      <div>
                        {iconEl}
                        {title}
                        {tag}
                      </div>
                    )
                  case 'icon-beside':
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', justifyContent: 'center' }}>
                        {iconEl}
                        <div>
                          {title}
                          {tag}
                        </div>
                      </div>
                    )
                  case 'text-only':
                    return (
                      <div>
                        {title}
                        {tag}
                      </div>
                    )
                  case 'initials-in-shape':
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-2)' }}>
                          {shapeEl}
                        </div>
                        {title}
                        {tag}
                      </div>
                    )
                  case 'symbol-initials':
                    return (
                      <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'center', alignItems: 'center' }}>
                        {iconEl}
                        {shapeEl || <div style={{ ...getLogoStyle(), fontSize: '1.25rem', fontWeight: 700 }}>{(logoData.initials || 'AA').slice(0,3).toUpperCase()}</div>}
                      </div>
                    )
                  default:
                    return (
                      <div>
                        {title}
                        {tag}
                      </div>
                    )
                }
              })()
              )}
            </div>
          </div>

          <div className="flex" style={{ gap: 'var(--spacing-3)', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="field-label" style={{ margin: 0, fontSize: 12 }}>PDF Size</label>
              <select className="select" value={exportSize} onChange={(e) => setExportSize(Number(e.target.value))}>
                <option value={256}>256 px</option>
                <option value={512}>512 px</option>
                <option value={1024}>1024 px</option>
              </select>
            </div>
            <button onClick={() => exportLogo('png')} className="btn btn-secondary">
              📸 Export PNG
            </button>
            <button onClick={() => exportLogo('svg')} className="btn btn-secondary">
              🎨 Export SVG
            </button>
            <button onClick={() => exportLogo('pdf')} className="btn btn-secondary">
              📄 Export PDF
            </button>
          </div>
        </div>

        {aiSuggestions.length > 0 && (
          <div>
            <h3>AI Generated Logo Suggestions</h3>
            <div className="ai-suggestions">
              {aiSuggestions.map((suggestion, index) => (
                <div 
                  key={index} 
                  className="suggestion-card"
                  onClick={() => {
                    handleDesignChange('style', suggestion.style)
                    handleDesignChange('icon', suggestion.icon?.emoji || suggestion.icon)
                    const primary = suggestion.colors?.primary || suggestion.primaryColor
                    const secondary = suggestion.colors?.secondary || suggestion?.gradient?.stops?.[1]?.color
                    if (primary) handleDesignChange('primaryColor', primary)
                    if (secondary) handleDesignChange('secondaryColor', secondary)
                    const font = suggestion.typography?.font
                    if (font) handleDesignChange('font', mapTypographyToFont(font))
                    if (suggestion.layout?.template) setExampleTemplateId(suggestion.layout.template)
                  }}
                >
                  <div style={{ padding: 'var(--spacing-2)', fontSize: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-1)' }}>
                      {suggestion.icon?.emoji || suggestion.icon}
                    </div>
                    <div>{suggestion.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prebuilt professional logo cards moved below AI suggestions */}
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <PrebuiltLogosGrid 
            templates={PREBUILT_LOGO_TEMPLATES}
            onApply={applyPrebuiltTemplate}
          />
        </div>

        {/* Text-to-Image Generator */}
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <TextToImageGenerator />
        </div>
      </div>

      <div className="creator-sidebar animate-fade-up animate-delay-3">
        <h3>Logo Details</h3>

        <div className="form-group">
          <label className="form-label">Company Name</label>
          <input 
            type="text" 
            className="input"
            value={logoData.companyName}
            onChange={(e) => handleDataChange('companyName', e.target.value)}
            placeholder="Your Company"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Initials (Optional)</label>
          <input 
            type="text" 
            className="input"
            value={logoData.initials}
            onChange={(e) => handleDataChange('initials', e.target.value)}
            placeholder="YC"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tagline (Optional)</label>
          <input 
            type="text" 
            className="input"
            value={logoData.tagline}
            onChange={(e) => handleDataChange('tagline', e.target.value)}
            placeholder="Your company tagline"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Industry</label>
          <select 
            className="input"
            value={logoData.industry}
            onChange={(e) => handleDataChange('industry', e.target.value)}
          >
            {industries.map(industry => (
              <option key={industry} value={industry}>
                {industry.charAt(0).toUpperCase() + industry.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Sidebar reserved for textual details only */}
      </div>
    </div>
  )
}

export default LogoCreator