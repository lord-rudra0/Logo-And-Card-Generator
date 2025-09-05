import { postJson } from './api.js'

// Note: mlApi functions are used in components; components can call useToast directly.
// For direct imports that need toast, callers should show toasts. Keep functions simple.

export async function recommendStyleAPI({ industry, mood } = {}) {
  const { ok, status, data, text } = await postJson('/api/ml/recommend-style', { industry, mood })
  if (!ok) throw new Error((data && (data.error || data.message)) || text || `HTTP ${status}`)
  return data.recommendation
}

export async function checkAccessibilityAPI(elements = []) {
  const { ok, status, data, text } = await postJson('/api/ml/check-accessibility', { elements })
  if (!ok) throw new Error((data && (data.error || data.message)) || text || `HTTP ${status}`)
  return data.report
}

export async function ocrAPI(imageBase64) {
  const { ok, status, data, text } = await postJson('/api/ml/ocr', { imageBase64 })
  if (!ok) throw new Error((data && (data.error || data.message)) || text || `HTTP ${status}`)
  return data.ocr
}

export async function generateLogoAPI(params = {}) {
  const { ok, status, data, text } = await postJson('/api/ml/generate-logo', params)
  if (!ok) throw new Error((data && (data.error || data.message)) || text || `HTTP ${status}`)
  return data.data || data
}
