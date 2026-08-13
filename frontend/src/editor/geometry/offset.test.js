import { describe, expect, it } from 'vitest'
import { offsetPolygon } from './offset.js'

function boundingBox(points) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('offsetPolygon', () => {
  it('grows an axis-aligned square outward by exactly the requested distance on each side', () => {
    const [result] = offsetPolygon(SQUARE, 5, true)
    const bbox = boundingBox(result)
    expect(bbox.minX).toBeCloseTo(-5, 1)
    expect(bbox.maxX).toBeCloseTo(15, 1)
    expect(bbox.minY).toBeCloseTo(-5, 1)
    expect(bbox.maxY).toBeCloseTo(15, 1)
  })

  it('shrinks an axis-aligned square inward by exactly the requested distance (negative offset)', () => {
    const [result] = offsetPolygon(SQUARE, -3, true)
    const bbox = boundingBox(result)
    expect(bbox.minX).toBeCloseTo(3, 1)
    expect(bbox.maxX).toBeCloseTo(7, 1)
    expect(bbox.minY).toBeCloseTo(3, 1)
    expect(bbox.maxY).toBeCloseTo(7, 1)
  })

  it('produces a closed loop with more points than the input (rounded corners)', () => {
    const [result] = offsetPolygon(SQUARE, 5, true)
    expect(result.length).toBeGreaterThan(SQUARE.length)
  })

  it('is a no-op for a zero distance', () => {
    const [result] = offsetPolygon(SQUARE, 0, true)
    expect(result).toEqual(SQUARE)
  })
})
