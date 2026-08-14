// Polygon boolean union, via the same clipper-lib engine already used for
// offsetting (see offset.js) -- this is the reverse of splitPolygon.js: two
// touching/overlapping closed shapes merge back into one, which is what
// makes split+merge a genuinely reversible pair of operations instead of
// needing separate "undo split" bookkeeping.
import ClipperLib from 'clipper-lib'

const SCALE = 1000 // mm -> integer units (micron precision), same as offset.js

function toClipperPath(points) {
  return points.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }))
}

function fromClipperPath(path) {
  return path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE }))
}

// Returns the union of two polygons (arrays of {x,y} mm points) as an array
// of resulting polygons -- normally 1 if they touch/overlap, but 2 (i.e. both
// unchanged) if they don't touch at all, since a "union" of disjoint shapes
// is still valid, just not a single merged loop.
export function unionPolygons(polyA, polyB) {
  const clipper = new ClipperLib.Clipper()
  clipper.AddPath(toClipperPath(polyA), ClipperLib.PolyType.ptSubject, true)
  clipper.AddPath(toClipperPath(polyB), ClipperLib.PolyType.ptClip, true)

  const solution = new ClipperLib.Paths()
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  )

  return solution.map(fromClipperPath)
}
