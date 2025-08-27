import React from 'react'
import { Link } from 'react-router-dom'

export default function HowToUse() {
  return (
    <div className="container" style={{ padding: 'var(--spacing-6) 0' }}>
      <h1>How to Use AI Card Creator</h1>
      <p style={{ opacity: 0.9 }}>This guide walks you through the entire app: Home, Business Cards, and Logos. Learn how to add assets, drag elements, fine-tune styles, and export your design.</p>

      <section style={{ marginTop: 'var(--spacing-6)' }}>
        <h2>Home</h2>
        <ul className="list">
          <li>Use the top navigation to switch between <b>Home</b>, <b>Business Cards</b>, and <b>Logos</b>.</li>
          <li>Read quick tips and start your design by heading to <Link to="/cards">Business Cards</Link>.</li>
        </ul>
      </section>

      <section style={{ marginTop: 'var(--spacing-6)' }}>
        <h2>Business Cards</h2>
        <p>The Business Card Creator is split into three areas: Left Tools, Center Preview, and Right Sidebar.</p>

        <h3>Left Tools</h3>
        <ul className="list">
          <li><b>Assets</b>: Add a background or logos via upload or URL. Newly added logos become selectable and editable.</li>
          <li><b>Colors</b>: Quick palette to set the primary theme color.</li>
          <li><b>Icons</b>: Add vector icons. Adjust their size and color in the list; drag them on the card.</li>
          <li><b>Layout</b>: Set text alignment (Left/Center/Right) and global offsets (X/Y).</li>
          <li><b>House Templates</b>: Apply curated layout presets.</li>
          <li><b>Card Size</b>: Width/Height of the canvas in pixels.</li>
          <li><b>Typography</b>: Font sizes and colors for name, title, company, and contact text.</li>
          <li><b>Background</b>: Choose Auto, Solid color, or Gradient and tweak its parameters.</li>
          <li><b>QR Code</b>: Generate and place a QR code on the card.</li>
          <li><b>Positioning</b>: Toggle Lock (prevents dragging) and Snap to Grid (with grid size), and Reset Positions.</li>
        </ul>

        <h3>Center Preview</h3>
        <ul className="list">
          <li><b>Drag Text Blocks</b>: Name, Title, Company, and Contacts can be dragged around.</li>
          <li><b>Logos</b>: Drag to move; select to highlight. Use the corner handle to resize within bounds.</li>
          <li><b>Icons</b>: Drag to place. Their color/size can be edited from the Icons list in Left Tools.</li>
          <li><b>Export</b>: Use <b>📸 Export PNG</b> or <b>📄 Export PDF</b> to download.</li>
          <li><b>Decorative Shapes</b>: Some templates include colored bands/arcs/curves that render behind all content and are non-interactive.</li>
          <li><b>Layering</b>: Logos are rendered above shapes and text so they remain visible and editable.</li>
          <li><b>Selected Logo Panel</b> (under export buttons):
            <ul>
              <li>Width/Height inputs (bounded by card size).</li>
              <li>Filters: Brightness, Contrast, Saturation, Hue, Opacity.</li>
              <li><b>Close</b> button to deselect and hide the panel.</li>
              <li>Delete Selected Logo to remove it from the card.</li>
            </ul>
          </li>
        </ul>

        <h3>Right Sidebar</h3>
        <ul className="list">
          <li><b>Card Details</b>: Enter your Name, Title, Company, Email, Phone, Website, Address, and any Extra info.</li>
          <li><b>AI Design</b>: Generate AI design suggestions and apply them with one click.</li>
          <li><b>AI Output Mode</b>: Choose Vector (SVG) or Image (PNG) preview generation.</li>
          <li><b>Templates</b>: Pick from ready-made layout templates.</li>
        </ul>

        <h3>Tips</h3>
        <ul className="list">
          <li>Use <b>Lock</b> to prevent accidental dragging when refining details.</li>
          <li>Keep <b>Snap to Grid</b> on for neat alignment, adjust grid size as needed.</li>
          <li>Try <b>House Templates</b> and <b>AI Suggestions</b> to quickly explore design directions.</li>
        </ul>
      </section>

      <section style={{ marginTop: 'var(--spacing-6)' }}>
        <h2>Logos</h2>
        <ul className="list">
          <li>Create or refine logo concepts separately from the card page.</li>
          <li>Export or bring generated assets into the <Link to="/cards">Business Cards</Link> page.</li>
        </ul>
      </section>

      <section style={{ marginTop: 'var(--spacing-6)' }}>
        <h2>Quick Start</h2>
        <ol className="list">
          <li>Go to <Link to="/cards">Business Cards</Link>.</li>
          <li>Add a background and one or more logos from <b>Assets</b>.</li>
          <li>Enter your details in the right sidebar.</li>
          <li>Drag, resize, and edit your logos using the <b>Selected Logo</b> panel.</li>
          <li>Tweak colors, typography, and layout. Optionally generate <b>AI</b> suggestions.</li>
          <li>Export as PNG or PDF.</li>
        </ol>
      </section>

      <div style={{ marginTop: 'var(--spacing-6)' }}>
        <Link to="/cards" className="btn btn-primary">Start Designing →</Link>
      </div>
    </div>
  )
}
