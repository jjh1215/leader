import { describe, expect, it } from 'vitest'
import { splitClosedPieceAtVertexIndices, splitClosedPolygonByLine } from './splitPolygon.js'
import { stitchMergeAtSharedVertices } from './stitchMerge.js'

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

function v(x, y) {
  return { point: { x, y }, cornerRadius: 0 }
}

describe('splitClosedPieceAtVertexIndices', () => {
  it('splits a hexagon (the result of a prior split+merge) back at its own seam points', () => {
    // Exactly the 6-point shape stitchMerge.js produces when re-joining a
    // split square: 4 original corners + the 2 seam points at index 0 and 3.
    const merged = [v(10, 5), v(10, 10), v(0, 10), v(0, 5), v(0, 0), v(10, 0)]
    const result = splitClosedPieceAtVertexIndices(merged, 0, 3)
    expect(result).not.toBeNull()
    const [arcA, arcB] = result
    expect(arcA.map((p) => p.point)).toEqual([
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ])
    expect(arcB.map((p) => p.point)).toEqual([
      { x: 0, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ])
  })

  it('round-trips: split by line -> merge (stitch) -> split at the seam vertices -> back to the original two halves', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    const [loopA, loopB] = splitClosedPolygonByLine(square, { x: -5, y: 5 }, { x: 15, y: 5 })
    const merged = stitchMergeAtSharedVertices(
      loopA.map((p) => ({ point: p, cornerRadius: 0 })),
      loopB.map((p) => ({ point: p, cornerRadius: 0 }))
    )

    const seamIndices = [
      merged.findIndex((p) => p.point.x === 10 && p.point.y === 5),
      merged.findIndex((p) => p.point.x === 0 && p.point.y === 5),
    ]
    const [arcA, arcB] = splitClosedPieceAtVertexIndices(merged, ...seamIndices)
    expect(arcA.map((p) => p.point)).toEqual(loopA)
    expect(arcB.map((p) => p.point)).toEqual(loopB)
  })

  it('preserves cornerRadius on surviving vertices instead of regenerating them', () => {
    const shape = [{ ...v(0, 0), cornerRadius: 5 }, v(10, 0), v(10, 10), v(0, 10)]
    const [arcA] = splitClosedPieceAtVertexIndices(shape, 0, 2)
    expect(arcA.find((p) => p.point.x === 0 && p.point.y === 0).cornerRadius).toBe(5)
  })

  it('returns null for equal or out-of-range indices', () => {
    const shape = [v(0, 0), v(10, 0), v(10, 10), v(0, 10)]
    expect(splitClosedPieceAtVertexIndices(shape, 1, 1)).toBeNull()
    expect(splitClosedPieceAtVertexIndices(shape, 0, 99)).toBeNull()
  })

  it('returns null when the two indices are adjacent (one side would be a degenerate sliver)', () => {
    const shape = [v(0, 0), v(10, 0), v(10, 10), v(0, 10)]
    expect(splitClosedPieceAtVertexIndices(shape, 0, 1)).toBeNull()
  })
})
