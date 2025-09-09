import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

// cache directory (backend/services/cache) - resolve reliably on Windows and POSIX
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CACHE_DIR = path.join(__dirname, 'cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

export function saveBase64Image(dataUrl) {
  // dataUrl like data:image/png;base64,AAA...
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/)
  if (!m) throw new Error('Invalid data URL')
  const mime = m[1]
  const b64 = m[2]
  const ext = mime.split('/')[1] || 'png'
  const buffer = Buffer.from(b64, 'base64')
  const hash = crypto.createHash('sha1').update(buffer).digest('hex')
  const filename = `${hash}.${ext}`
  const filePath = path.join(CACHE_DIR, filename)
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, buffer)
  return { filename, path: filePath }
}

export function getCacheUrl(filename) {
  // Return an absolute URL so the frontend (dev server on a different origin)
  // can fetch the cached image directly from the backend.
  // Prefer BACKEND_URL env var, otherwise fall back to localhost with PORT.
  const backendBase = (process.env.BACKEND_URL && process.env.BACKEND_URL.replace(/\/$/, '')) ||
    `http://localhost:${process.env.PORT || 5000}`
  return `${backendBase}/cache/${filename}`
}

// Persist a cached file (by filename) or a raw data URL to the stored logos area.
export function ensureStoredDir() {
  const storedDir = path.join(CACHE_DIR, '..', '..', 'stored_logos')
  if (!fs.existsSync(storedDir)) fs.mkdirSync(storedDir, { recursive: true })
  return storedDir
}

export function storeCachedFile(filename) {
  const storedDir = ensureStoredDir()
  const src = path.join(CACHE_DIR, filename)
  if (!fs.existsSync(src)) throw new Error('cached file not found')
  const dest = path.join(storedDir, filename)
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest)
  const backendBase = (process.env.BACKEND_URL && process.env.BACKEND_URL.replace(/\/$/, '')) ||
    `http://localhost:${process.env.PORT || 5000}`
  return `${backendBase.replace(/\/$/, '')}/stored/${filename}`
}

export function storeDataUrl(dataUrl, filenameHint) {
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/)
  if (!m) throw new Error('Invalid data URL')
  const mime = m[1]
  const b64 = m[2]
  const ext = mime.split('/')[1] || 'png'
  const buffer = Buffer.from(b64, 'base64')
  const hash = crypto.createHash('sha1').update(buffer).digest('hex')
  const filename = `${(filenameHint && filenameHint.replace(/[^a-z0-9_.-]/gi,'') ) || hash}.${ext}`
  const storedDir = ensureStoredDir()
  const dest = path.join(storedDir, filename)
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, buffer)
  const backendBase = (process.env.BACKEND_URL && process.env.BACKEND_URL.replace(/\/$/, '')) ||
    `http://localhost:${process.env.PORT || 5000}`
  return `${backendBase.replace(/\/$/, '')}/stored/${filename}`
}
