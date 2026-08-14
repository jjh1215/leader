import { describe, expect, it } from 'vitest'
import { stitchMergeAtSharedVertices } from './stitchMerge.js'
import { splitClosedPolygonByLine } from './splitPolygon.js'

function toVerts(points) {
  return points.map((p, i) => ({ point: p, cornerRadius: 0, tag: `v${i}` }))
}

describe('stitchMergeAtSharedVertices', () => {
  it('reconstructs the full perimeter from two pieces split from the same square, keeping the split points as real vertices', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const [loopA, loopB] = splitClosedPolygonByLine(square, { x: -5, y: 5 }, { x: 15, y: 5 })

    const merged = stitchMergeAtSharedVertices(toVerts(loopA), toVerts(loopB))
    expect(merged).not.toBeNull()

    const points = merged.map((v) => v.point)
    // Walk in order and confirm it traces the square's perimeter with the
    // two split points (10,5) and (0,5) included as real, distinct vertices.
    expect(points).toEqual([
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    // No duplicated closing point.
    expect(points[0]).not.toEqual(points[points.length - 1])
  })

  it('preserves non-shared vertices\' own properties (e.g. cornerRadius) instead of regenerating them', () => {
    const a = [
      { point: { x: 0, y: 0 }, cornerRadius: 3 },
      { point: { x: 10, y: 0 }, cornerRadius: 0 },
      { point: { x: 10, y: 5 }, cornerRadius: 0 },
      { point: { x: 0, y: 5 }, cornerRadius: 0 },
    ]
    const b = [
      { point: { x: 0, y: 5 }, cornerRadius: 0 },
      { point: { x: 0, y: 10 }, cornerRadius: 7 },
      { point: { x: 10, y: 10 }, cornerRadius: 0 },
      { point: { x: 10, y: 5 }, cornerRadius: 0 },
    ]
    const merged = stitchMergeAtSharedVertices(a, b)
    const corner = merged.find((v) => v.point.x === 0 && v.point.y === 0)
    expect(corner.cornerRadius).toBe(3)
    const otherCorner = merged.find((v) => v.point.x === 0 && v.point.y === 10)
    expect(otherCorner.cornerRadius).toBe(7)
  })

  it('returns null when the pieces do not share exactly 2 vertices', () => {
    const a = toVerts([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])
    const b = toVerts([{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }])
    expect(stitchMergeAtSharedVertices(a, b)).toBeNull()
  })
})
