import { describe, expect, it } from 'vitest'
import { offsetOpenPolyline, placeStitchHoles, trimPolyline } from './stitch.js'

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

function hasHoleAt(holes, point) {
  return holes.some((h) => Math.abs(h.x - point.x) < 1e-9 && Math.abs(h.y - point.y) < 1e-9)
}

describe('placeStitchHoles', () => {
  it('keeps the exact requested pitch everywhere except the closing gap into each corner', () => {
    // Each 10mm edge fits round(10/4)=3 holes at the literal 4mm pitch (0,
    // 4, 8mm), leaving a short 2mm closing gap into the next corner instead
    // of shaving every gap down to an adjusted 3.33mm -- the correction
    // stays local to the corner, the base spacing elsewhere is untouched.
    const holes = placeStitchHoles(SQUARE_10, true, 4)
    expect(holes).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 10, y: 8 },
      { x: 10, y: 10 },
      { x: 6, y: 10 },
      { x: 2, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 6 },
      { x: 0, y: 2 },
    ])
    for (const corner of SQUARE_10) {
      expect(hasHoleAt(holes, corner)).toBe(true)
    }
    // Every gap is either the literal 4mm pitch or the one 2mm closing gap
    // per edge -- never anything in between (no whole-edge redistribution).
    for (let i = 0; i < holes.length; i++) {
      const next = holes[(i + 1) % holes.length]
      const d = boundaryDistance(holes[i], next)
      expect(d === 4 || d === 2).toBe(true)
    }
  })

  it('leaves a shorter closing gap (not a redistributed pitch) when the edge does not divide evenly', () => {
    // Each edge: round(10/6)=2 holes at the literal 6mm pitch (0, 6), then a
    // 4mm closing gap into the next corner -- not an adjusted 5mm throughout.
    const holes = placeStitchHoles(SQUARE_10, true, 6)
    expect(holes).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 10, y: 10 },
      { x: 4, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 4 },
    ])
  })

  it('anchors every corner even when edge lengths differ (the corner-drift bug this fixes)', () => {
    const rect = [{ x: 0, y: 0 }, { x: 34, y: 0 }, { x: 34, y: 24 }, { x: 0, y: 24 }]
    const holes = placeStitchHoles(rect, true, 5)
    for (const corner of rect) {
      expect(hasHoleAt(holes, corner)).toBe(true)
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

describe('trimPolyline', () => {
  it('trims both ends of a straight 2-point segment inward by insetMm', () => {
    const result = trimPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2)
    expect(result).toEqual([
      { x: 2, y: 0 },
      { x: 8, y: 0 },
    ])
  })

  it('trims along an arbitrary direction, not just axis-aligned', () => {
    const result = trimPolyline([{ x: 0, y: 0 }, { x: 6, y: 8 }], 2.5) // length 10
    expect(result[0].x).toBeCloseTo(1.5, 6)
    expect(result[0].y).toBeCloseTo(2, 6)
    expect(result[1].x).toBeCloseTo(4.5, 6)
    expect(result[1].y).toBeCloseTo(6, 6)
  })

  it('returns null when the inset would consume the whole line', () => {
    expect(trimPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5)).toBeNull()
    expect(trimPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 6)).toBeNull()
  })

  it('returns null for a zero-length line', () => {
    expect(trimPolyline([{ x: 3, y: 3 }, { x: 3, y: 3 }], 1)).toBeNull()
  })

  it('keeps interior bend points and trims each end within its own segment', () => {
    // L-shape: (0,0)->(5,0)->(5,5), each leg 5mm, total 10mm
    const result = trimPolyline(
      [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
      1
    )
    expect(result).toEqual([
      { x: 1, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
    ])
  })

  it("drops a bend point entirely swallowed by one end's trim", () => {
    // Short first leg (2mm), long second leg (20mm), total 22mm. Trimming
    // 5mm off the start eats past the short leg's bend point entirely.
    const result = trimPolyline(
      [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 20 }],
      5
    )
    expect(result).toEqual([
      { x: 2, y: 3 },
      { x: 2, y: 15 },
    ])
  })
})

describe('offsetOpenPolyline', () => {
  it('shifts a straight 2-point segment perpendicular to its direction', () => {
    const result = offsetOpenPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 3)
    expect(result[0].x).toBeCloseTo(0, 6)
    expect(result[0].y).toBeCloseTo(3, 6)
    expect(result[1].x).toBeCloseTo(10, 6)
    expect(result[1].y).toBeCloseTo(3, 6)
  })

  it('flips to the other side for a negative distance', () => {
    const result = offsetOpenPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], -3)
    expect(result[0].y).toBeCloseTo(-3, 6)
    expect(result[1].y).toBeCloseTo(-3, 6)
  })

  it('returns the same points for a zero distance', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    expect(offsetOpenPolyline(points, 0)).toBe(points)
  })
})
