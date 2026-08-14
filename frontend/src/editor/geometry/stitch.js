// Places evenly-spaced stitch holes along an already-computed path (typically
// the inward-offset "stitch line" produced via offset.js with a negative
// distance). All coordinates in millimeters.

function polylineLength(points, closed) {
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
  }
  if (closed && points.length > 1) {
    total += Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y)
  }
  return total
}

function pointAndSegmentAtDistance(points, targetDist) {
  let remaining = targetDist
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= segLen || i === n - 2) {
      const t = segLen === 0 ? 0 : Math.min(1, Math.max(0, remaining / segLen))
      return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, segmentIndex: i }
    }
    remaining -= segLen
  }
  return { point: points[n - 1], segmentIndex: n - 2 }
}

// Trims insetMm off both ends of an open polyline (used for stitching along
// an internalLine, where "inset" can't mean an inward polygon offset like it
// does for a piece boundary -- there's no interior side to offset into, only
// two ends to pull back from so holes don't land right on the piece's outer
// edge). Works for a bent multi-point line, not just a straight 2-point
// segment -- interior points swallowed entirely by a trimmed-off end are
// dropped, and the rest keep their shape. Returns null if the line is too
// short to survive the trim.
export function trimPolyline(points, insetMm) {
  if (points.length < 2) return null
  const total = polylineLength(points, false)
  if (total <= 0 || insetMm * 2 >= total) return null

  const start = pointAndSegmentAtDistance(points, insetMm)
  const end = pointAndSegmentAtDistance([...points].reverse(), insetMm)
  const endSegmentIndex = points.length - 2 - end.segmentIndex

  const interior = points.slice(start.segmentIndex + 1, Math.max(start.segmentIndex + 1, endSegmentIndex + 1))
  return [start.point, ...interior, end.point]
}

// Shifts every point of an open polyline sideways by distanceMm, perpendicular
// to its local direction (positive = 90° counter-clockwise from the A->B
// direction, i.e. "rotate (dx,dy) left"). At interior bend points the two
// adjacent segments' perpendiculars are averaged (a simple bisector, not a
// true mitered offset) -- adequate for positioning a stitch-guide line, not
// meant for boolean-accurate boundary offsetting.
export function offsetOpenPolyline(points, distanceMm) {
  if (points.length < 2 || !distanceMm) return points
  const unitPerp = (ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    return len === 0 ? { x: 0, y: 0 } : { x: -dy / len, y: dx / len }
  }
  return points.map((p, i) => {
    let nx = 0
    let ny = 0
    if (i > 0) {
      const perp = unitPerp(points[i - 1].x, points[i - 1].y, p.x, p.y)
      nx += perp.x
      ny += perp.y
    }
    if (i < points.length - 1) {
      const perp = unitPerp(p.x, p.y, points[i + 1].x, points[i + 1].y)
      nx += perp.x
      ny += perp.y
    }
    const len = Math.hypot(nx, ny)
    if (len === 0) return p
    return { x: p.x + (nx / len) * distanceMm, y: p.y + (ny / len) * distanceMm }
  })
}

// Returns hole center points spaced at exactly pitchMm along the path, with
// a hole anchored at every vertex (corner). The base pitch is never
// adjusted -- only the single closing gap at the end of each edge (from the
// last full-pitch hole to the next corner) absorbs whatever's left over, so
// the correction stays local to the corner instead of shaving a bit off
// every gap along the whole edge. E.g. a 10mm edge at pitch 4mm places
// holes at 0, 4, 8mm (exactly 4mm apart, as requested) and leaves a 2mm
// closing gap into the next corner, rather than redistributing to 3.33mm
// everywhere.
export function placeStitchHoles(points, closed, pitchMm) {
  if (points.length < 2 || pitchMm <= 0) return []
  const n = points.length
  const segCount = closed ? n : n - 1

  const holes = []
  for (let i = 0; i < segCount; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    const count = segLen > 0 ? Math.max(1, Math.round(segLen / pitchMm)) : 1
    for (let k = 0; k < count; k++) {
      const dist = Math.min(k * pitchMm, segLen)
      const t = segLen > 0 ? dist / segLen : 0
      holes.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  if (!closed) {
    holes.push(points[n - 1]) // the final vertex is never a segment's own start above
  }
  return holes
}
