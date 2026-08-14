import { describe, expect, it } from 'vitest'
import { unionPolygons } from './polygonUnion.js'
import { splitClosedPolygonByLine } from './splitPolygon.js'

function bbox(loop) {
  return {
    minX: Math.min(...loop.map((p) => p.x)),
    maxX: Math.max(...loop.map((p) => p.x)),
    minY: Math.min(...loop.map((p) => p.y)),
    maxY: Math.max(...loop.map((p) => p.y)),
  }
}

describe('unionPolygons', () => {
  it('merges two touching rectangles back into a single loop with the combined bounding box', () => {
    const top = [
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const bottom = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]
    const result = unionPolygons(top, bottom)
    expect(result).toHaveLength(1)
    expect(bbox(result[0])).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 })
  })

  it('round-trips through split -> union back to the original bounding box', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const [loopA, loopB] = splitClosedPolygonByLine(square, { x: -5, y: 5 }, { x: 15, y: 5 })
    const merged = unionPolygons(loopA, loopB)
    expect(merged).toHaveLength(1)
    expect(bbox(merged[0])).toEqual(bbox(square))
  })

  it('returns two separate polygons when the inputs do not touch', () => {
    const a = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ]
    const b = [
      { x: 20, y: 20 },
      { x: 25, y: 20 },
      { x: 25, y: 25 },
      { x: 20, y: 25 },
    ]
    expect(unionPolygons(a, b)).toHaveLength(2)
  })
})
