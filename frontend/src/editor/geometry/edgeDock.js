// Live "point docked to an edge" constraint: a vertex can be pinned to a
// position along another piece's boundary (expressed as edgeIndex + t into
// that piece's *flattened* polygon, so fillets don't need special-casing)
// and recomputed whenever the host piece changes.
import { flattenToPolygon } from './fillet.js'

// Projects `point` onto the nearest segment of `polygon` (an array of {x,y},
// e.g. from flattenToPolygon). Returns the closest {edgeIndex, t, point,
// distance}, or null for a degenerate (<2 point) polygon.
export function projectPointToPolyline(point, polygon, closed) {
  if (polygon.length < 2) return null

  let best = null
  const segCount = closed ? polygon.length : polygon.length - 1
  for (let i = 0; i < segCount; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy
    let t = lengthSq === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq
    t = Math.max(0, Math.min(1, t))
    const proj = { x: a.x + t * dx, y: a.y + t * dy }
    const distance = Math.hypot(point.x - proj.x, point.y - proj.y)
    if (!best || distance < best.distance) {
      best = { edgeIndex: i, t, point: proj, distance }
    }
  }
  return best
}

// Recomputes a docked vertex's live position from its `dock` reference and
// the current document's pieces. Returns null when the target is gone or the
// reference is no longer valid (e.g. the target's flattened point count
// shrank below edgeIndex) -- the caller treats null as "constraint broken,
// fall back to the vertex's last absolute point."
export function resolveDockPoint(dock, pieces) {
  if (!dock) return null
  const target = pieces.find((p) => p.id === dock.targetPieceId)
  if (!target) return null

  if (dock.kind === 'vertex') {
    const v = target.vertices.find((vv) => vv.id === dock.targetVertexId)
    return v ? { x: v.point.x, y: v.point.y } : null
  }

  if (dock.kind === 'edge') {
    const polygon = flattenToPolygon(target.vertices, target.closed)
    const segCount = target.closed ? polygon.length : polygon.length - 1
    if (dock.edgeIndex < 0 || dock.edgeIndex >= segCount) return null
    const a = polygon[dock.edgeIndex]
    const b = polygon[(dock.edgeIndex + 1) % polygon.length]
    const t = Math.max(0, Math.min(1, dock.t))
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  }

  return null
}
