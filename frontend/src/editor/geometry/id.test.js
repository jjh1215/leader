import { describe, expect, it, vi } from 'vitest'
import { generateId } from './id.js'

describe('generateId', () => {
  it('returns unique-looking string ids', () => {
    const a = generateId()
    const b = generateId()
    expect(a).not.toBe(b)
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(0)
  })

  it('falls back to getRandomValues when randomUUID is unavailable (insecure-context simulation)', () => {
    const original = crypto.randomUUID
    // Simulate the real-world failure mode: crypto.randomUUID throws on
    // plain-HTTP, non-loopback origins (browser "secure context" restriction).
    crypto.randomUUID = () => {
      throw new DOMException('randomUUID requires a secure context')
    }
    try {
      const id = generateId()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      crypto.randomUUID = original
    }
  })

  it('falls back to Math.random when crypto is entirely unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    try {
      const id = generateId()
      expect(id).toMatch(/^id-/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
