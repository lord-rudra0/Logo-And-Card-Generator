import { Link } from 'react-router-dom'

const Home = () => {
  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered Design',
      description: 'Advanced AI creates professional designs tailored to your industry and preferences.'
    },
    {
      icon: '🎨',
      title: 'Manual Customization',
      description: 'Fine-tune every detail with our intuitive drag-and-drop editor.'
    },
    {
      icon: '📱',
      title: 'QR Code Integration',
      description: 'Add QR codes linking to your website, LinkedIn, or digital business card.'
    },
    {
      icon: '📄',
      title: 'Multiple Export Formats',
      description: 'Export your designs as PNG, PDF, or SVG for any use case.'
    },
    {
      icon: '🏢',
      title: 'Industry Templates',
      description: 'Choose from templates designed for specific industries and professions.'
    },
    {
      icon: '⚡',
      title: 'Instant Preview',
      description: 'See real-time previews of your designs as you make changes.'
    }
  ]

  return (
    <div className="home">
      <section className="hero-section">
        <div className="container">
          <div className="hero-content fade-in">
            <h1 className="hero-title">
              Create Professional 
              <span className="gradient-text"> Business Cards </span>
              & Logos with AI
            </h1>
            <p className="hero-subtitle">
              Harness the power of artificial intelligence to create stunning, 
              professional business cards and logos in minutes. Perfect for 
              entrepreneurs, freelancers, and businesses of all sizes.
            </p>
            <div className="hero-buttons">
              <Link to="/cards" className="btn btn-primary">
                ✨ Create Business Card
              </Link>
              <Link to="/logos" className="btn btn-secondary">
                🎨 Design Logo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <div className="text-center">
            <h2>Everything You Need for Professional Branding</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
              Our platform combines cutting-edge AI technology with professional design 
              templates to help you create memorable business cards and logos.
            </p>
          </div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card card fade-in">
                <div className="feature-icon">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--spacing-20) 0', background: 'var(--bg-secondary)' }}>
        <div className="container text-center">
          <h2>Ready to Get Started?</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', marginBottom: 'var(--spacing-8)' }}>
            Create your first design in under 2 minutes. No design experience required.
          </p>
          <div className="flex flex-center">
            <Link to="/cards" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: 'var(--spacing-4) var(--spacing-8)' }}>
              🚀 Start Creating Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home