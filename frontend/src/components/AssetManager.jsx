import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * AssetManager
 * - Lets users add background images and multiple logos from local files or URLs
 * - Does not couple to CardCreator. Use callbacks to integrate:
 *   onSetBackground(url: string)
 *   onAddLogo(url: string)
 *   onRemoveLogo(url: string)
 *
 * Persistence: saves simple lists to localStorage (keys: card_bg_images, card_logo_images)
 */
export default function AssetManager({
  onSetBackground,
  onAddLogo,
  onRemoveLogo,
  title = 'Assets',
}) {
  const [activeTab, setActiveTab] = useState('backgrounds') // 'backgrounds' | 'logos'
  const [bgImages, setBgImages] = useState(() => loadArray('card_bg_images'))
  const [logoImages, setLogoImages] = useState(() => loadArray('card_logo_images'))
  const [bgUrl, setBgUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const fileInputRefBg = useRef(null)
  const fileInputRefLogo = useRef(null)

  useEffect(() => saveArray('card_bg_images', bgImages), [bgImages])
  useEffect(() => saveArray('card_logo_images', logoImages), [logoImages])

  const handleFilePick = async (files, kind) => {
    if (!files || !files.length) return
    const items = []
    for (const file of files) {
      const url = await readFileAsDataURL(file)
      items.push(url)
    }
    if (kind === 'bg') {
      setBgImages(prev => [...items, ...prev])
      if (onSetBackground && items[0]) onSetBackground(items[0])
    } else {
      setLogoImages(prev => [...items, ...prev])
      if (onAddLogo) items.forEach(u => onAddLogo(u))
    }
  }

  const addFromUrl = (url, kind) => {
    if (!url) return
    if (kind === 'bg') {
      setBgImages(prev => [url, ...prev])
      if (onSetBackground) onSetBackground(url)
      setBgUrl('')
    } else {
      setLogoImages(prev => [url, ...prev])
      if (onAddLogo) onAddLogo(url)
      setLogoUrl('')
    }
  }

  const removeItem = (url, kind) => {
    if (kind === 'bg') {
      setBgImages(prev => prev.filter(u => u !== url))
    } else {
      setLogoImages(prev => prev.filter(u => u !== url))
      if (onRemoveLogo) onRemoveLogo(url)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'backgrounds' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('backgrounds')}
          >Backgrounds</button>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'logos' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('logos')}
          >Logos</button>
        </div>
      </div>

      {activeTab === 'backgrounds' ? (
        <Section
          kind="bg"
          items={bgImages}
          urlValue={bgUrl}
          onUrlChange={setBgUrl}
          onAddUrl={(u) => addFromUrl(u, 'bg')}
          onPickFiles={(files) => handleFilePick(files, 'bg')}
          onRemove={(u) => removeItem(u, 'bg')}
          primaryActionLabel="Set as background"
          onPrimary={(u) => onSetBackground && onSetBackground(u)}
        />
      ) : (
        <Section
          kind="logo"
          items={logoImages}
          urlValue={logoUrl}
          onUrlChange={setLogoUrl}
          onAddUrl={(u) => addFromUrl(u, 'logo')}
          onPickFiles={(files) => handleFilePick(files, 'logo')}
          onRemove={(u) => removeItem(u, 'logo')}
          primaryActionLabel="Add logo"
          onPrimary={(u) => onAddLogo && onAddLogo(u)}
        />
      )}
    </div>
  )
}

function Section({ kind, items, urlValue, onUrlChange, onAddUrl, onPickFiles, onRemove, primaryActionLabel, onPrimary }) {
  return (
    <div>
      <div style={styles.row}>
        <input
          type="text"
          placeholder={kind === 'bg' ? 'Paste image URL for background' : 'Paste image URL for logo'}
          value={urlValue}
          onChange={(e) => onUrlChange(e.target.value)}
          style={styles.input}
        />
        <button style={styles.btn} onClick={() => onAddUrl(urlValue)}>Add</button>
      </div>

      <div style={styles.row}>
        <label style={styles.uploadLabel}>
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => onPickFiles(e.target.files)}
          />
          Upload images
        </label>
      </div>

      <div style={styles.grid}>
        {items.length === 0 && (
          <div style={styles.empty}>No images added yet.</div>
        )}
        {items.map((u, i) => (
          <div key={`${kind}-${i}-${(u || '').slice(0,24)}`} style={styles.card}>
            <div style={styles.thumbWrap}>
              {/* eslint-disable-next-line */}
              <img src={u} alt="asset" style={styles.thumb} />
            </div>
            <div style={styles.cardRow}>
              <button style={styles.btnSm} onClick={() => onPrimary(u)}>{primaryActionLabel}</button>
              <button style={styles.btnSmDanger} onClick={() => onRemove(u)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helpers
function loadArray(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (_) {
    return []
  }
}

function saveArray(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr || [])) } catch (_) {}
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Inline styles to avoid extra CSS files
const styles = {
  wrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    background: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontWeight: 600 },
  tabs: { display: 'flex', gap: 8 },
  tabBtn: {
    padding: '6px 10px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  tabActive: {
    background: '#e5e7eb',
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
  btn: {
    padding: '6px 10px',
    border: '1px solid #e5e7eb',
    background: '#111827',
    color: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  uploadLabel: {
    padding: '6px 10px',
    border: '1px dashed #cbd5e1',
    borderRadius: 6,
    cursor: 'pointer',
    color: '#374151',
    fontSize: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 10,
    marginTop: 8,
  },
  empty: {
    color: '#6b7280',
    fontSize: 12,
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 8,
    background: '#fff',
  },
  thumbWrap: {
    width: '100%',
    height: 72,
    overflow: 'hidden',
    borderRadius: 6,
    marginBottom: 8,
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 6,
  },
  btnSm: {
    padding: '4px 6px',
    border: '1px solid #e5e7eb',
    background: '#111827',
    color: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
  },
  btnSmDanger: {
    padding: '4px 6px',
    border: '1px solid #fecaca',
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
  },
}
