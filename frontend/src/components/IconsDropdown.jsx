import React from 'react'

export default function IconsDropdown({ icons = [], value, onChange, onFocus }) {
  return (
    <div className="form-group">
      <label className="form-label">Icon</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
      >
        {icons.map((icon, idx) => (
          <option key={`${icon}-${idx}`} value={icon}>
            {icon}
          </option>
        ))}
      </select>
    </div>
  )
}
