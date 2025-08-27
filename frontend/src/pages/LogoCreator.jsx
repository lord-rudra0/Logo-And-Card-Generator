import { useState } from 'react'
import html2canvas from 'html2canvas'

const LogoCreator = () => {
  const [logoData, setLogoData] = useState({
    companyName: '',
    initials: '',
    tagline: '',
    industry: 'technology'
  })

  const [design, setDesign] = useState({
    style: 'modern',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    font: 'Inter',
    icon: '💼',
    layout: 'horizontal'
  })

  const [aiSuggestions, setAiSuggestions] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

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

  const icons = [
    '💼', '🎯', '🚀', '⚡', '💡', '🔥', '⭐', '💎',
    '🏢', '💻', '📱', '🎨', '🔧', '⚙️', '🌟', '🔮'
  ]

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ]

  const generateAILogo = async () => {
    if (!logoData.companyName) {
      alert('Please enter a company name to generate AI suggestions')
      return
    }

    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/generate-logo-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logoData)
      })

      const suggestions = await response.json()
      setAiSuggestions(suggestions.designs || [])
    } catch (error) {
      console.error('Error generating AI logo:', error)
      alert('Error generating AI logo. Please try again.')
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
      // SVG export would need additional implementation
      alert('SVG export coming soon!')
    }
  }

  const handleDataChange = (field, value) => {
    setLogoData(prev => ({ ...prev, [field]: value }))
  }

  const handleDesignChange = (field, value) => {
    setDesign(prev => ({ ...prev, [field]: value }))
  }

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

  return (
    <div className="creator-container">
      {/* Left tools column to match Business Card 3-column layout */}
      <div className="creator-leftbar animate-fade-up animate-delay-1">
        <h3>Design Tools</h3>

        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <button 
            onClick={generateAILogo} 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={isGenerating}
          >
            {isGenerating ? '🤖 Generating...' : '✨ Generate AI Logo'}
          </button>
        </div>

        <h4>Styles</h4>
        <div className="template-grid">
          {styles.map(style => (
            <div
              key={style.id}
              className={`template-item ${design.style === style.id ? 'active' : ''}`}
              onClick={() => handleDesignChange('style', style.id)}
            >
              <div style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>{style.icon}</div>
                <div style={{ fontSize: '0.75rem' }}>{style.name}</div>
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 'var(--spacing-6)' }}>Icons</h4>
        <div className="template-grid">
          {icons.map(icon => (
            <div
              key={icon}
              className={`template-item ${design.icon === icon ? 'active' : ''}`}
              onClick={() => handleDesignChange('icon', icon)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}
            >
              {icon}
            </div>
          ))}
        </div>

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
      </div>

      <div className="creator-main animate-fade-up animate-delay-2">
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <h2>Logo Preview</h2>
          <div className="logo-preview" id="logo-preview">
            <div style={{ textAlign: 'center' }}>
              {design.layout === 'vertical' ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-2)' }}>
                    {design.icon}
                  </div>
                  <div style={{ ...getLogoStyle(), fontSize: '1.5rem', fontWeight: '600' }}>
                    {logoData.companyName || 'Company Name'}
                  </div>
                  {logoData.tagline && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--spacing-1)' }}>
                      {logoData.tagline}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', justifyContent: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>
                    {design.icon}
                  </div>
                  <div>
                    <div style={{ ...getLogoStyle(), fontSize: '1.5rem', fontWeight: '600' }}>
                      {logoData.companyName || 'Company Name'}
                    </div>
                    {logoData.tagline && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {logoData.tagline}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex" style={{ gap: 'var(--spacing-3)', justifyContent: 'center' }}>
            <button onClick={() => exportLogo('png')} className="btn btn-secondary">
              📸 Export PNG
            </button>
            <button onClick={() => exportLogo('svg')} className="btn btn-secondary">
              🎨 Export SVG
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
                    handleDesignChange('icon', suggestion.icon)
                    handleDesignChange('primaryColor', suggestion.primaryColor)
                  }}
                >
                  <div style={{ padding: 'var(--spacing-2)', fontSize: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-1)' }}>
                      {suggestion.icon}
                    </div>
                    <div>{suggestion.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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