// Point-to-path distance, used for hit-testing a click against a piece's
// rendered outline (as opposed to just its vertices).
function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY)
}

// Minimum distance from `point` to the polyline `polygon` (already-flattened
// {x,y} points, e.g. from fillet.js's flattenToPolygon).
export function distanceToPolyline(point, polygon, closed) {
  if (polygon.length < 2) return Infinity
  let min = Infinity
  const segCount = closed ? polygon.length : polygon.length - 1
  for (let i = 0; i < segCount; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const d = pointToSegmentDistance(point, a, b)
    if (d < min) min = d
  }
  return min
}

// Standard ray-casting point-in-polygon test, for hitting a closed piece's
// filled interior (e.g. to drag-move the whole piece) as opposed to just its
// edges/vertices.
export function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = a.y > point.y !== b.y > point.y
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}
