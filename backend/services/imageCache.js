import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const CACHE_DIR = path.resolve(new URL(import.meta.url).pathname, '..', 'cache')
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
  // Static serving base: /cache/
  return `/cache/${filename}`
}
