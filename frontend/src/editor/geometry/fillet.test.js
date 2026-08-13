import { describe, expect, it } from 'vitest'
import { computeFillet, flattenToPolygon, verticesToPathD } from './fillet.js'

describe('computeFillet', () => {
  it('right-angle corner: tangent points sit exactly `radius` away from C along each edge', () => {
    // P=(0,10) - C=(0,0) - N=(10,0): a clean 90 degree corner.
    const P = { x: 0, y: 10 }
    const C = { x: 0, y: 0 }
    const N = { x: 10, y: 0 }
    const f = computeFillet(P, C, N, 3)
    expect(f).not.toBeNull()
    // tan(90/2)=1, so t = radius / 1 = radius exactly.
    expect(f.p1.x).toBeCloseTo(0, 6)
    expect(f.p1.y).toBeCloseTo(3, 6)
    expect(f.p2.x).toBeCloseTo(3, 6)
    expect(f.p2.y).toBeCloseTo(0, 6)
    expect(f.radius).toBeCloseTo(3, 6)
  })

  it('arc bulges toward the corner, not away from it (sanity check on the sweep direction)', () => {
    const P = { x: 0, y: 10 }
    const C = { x: 0, y: 0 }
    const N = { x: 10, y: 0 }
    const f = computeFillet(P, C, N, 3)
    // Sample the arc midpoint using the function's own center/radius/angle data.
    const midAngle = f.startAngle + f.angleDelta / 2
    const mid = {
      x: f.center.x + f.radius * Math.cos(midAngle),
      y: f.center.y + f.radius * Math.sin(midAngle),
    }
    const distMidToC = Math.hypot(mid.x - C.x, mid.y - C.y)
    const chordMid = { x: (f.p1.x + f.p2.x) / 2, y: (f.p1.y + f.p2.y) / 2 }
    const distChordMidToC = Math.hypot(chordMid.x - C.x, chordMid.y - C.y)
    // The rounded corner must stay between the tangent chord and the original vertex,
    // i.e. closer to C than the chord midpoint -- otherwise it bulged the wrong way.
    expect(distMidToC).toBeLessThan(distChordMidToC)
  })

  it('clamps radius when the adjacent segment is too short to fit it', () => {
    const P = { x: 0, y: 1 } // segment length 1 from C
    const C = { x: 0, y: 0 }
    const N = { x: 10, y: 0 }
    const f = computeFillet(P, C, N, 5) // requested radius way bigger than segment
    expect(f.radius).toBeLessThan(5)
    expect(f.p1.y).toBeLessThanOrEqual(1)
  })

  it('returns null for a straight-through vertex (no real corner)', () => {
    const P = { x: -10, y: 0 }
    const C = { x: 0, y: 0 }
    const N = { x: 10, y: 0 }
    expect(computeFillet(P, C, N, 3)).toBeNull()
  })

  it('returns null when radius is zero', () => {
    const P = { x: 0, y: 10 }
    const C = { x: 0, y: 0 }
    const N = { x: 10, y: 0 }
    expect(computeFillet(P, C, N, 0)).toBeNull()
  })
})

describe('verticesToPathD', () => {
  it('draws a sharp-cornered closed square with plain L commands and no arcs', () => {
    const vertices = [
      { point: { x: 0, y: 0 }, cornerRadius: 0 },
      { point: { x: 10, y: 0 }, cornerRadius: 0 },
      { point: { x: 10, y: 10 }, cornerRadius: 0 },
      { point: { x: 0, y: 10 }, cornerRadius: 0 },
    ]
    const d = verticesToPathD(vertices, true)
    expect(d).not.toContain('A ')
    expect(d.endsWith('Z')).toBe(true)
  })

  it('draws a closed square with one rounded corner using an arc command', () => {
    const vertices = [
      { point: { x: 0, y: 0 }, cornerRadius: 2 },
      { point: { x: 10, y: 0 }, cornerRadius: 0 },
      { point: { x: 10, y: 10 }, cornerRadius: 0 },
      { point: { x: 0, y: 10 }, cornerRadius: 0 },
    ]
    const d = verticesToPathD(vertices, true)
    expect(d).toContain('A ')
  })
})

describe('flattenToPolygon', () => {
  it('produces a dense polygon whose bounding box roughly matches a rounded square', () => {
    const vertices = [
      { point: { x: 0, y: 0 }, cornerRadius: 2 },
      { point: { x: 10, y: 0 }, cornerRadius: 2 },
      { point: { x: 10, y: 10 }, cornerRadius: 2 },
      { point: { x: 0, y: 10 }, cornerRadius: 2 },
    ]
    const pts = flattenToPolygon(vertices, true, 16)
    expect(pts.length).toBeGreaterThan(8)
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1e-6)
    expect(Math.max(...xs)).toBeLessThanOrEqual(10 + 1e-6)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1e-6)
    expect(Math.max(...ys)).toBeLessThanOrEqual(10 + 1e-6)
  })
})
