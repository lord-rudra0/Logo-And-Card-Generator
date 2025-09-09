import fetch from 'node-fetch'

export function isPythonConfigured() {
  return Boolean(process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL)
}

const LOGO_NEGATIVE_PROMPT = 'no people, no faces, no hands, no photographic scenes, no stock photos, no watermarks, no signatures, no unrelated text overlays, avoid realistic backgrounds; produce clean vector-like artwork suitable for logos.'
const CARD_NEGATIVE_PROMPT = 'no people, no faces, no animals, no photographs, no busy scenes, no unrelated props, no watermarks, no logos of other brands, no text artifacts, no distorted or unreadable typography, no OCR-like characters, avoid overly complex photographic backgrounds; produce a clean, flat, print-ready card mockup or vector-friendly layout with sharp, legible text and correct margins.'

// Forward payload to python ML endpoint at `path` (relative) while appending a negative_prompt.
// If payload already contains negative_prompt, append the defaults (separated by comma) instead of overwriting.
export async function forwardToPython(path, payload = {}, options = {}) {
  const baseUrl = process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL || null
  if (!baseUrl) throw new Error('Python ML service not configured')
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  const headers = { 'Content-Type': 'application/json' }
  const requestId = (options && options.requestId) || (options.req && options.req.requestId) || null
  if (requestId) headers['X-Request-Id'] = requestId

  const body = { ...payload }
  try {
    // Determine which default negative prompt to use. Allow caller to override via options.defaultNegativePrompt
    let defaultNeg = options && options.defaultNegativePrompt
    if (!defaultNeg) {
      const p = (path || '').toString().toLowerCase()
      if (p.includes('logo')) defaultNeg = LOGO_NEGATIVE_PROMPT
      else if (p.includes('stability') || p.includes('card')) defaultNeg = CARD_NEGATIVE_PROMPT
      else defaultNeg = CARD_NEGATIVE_PROMPT
    }

    if (body.negative_prompt && typeof body.negative_prompt === 'string' && body.negative_prompt.trim().length > 0) {
      // Append defaults, but avoid duplicates
      const existing = body.negative_prompt.trim()
      if (!existing.includes(defaultNeg)) body.negative_prompt = `${existing}, ${defaultNeg}`
    } else if (body.negative_prompt && Array.isArray(body.negative_prompt)) {
      // convert array to comma-separated string and append defaults
      const existing = body.negative_prompt.join(', ')
      body.negative_prompt = `${existing}, ${defaultNeg}`
    } else {
      body.negative_prompt = defaultNeg
    }
  } catch (e) {
    body.negative_prompt = CARD_NEGATIVE_PROMPT
  }

  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch (_) { json = text }
  if (!r.ok) {
    const err = typeof json === 'string' ? json : (json && json.error) ? json.error : `Status ${r.status}`
    const e = new Error(`Python ML service error ${r.status}: ${err}`)
    e.status = r.status
    e.body = json
    throw e
  }
  return json
}

export default forwardToPython
