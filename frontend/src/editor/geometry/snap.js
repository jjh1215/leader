// Constrains a point to be exactly horizontal or vertical relative to a fixed
// origin -- whichever axis the raw direction is closer to. Used for the
// Shift-to-constrain-to-right-angles behavior while drawing lines.
export function snapOrthogonal(from, to) {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  return dx > dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
}
