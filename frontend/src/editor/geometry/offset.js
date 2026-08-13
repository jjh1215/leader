// Robust polygon path offsetting, shared by feature #4 (outward material offset)
// and feature #3 (inward stitch-line inset) -- same engine, opposite sign.
//
// Hand-rolling this (reflex corners, self-intersection resolution) is a real
// research problem with high bug risk for a physical cutting tool, so this
// wraps the battle-tested Clipper algorithm (clipper-lib) instead of
// reimplementing polygon offsetting from scratch.
import ClipperLib from 'clipper-lib'

// mm -> integer scale for Clipper (which requires integer coordinates).
// 1000 gives micron precision, far finer than any leathercraft tolerance.
const SCALE = 1000

function toClipperPath(points) {
  return points.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }))
}

function fromClipperPath(path) {
  return path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE }))
}

// Offsets a polygon/polyline (array of {x,y} mm points) by distanceMm.
// Positive = outward (feature #4), negative = inward (feature #3's inset).
// `closed`: true for a closed piece outline, false for an open polyline.
// Returns an array of resulting loops/lines (each an array of {x,y} mm points)
// -- offsetting can split a shape into multiple pieces at sharp reflex corners,
// so callers should render/consume every entry, not just the first.
export function offsetPolygon(points, distanceMm, closed = true) {
  if (points.length < 2 || distanceMm === 0) return [points]

  const offset = new ClipperLib.ClipperOffset()
  const path = toClipperPath(points)
  const endType = closed ? ClipperLib.EndType.etClosedPolygon : ClipperLib.EndType.etOpenRound
  offset.AddPath(path, ClipperLib.JoinType.jtRound, endType)

  const solution = new ClipperLib.Paths()
  offset.Execute(solution, distanceMm * SCALE)

  return solution.map(fromClipperPath)
}
