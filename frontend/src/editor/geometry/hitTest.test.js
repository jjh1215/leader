import { describe, expect, it } from 'vitest'
import { distanceToPolyline } from './hitTest.js'

describe('distanceToPolyline', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]

  it('is ~0 for a point exactly on an edge', () => {
    expect(distanceToPolyline({ x: 5, y: 0 }, square, true)).toBeCloseTo(0, 6)
  })

  it('returns the perpendicular distance for a point off an edge', () => {
    expect(distanceToPolyline({ x: 5, y: 3 }, square, true)).toBeCloseTo(3, 6)
  })

  it('does not close an open polyline (no edge between last and first point)', () => {
    // (0,10) to (0,0) is only an edge when closed; for an open path the point
    // near that missing edge should be far from every real segment.
    const closedDist = distanceToPolyline({ x: 0, y: 5 }, square, true)
    const openDist = distanceToPolyline({ x: 0, y: 5 }, square, false)
    expect(closedDist).toBeCloseTo(0, 6)
    expect(openDist).toBeGreaterThan(4)
  })
})
