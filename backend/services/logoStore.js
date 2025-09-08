// Simple in-memory store for last-generated logos keyed by requestId
// Note: this is intentionally lightweight and ephemeral (process memory). For production use
// consider a redis or persistent cache with eviction and user scoping.

const store = new Map()

export function setLastLogo(requestId, url) {
  if (!requestId || !url) return
  try {
    store.set(String(requestId), { url, ts: Date.now() })
  } catch (_) {}
}

export function getLastLogo(requestId) {
  if (!requestId) return null
  const item = store.get(String(requestId))
  if (!item) return null
  return item.url || null
}

export function getAndClearLastLogo(requestId) {
  if (!requestId) return null
  const key = String(requestId)
  const item = store.get(key)
  if (!item) return null
  store.delete(key)
  return item.url || null
}

export function clearOldEntries(maxAgeMs = 1000 * 60 * 60) {
  // Remove entries older than maxAgeMs (default 1 hour)
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    try {
      if (v && v.ts && now - v.ts > maxAgeMs) store.delete(k)
    } catch (_) { /* ignore */ }
  }
}

export default { setLastLogo, getLastLogo, getAndClearLastLogo, clearOldEntries }
