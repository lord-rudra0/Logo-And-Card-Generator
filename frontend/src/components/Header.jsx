import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import QrGenerator from './QrGenerator'
import './Header.css'

const Header = () => {
  const { theme, toggleTheme } = useTheme()
  const [qrOpen, setQrOpen] = useState(false)

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">🎨</span>
            <span className="logo-text">AI Card Creator</span>
          </Link>
          
          <nav className="nav">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/cards" className="nav-link">Business Cards</Link>
            <Link to="/logos" className="nav-link">Logos</Link>
            <Link to="/how-to-use" className="nav-link">How to Use</Link>
          </nav>
          
          <div className="header-actions">
            <button 
              onClick={() => setQrOpen(true)}
              className="btn"
              title="QR Generator"
            >
              📱 QR
            </button>
            <button 
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </div>
      {qrOpen && <QrGenerator onClose={() => setQrOpen(false)} />}
    </header>
  )
}

export default Header