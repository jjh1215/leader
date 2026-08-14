import { describe, expect, it } from 'vitest'
import { projectPointToPolyline, resolveDockPoint } from './edgeDock.js'

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('projectPointToPolyline', () => {
  it('projects onto the midpoint of the nearest edge', () => {
    const result = projectPointToPolyline({ x: 5, y: 3 }, square, true)
    expect(result.edgeIndex).toBe(0)
    expect(result.t).toBeCloseTo(0.5, 6)
    expect(result.point).toEqual({ x: 5, y: 0 })
    expect(result.distance).toBeCloseTo(3, 6)
  })

  it('returns distance 0 for a point exactly on a vertex', () => {
    const result = projectPointToPolyline({ x: 10, y: 0 }, square, true)
    expect(result.distance).toBeCloseTo(0, 6)
  })

  it('returns null for a degenerate polygon', () => {
    expect(projectPointToPolyline({ x: 0, y: 0 }, [{ x: 0, y: 0 }], true)).toBeNull()
  })
})

function rectPiece(id, minX, minY, maxX, maxY) {
  return {
    id,
    closed: true,
    vertices: [
      { id: `${id}-0`, point: { x: minX, y: minY }, cornerRadius: 0 },
      { id: `${id}-1`, point: { x: maxX, y: minY }, cornerRadius: 0 },
      { id: `${id}-2`, point: { x: maxX, y: maxY }, cornerRadius: 0 },
      { id: `${id}-3`, point: { x: minX, y: maxY }, cornerRadius: 0 },
    ],
  }
}

describe('resolveDockPoint', () => {
  it('kind:vertex tracks the target vertex\'s current point', () => {
    const pieces = [rectPiece('host', 0, 0, 10, 10)]
    const dock = { kind: 'vertex', targetPieceId: 'host', targetVertexId: 'host-1' }
    expect(resolveDockPoint(dock, pieces)).toEqual({ x: 10, y: 0 })
  })

  it('kind:vertex returns null when the target vertex no longer exists', () => {
    const pieces = [rectPiece('host', 0, 0, 10, 10)]
    const dock = { kind: 'vertex', targetPieceId: 'host', targetVertexId: 'gone' }
    expect(resolveDockPoint(dock, pieces)).toBeNull()
  })

  it('kind:edge interpolates along the current edge -- and follows it live when the host moves', () => {
    const dock = { kind: 'edge', targetPieceId: 'host', edgeIndex: 0, t: 0.5 }

    const before = [rectPiece('host', 0, 0, 10, 10)]
    expect(resolveDockPoint(dock, before)).toEqual({ x: 5, y: 0 })

    // Host resized (e.g. via SET_RECT_DIMENSIONS) -- same dock reference, new position.
    const after = [rectPiece('host', 0, 0, 40, 10)]
    expect(resolveDockPoint(dock, after)).toEqual({ x: 20, y: 0 })
  })

  it('returns null when the target piece is gone', () => {
    const dock = { kind: 'edge', targetPieceId: 'missing', edgeIndex: 0, t: 0.5 }
    expect(resolveDockPoint(dock, [])).toBeNull()
  })

  it('returns null when edgeIndex is out of range for the target\'s current geometry', () => {
    const pieces = [rectPiece('host', 0, 0, 10, 10)]
    const dock = { kind: 'edge', targetPieceId: 'host', edgeIndex: 99, t: 0.5 }
    expect(resolveDockPoint(dock, pieces)).toBeNull()
  })
})
