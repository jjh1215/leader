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

function pointAtDistance(points, closed, targetDist) {
  let remaining = targetDist
  const n = points.length
  const segCount = closed ? n : n - 1
  for (let i = 0; i < segCount; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= segLen || i === segCount - 1) {
      const t = segLen === 0 ? 0 : Math.min(1, remaining / segLen)
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= segLen
  }
  return points[points.length - 1]
}

// Returns hole center points spaced at approximately pitchMm along the path.
// For closed paths the pitch is nudged so holes divide the perimeter evenly
// (total / round(total/pitch)) instead of leaving one short gap at the seam.
export function placeStitchHoles(points, closed, pitchMm) {
  if (points.length < 2 || pitchMm <= 0) return []
  const total = polylineLength(points, closed)
  if (total <= 0) return []

  const count = Math.max(1, Math.round(total / pitchMm))
  const adjustedPitch = total / count
  const holeCount = closed ? count : count + 1 // open path includes both endpoints

  const holes = []
  for (let i = 0; i < holeCount; i++) {
    holes.push(pointAtDistance(points, closed, i * adjustedPitch))
  }
  return holes
}
