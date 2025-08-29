import React from 'react'

// Gradient controls: angle and 2-3 color stops
// Props: value, onChange
export default function GradientControls({ value = {}, onChange }) {
  const v = {
    type: value.type ?? 'linear',
    angle: value.angle ?? 45,
    stops: value.stops ?? [
      { color: '#3b82f6', at: 0 },
      { color: '#9333ea', at: 100 }
    ]
  }
  const set = (k, val) => onChange?.({ ...v, [k]: val })
  const setStop = (i, key, val) => {
    const stops = v.stops.map((s, idx) => idx === i ? { ...s, [key]: val } : s)
    set('stops', stops)
  }
  const addStop = () => set('stops', [...v.stops, { color: '#22c55e', at: 50 }])
  const removeStop = (i) => set('stops', v.stops.filter((_, idx) => idx !== i))

  return (
    <div className="card">
      <div className="card-title">Gradient Controls</div>

      <div className="field">
        <label className="field-label">Type</label>
        <select className="select" value={v.type} onChange={e => set('type', e.target.value)}>
          <option value="linear">Linear</option>
        </select>
      </div>

      <div className="field">
        <label className="field-label">Angle</label>
        <input type="range" min={0} max={360} value={v.angle} onChange={e => set('angle', Number(e.target.value))} />
      </div>

      <div className="field">
        <label className="field-label">Stops</label>
        {v.stops.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: 6 }}>
            <input type="color" value={s.color} onChange={e => setStop(i, 'color', e.target.value)} />
            <input type="number" min={0} max={100} value={s.at} onChange={e => setStop(i, 'at', Number(e.target.value))} className="input" style={{ width: 72 }} />
            <button type="button" className="btn btn-secondary" onClick={() => removeStop(i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={addStop}>Add Stop</button>
      </div>
    </div>
  )
}
