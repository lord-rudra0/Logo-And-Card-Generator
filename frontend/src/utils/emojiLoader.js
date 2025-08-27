// Utility to lazy-load a large emoji set (~1000+) from a CDN
// Cached in-memory to avoid repeat fetches. Returns an array of emoji characters.

let cache = null

export async function loadEmojis(limit = 1200) {
  if (cache) return cache
  try {
    const res = await fetch('https://unpkg.com/emoji.json@13.1.0/emoji.json')
    if (!res.ok) throw new Error('Failed to fetch emoji list')
    const data = await res.json()
    // data is an array of objects with {codes, char, name, ...}
    const chars = data.map(e => e.char).filter(Boolean)
    cache = chars.slice(0, limit)
    return cache
  } catch (e) {
    console.error('Emoji load failed:', e)
    cache = []
    return cache
  }
}
