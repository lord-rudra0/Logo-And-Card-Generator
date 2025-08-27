import React from 'react'

export default function IconControls({ value, onChange }) {
  const v = value || {}
  const set = (k, val) => onChange?.({ ...v, [k]: val })
  return (
    <div style={{ marginTop: 'var(--spacing-6)' }}>
      <h4>Icon Controls</h4>
      <div className="form-group">
        <label className="form-label">Family</label>
        <select className="input" value={v.family || 'abstract'} onChange={e => set('family', e.target.value)}>
          <option value="abstract">Abstract</option>
          <option value="monogram">Monogram</option>
          <option value="geometric">Geometric</option>
          <option value="leaf">Leaf</option>
          <option value="shield">Shield</option>
          <option value="link">Link</option>
          <option value="orbit">Orbit</option>
          <option value="chevron">Chevron</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Stroke Width</label>
        <input type="number" className="input" value={v.strokeWidth ?? 10} min={1} max={20} onChange={e => set('strokeWidth', Number(e.target.value))} />
      </div>
      <div className="form-group">
        <label className="form-label">Corner Radius</label>
        <input type="number" className="input" value={v.cornerRadius ?? 8} min={0} max={32} onChange={e => set('cornerRadius', Number(e.target.value))} />
      </div>
      <div className="form-group">
        <label className="form-label">Symmetry</label>
        <select className="input" value={v.symmetry || 'none'} onChange={e => set('symmetry', e.target.value)}>
          <option value="none">None</option>
          <option value="radial">Radial</option>
          <option value="bilateral">Bilateral</option>
          <option value="grid">Grid</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Rotation</label>
        <input type="number" className="input" value={v.rotation ?? 0} min={-180} max={180} onChange={e => set('rotation', Number(e.target.value))} />
      </div>
      <div className="form-group">
        <label className="form-label">Complexity</label>
        <select className="input" value={v.complexity || 'medium'} onChange={e => set('complexity', e.target.value)}>
          <option value="minimal">Minimal</option>
          <option value="medium">Medium</option>
          <option value="rich">Rich</option>
        </select>
      </div>
    </div>
  )
}
