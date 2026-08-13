const BASE = '/api/patterns'

async function handle(res) {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body || res.statusText}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function listPatterns() {
  return fetch(BASE).then(handle)
}

export function getPattern(id) {
  return fetch(`${BASE}/${id}`).then(handle)
}

export function createPattern({ name, content }) {
  return fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  }).then(handle)
}

export function updatePattern(id, { name, content }) {
  return fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  }).then(handle)
}

export function deletePattern(id) {
  return fetch(`${BASE}/${id}`, { method: 'DELETE' }).then(handle)
}
