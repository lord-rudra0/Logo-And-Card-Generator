import fetch from 'node-fetch'

const PY_ML_URL = process.env.PY_IMAGE_SERVICE_URL || process.env.ML_BASE_URL || null

const DEFAULT_NEGATIVE_PROMPT = 'no people, no faces, no hands, no logos of other brands, no watermarks, no signatures, no text overlays, no busy backgrounds, avoid photorealistic scenes when a vector-style/logo/graphic is required.'

if (!PY_ML_URL) {
  console.warn('Python ML service not configured (pythonProxy will throw if used)')
}

// Forward payload to python ML endpoint at `path` (relative) while appending a negative_prompt.
// If payload already contains negative_prompt, append the defaults (separated by comma) instead of overwriting.
export async function forwardToPython(path, payload = {}, options = {}) {
  if (!PY_ML_URL) throw new Error('Python ML service not configured')
  const url = `${PY_ML_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  const headers = { 'Content-Type': 'application/json' }
  const requestId = (options && options.requestId) || (options.req && options.req.requestId) || null
  if (requestId) headers['X-Request-Id'] = requestId

  const body = { ...payload }
  try {
    if (body.negative_prompt && typeof body.negative_prompt === 'string' && body.negative_prompt.trim().length > 0) {
      // Append defaults, but avoid duplicates
      const existing = body.negative_prompt.trim()
      if (!existing.includes(DEFAULT_NEGATIVE_PROMPT)) body.negative_prompt = `${existing}, ${DEFAULT_NEGATIVE_PROMPT}`
    } else if (body.negative_prompt && Array.isArray(body.negative_prompt)) {
      // convert array to comma-separated string and append defaults
      const existing = body.negative_prompt.join(', ')
      body.negative_prompt = `${existing}, ${DEFAULT_NEGATIVE_PROMPT}`
    } else {
      body.negative_prompt = DEFAULT_NEGATIVE_PROMPT
    }
  } catch (e) {
    body.negative_prompt = DEFAULT_NEGATIVE_PROMPT
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
