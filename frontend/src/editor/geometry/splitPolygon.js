// Splits a closed polygon into two closed loops along a straight cutting
// line, for the common "line drawn all the way across a shape" case.
// v1 scope: only handles exactly 2 boundary intersections (the line enters
// once and exits once) -- a line that grazes a corner, doesn't cross at all,
// or crosses a concave shape more than twice is rejected (returns null)
// rather than guessing, since silently producing wrong cut geometry on a
// physical cutting tool is worse than a clear "can't split this" refusal.
import { arcBetween } from './arcBetween.js'

function segmentIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x
  const d1y = p2.y - p1.y
  const d2x = p4.x - p3.x
  const d2y = p4.y - p3.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-9) return null // parallel or collinear

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null

  return { x: p1.x + t * d1x, y: p1.y + t * d1y }
}

function findBoundaryIntersections(polygon, lineStart, lineEnd) {
  const n = polygon.length
  const raw = []
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const point = segmentIntersection(a, b, lineStart, lineEnd)
    if (point) raw.push({ edgeIndex: i, point })
  }

  // Merge near-duplicate hits (a crossing that lands exactly on a shared
  // vertex gets reported by both adjacent edges).
  const merged = []
  for (const hit of raw) {
    const dup = merged.find((m) => Math.hypot(m.point.x - hit.point.x, m.point.y - hit.point.y) < 1e-6)
    if (!dup) merged.push(hit)
  }
  return merged
}

function buildLoop(from, to, polygon) {
  const n = polygon.length
  const points = [from.point]
  const endBound = to.edgeIndex + (to.edgeIndex < from.edgeIndex ? n : 0)
  for (let i = from.edgeIndex + 1; i <= endBound; i++) {
    points.push(polygon[i % n])
  }
  points.push(to.point)
  return points
}

// polygon: flattened {x,y} points of the closed shape being cut (see
// fillet.js's flattenToPolygon). lineStart/lineEnd: the cutting line's
// endpoints. Returns [loopA, loopB] (each a plain {x,y}[] ready to become a
// new Piece's vertices), or null if the line doesn't cross the boundary
// exactly twice.
export function splitClosedPolygonByLine(polygon, lineStart, lineEnd) {
  if (polygon.length < 3) return null

  const hits = findBoundaryIntersections(polygon, lineStart, lineEnd)
  if (hits.length !== 2) return null

  const [first, second] = hits.sort((a, b) => a.edgeIndex - b.edgeIndex)
  const loopA = buildLoop(first, second, polygon)
  const loopB = buildLoop(second, first, polygon)
  return [loopA, loopB]
}

// Splits a closed piece's own vertex list at 2 of its own existing vertices
// (by index) -- the exact inverse of stitchMerge.js's stitch: instead of
// general line-vs-boundary intersection math, this is a direct array split,
// used for "select the seam left by a merge (or any 2 vertices) and split
// there again" without needing to draw a fresh cutting line. Each output arc
// becomes a new closed piece; the gap between them (arc end -> arc start) is
// the new implicit seam edge, mirroring how splitClosedPolygonByLine leaves
// the cut line as each loop's closing edge.
// `vertices`: vertex-like objects with a `.point`, kept intact via reference
// (so cornerRadius/dock on non-cut vertices survive) -- ids are the caller's job.
// Returns [arcA, arcB], or null if the indices are invalid/equal or either
// resulting arc would be a degenerate <2-vertex sliver.
export function splitClosedPieceAtVertexIndices(vertices, indexA, indexB) {
  const n = vertices.length
  if (indexA === indexB || indexA < 0 || indexB < 0 || indexA >= n || indexB >= n) return null

  const arcA = arcBetween(vertices, indexA, indexB)
  const arcB = arcBetween(vertices, indexB, indexA)
  // Each side needs >=3 vertices to be a valid (non-zero-area) closed piece
  // -- rejects adjacent indices, which would leave one side just the 2 cut
  // points with nothing else (a zero-area sliver).
  if (arcA.length < 3 || arcB.length < 3) return null

  return [arcA, arcB]
}
