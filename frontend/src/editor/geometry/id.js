// crypto.randomUUID() requires a "secure context" (HTTPS or localhost) in
// browsers -- it silently throws on plain-HTTP, non-loopback origins, which
// is exactly how this app is deployed (http://<server-ip>:13000). Fall back
// to crypto.getRandomValues() (no secure-context restriction), then to
// Math.random() as a last resort. These ids are only ever local identifiers
// for editor state, never security tokens, so collision resistance from
// getRandomValues/Math.random is more than sufficient.
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // insecure context: fall through to the manual generator below
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-')
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
