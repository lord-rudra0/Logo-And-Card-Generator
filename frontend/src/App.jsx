import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from './components/Header'
import Home from './pages/Home'
import CardCreator from './pages/CardCreator'
import LogoCreator from './pages/LogoCreator'
import HowToUse from './pages/HowToUse'
import { ThemeProvider } from './contexts/ThemeContext'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/cards" element={<CardCreator />} />
              <Route path="/logos" element={<LogoCreator />} />
              <Route path="/how-to-use" element={<HowToUse />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App