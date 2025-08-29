import React from 'react'

// Simple layout controls to choose layout template and spacing/alignment
// Props: value, onChange
export default function LayoutControls({ value = {}, onChange }) {
  const v = {
    template: value.template ?? 'icon-beside',
    alignment: value.alignment ?? 'center',
    spacing: value.spacing ?? 12,
  }
  const set = (k, val) => onChange?.({ ...v, [k]: val })

  return (
    <div className="card">
      <div className="card-title">Layout Controls</div>
      <div className="field">
        <label className="field-label">Template</label>
        <select className="select" value={v.template} onChange={e => set('template', e.target.value)}>
          <option value="icon-beside">Icon Beside</option>
          <option value="icon-above">Icon Above</option>
          <option value="badge">Badge</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label">Alignment</label>
        <select className="select" value={v.alignment} onChange={e => set('alignment', e.target.value)}>
          <option value="start">Start</option>
          <option value="center">Center</option>
          <option value="end">End</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label">Spacing</label>
        <input type="range" min={0} max={40} value={v.spacing} onChange={e => set('spacing', Number(e.target.value))} />
      </div>
    </div>
  )
}
