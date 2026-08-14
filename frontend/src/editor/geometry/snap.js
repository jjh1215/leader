// Constrains a point to be exactly horizontal or vertical relative to a fixed
// origin -- whichever axis the raw direction is closer to. Used for the
// Shift-to-constrain-to-right-angles behavior while drawing lines.
export function snapOrthogonal(from, to) {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  return dx > dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
}

// Projects `point` onto the *infinite* line through lineA/lineB (unlike
// edgeDock.js's projectPointToPolyline, this is not clamped to the segment).
// Used to keep a dragged vertex collinear with its two boundary neighbors
// while Shift is held -- e.g. sliding an internal-line endpoint back and
// forth along the edge it sits on without letting it drift off that line.
export function projectPointOntoLine(point, lineA, lineB) {
  const dx = lineB.x - lineA.x
  const dy = lineB.y - lineA.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return { x: lineA.x, y: lineA.y }
  const t = ((point.x - lineA.x) * dx + (point.y - lineA.y) * dy) / lengthSq
  return { x: lineA.x + t * dx, y: lineA.y + t * dy }
}
