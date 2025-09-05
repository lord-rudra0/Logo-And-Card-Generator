import { postJson } from './api.js'

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
