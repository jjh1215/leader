import { describe, expect, it } from 'vitest'
import { insetSegment, placeStitchHoles } from './stitch.js'

const SQUARE_10 = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

// Distance walking ALONG the square's boundary between two points on it --
// unlike a straight Euclidean chord, this is unaffected by corners, so it's
// the right way to verify "evenly spaced by arc length" for points that may
// straddle a corner (a chord straight-line-cuts corners short, so plain
// Math.hypot between consecutive holes is *not* a valid spacing check here).
function boundaryDistance(a, b) {
  const cumulative = (p) => {
    if (p.y === 0) return p.x // bottom edge, x: 0..10
    if (p.x === 10) return 10 + p.y // right edge
    if (p.y === 10) return 20 + (10 - p.x) // top edge
    return 30 + (10 - p.y) // left edge
  }
  const diff = Math.abs(cumulative(b) - cumulative(a))
  return Math.min(diff, 40 - diff)
}

describe('placeStitchHoles', () => {
  it('places holes evenly (by arc length) around a closed square whose perimeter divides evenly by pitch', () => {
    // perimeter = 40mm, pitch 4mm -> exactly 10 holes, 4mm apart along the boundary
    const holes = placeStitchHoles(SQUARE_10, true, 4)
    expect(holes).toHaveLength(10)
    // Exact expected positions, hand-derived by walking the perimeter at 0,4,8,...,36mm.
    expect(holes).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 2 },
      { x: 10, y: 6 },
      { x: 10, y: 10 },
      { x: 6, y: 10 },
      { x: 2, y: 10 },
      { x: 0, y: 8 },
      { x: 0, y: 4 },
    ])
    for (let i = 0; i < holes.length; i++) {
      const next = holes[(i + 1) % holes.length]
      expect(boundaryDistance(holes[i], next)).toBeCloseTo(4, 6)
    }
  })

  it('adjusts pitch slightly so holes divide the perimeter evenly (no short leftover gap)', () => {
    // perimeter = 40mm, requested pitch 6mm -> round(40/6)=7 holes, adjusted pitch 40/7
    const holes = placeStitchHoles(SQUARE_10, true, 6)
    expect(holes).toHaveLength(7)
    const expectedSpacing = 40 / 7
    for (let i = 0; i < holes.length; i++) {
      const next = holes[(i + 1) % holes.length]
      expect(boundaryDistance(holes[i], next)).toBeCloseTo(expectedSpacing, 6)
    }
  })

  it('includes both endpoints for an open path', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const holes = placeStitchHoles(line, false, 5)
    expect(holes[0]).toEqual({ x: 0, y: 0 })
    expect(holes[holes.length - 1].x).toBeCloseTo(10, 6)
  })

  it('returns an empty array for degenerate input', () => {
    expect(placeStitchHoles([], true, 4)).toEqual([])
    expect(placeStitchHoles(SQUARE_10, true, 0)).toEqual([])
  })
})

describe('insetSegment', () => {
  it('trims both ends of a horizontal segment inward by insetMm', () => {
    const result = insetSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 2)
    expect(result).toEqual([
      { x: 2, y: 0 },
      { x: 8, y: 0 },
    ])
  })

  it('trims along an arbitrary direction, not just axis-aligned', () => {
    const result = insetSegment({ x: 0, y: 0 }, { x: 6, y: 8 }, 2.5) // length 10
    expect(result[0].x).toBeCloseTo(1.5, 6)
    expect(result[0].y).toBeCloseTo(2, 6)
    expect(result[1].x).toBeCloseTo(4.5, 6)
    expect(result[1].y).toBeCloseTo(6, 6)
  })

  it('returns null when the inset would consume the whole segment', () => {
    expect(insetSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 5)).toBeNull()
    expect(insetSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 6)).toBeNull()
  })

  it('returns null for a zero-length segment', () => {
    expect(insetSegment({ x: 3, y: 3 }, { x: 3, y: 3 }, 1)).toBeNull()
  })
})
