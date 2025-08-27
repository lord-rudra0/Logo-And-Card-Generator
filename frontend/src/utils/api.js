export async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const contentType = res.headers.get('content-type') || ''
  let data = null
  let text = ''
  try {
    if (contentType.includes('application/json')) {
      data = await res.json()
    } else {
      text = await res.text()
    }
  } catch (_) {
    // ignore parse errors; keep data/text as-is
  }

  return { ok: res.ok, status: res.status, statusText: res.statusText, data, text }
}
