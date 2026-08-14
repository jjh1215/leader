import { describe, expect, it } from 'vitest'
import { splitClosedPolygonByLine } from './splitPolygon.js'

const square10 = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('splitClosedPolygonByLine', () => {
  it('splits a 10x10 square in half with a horizontal line through the middle', () => {
    const result = splitClosedPolygonByLine(square10, { x: -5, y: 5 }, { x: 15, y: 5 })
    expect(result).not.toBeNull()
    const [loopA, loopB] = result

    expect(loopA).toEqual([
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ])
    expect(loopB).toEqual([
      { x: 0, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ])

    // Sanity: each loop's bounding box is exactly one half of the square.
    const bbox = (loop) => ({
      minX: Math.min(...loop.map((p) => p.x)),
      maxX: Math.max(...loop.map((p) => p.x)),
      minY: Math.min(...loop.map((p) => p.y)),
      maxY: Math.max(...loop.map((p) => p.y)),
    })
    expect(bbox(loopA)).toEqual({ minX: 0, maxX: 10, minY: 5, maxY: 10 })
    expect(bbox(loopB)).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 5 })
  })

  it('returns null when the line misses the shape entirely (0 intersections)', () => {
    const result = splitClosedPolygonByLine(square10, { x: 20, y: 20 }, { x: 30, y: 30 })
    expect(result).toBeNull()
  })

  it('returns null when the line only enters without exiting (1 intersection)', () => {
    const result = splitClosedPolygonByLine(square10, { x: 5, y: 5 }, { x: 20, y: 5 })
    expect(result).toBeNull()
  })

  it('returns null when a concave shape is crossed more than twice (4 intersections)', () => {
    // A rectangle with a notch cut from the top middle -- at y=5 (below the
    // notch) the cross-section is two disconnected strips, so a full-width
    // horizontal line crosses the boundary 4 times.
    const notched = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 7, y: 10 },
      { x: 7, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 10 },
      { x: 0, y: 10 },
    ]
    const result = splitClosedPolygonByLine(notched, { x: -5, y: 5 }, { x: 15, y: 5 })
    expect(result).toBeNull()
  })

  it('returns null for a degenerate (<3 point) polygon', () => {
    expect(splitClosedPolygonByLine([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 5 }, { x: 5, y: 0 })).toBeNull()
  })
})
