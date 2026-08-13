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
