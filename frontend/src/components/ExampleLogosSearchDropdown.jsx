import React, { useMemo, useState } from 'react'
import EXAMPLE_TEMPLATES from '../data/logoExampleTemplates.jsx'

// Searchable Example Logos dropdown
// Props: value (template id), onChange(id)
export default function ExampleLogosSearchDropdown({ value = '', onChange }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 60

  const all = useMemo(() => {
    const query = q.trim().toLowerCase()
    const list = EXAMPLE_TEMPLATES.map(t => ({ id: t.id, label: t.label || t.name || t.id }))
    if (!query) return list
    return list.filter(o => o.label.toLowerCase().includes(query))
  }, [q])

  const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * pageSize
  const options = all.slice(start, start + pageSize)

  const groupOf = (id = '') => {
    if (id.startsWith('gen-abstract-duotone')) return 'Abstract'
    if (id.startsWith('gen-chevrons')) return 'Geometric'
    if (id.startsWith('gen-links')) return 'Minimal'
    if (id.startsWith('gen-orbits')) return 'Orbit'
    return 'Handcrafted'
  }
  const grouped = useMemo(() => {
    const map = new Map()
    options.forEach(o => {
      const g = groupOf(o.id)
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(o)
    })
    return Array.from(map.entries()) // [groupName, items[]]
  }, [options])

  return (
    <div className="field">
      <label className="field-label">Example Logo Template</label>
      <input
        type="text"
        placeholder="Search templates..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input"
        style={{ marginBottom: 'var(--spacing-2)' }}
      />
      <select
        className="select"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">Select a template</option>
        {q.trim() ? (
          options.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))
        ) : (
          grouped.map(([groupName, items]) => (
            <optgroup key={groupName} label={groupName}>
              {items.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </optgroup>
          ))
        )}
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" disabled={pageSafe <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Page {pageSafe} / {totalPages}</div>
        <button type="button" className="btn btn-secondary" disabled={pageSafe >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  )
}
