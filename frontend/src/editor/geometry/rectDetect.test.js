import { describe, expect, it } from 'vitest'
import { isAxisAlignedRect } from './rectDetect.js'

function v(x, y) {
  return { point: { x, y } }
}

describe('isAxisAlignedRect', () => {
  it('detects a rectangle in the standard ADD_RECT_PIECE corner order', () => {
    const result = isAxisAlignedRect([v(0, 0), v(10, 0), v(10, 5), v(0, 5)])
    expect(result).toEqual({ minX: 0, minY: 0, width: 10, height: 5 })
  })

  it('detects a rectangle regardless of vertex order', () => {
    const result = isAxisAlignedRect([v(10, 5), v(0, 0), v(0, 5), v(10, 0)])
    expect(result).toEqual({ minX: 0, minY: 0, width: 10, height: 5 })
  })

  it('rejects a non-rectangular quadrilateral', () => {
    expect(isAxisAlignedRect([v(0, 0), v(10, 0), v(10, 5), v(2, 5)])).toBeNull()
  })

  it('rejects a rotated (non-axis-aligned) square', () => {
    expect(isAxisAlignedRect([v(5, 0), v(10, 5), v(5, 10), v(0, 5)])).toBeNull()
  })

  it('rejects pieces without exactly 4 vertices', () => {
    expect(isAxisAlignedRect([v(0, 0), v(10, 0), v(10, 5)])).toBeNull()
  })
})
