// "Topological" merge for two closed pieces that share exactly 2 vertices --
// the standard case right after SPLIT_PIECE, since both halves keep the
// same 2 intersection points. Unlike a polygon boolean union (which throws
// away the input vertices entirely and regenerates a fresh point set), this
// walks and splices the *original* vertex objects, so every surviving point
// -- including the split points themselves -- stays exactly the individually
// selectable, draggable, fillet-preserving point it already was. That's the
// CAD-like expectation: splitting creates real points, and merging is meant
// to be its exact reverse, not a from-scratch re-triangulation.
//
// Falls back to null (caller should use a polygon union instead) whenever
// the two pieces don't share exactly 2 vertices -- e.g. two independently
// drawn overlapping shapes that were never split from one another.

import { arcBetween } from './arcBetween.js'

function pointsEqual(a, b, eps = 1e-6) {
  return Math.hypot(a.x - b.x, a.y - b.y) < eps
}

// The "real" arc between two shared points is whichever of the two possible
// directions has more vertices -- the other direction is just the bare cut
// edge (only the 2 shared points, nothing between) left over from the split.
function longerArc(vertices, i0, i1) {
  const forward = arcBetween(vertices, i0, i1)
  const backward = arcBetween(vertices, i1, i0)
  return forward.length >= backward.length ? { arc: forward, startsAt0: true } : { arc: backward, startsAt0: false }
}

// verticesA/verticesB: arrays of vertex-like objects with a `.point {x,y}`.
// Returns a merged array of the same shape (fresh ids are the caller's job),
// or null if the pieces don't share exactly 2 vertices.
export function stitchMergeAtSharedVertices(verticesA, verticesB) {
  const matches = []
  for (let i = 0; i < verticesA.length; i++) {
    for (let j = 0; j < verticesB.length; j++) {
      if (pointsEqual(verticesA[i].point, verticesB[j].point)) matches.push({ iA: i, iB: j })
    }
  }
  if (matches.length !== 2) return null
  const [m0, m1] = matches

  const { arc: arcA, startsAt0: arcAStartsAt0 } = longerArc(verticesA, m0.iA, m1.iA)
  const arcAEndTag = arcAStartsAt0 ? 1 : 0 // which match (m0/m1) arcA's last element is

  const { arc: arcB, startsAt0: arcBStartsAt0 } = longerArc(verticesB, m0.iB, m1.iB)
  const arcBStartTag = arcBStartsAt0 ? 0 : 1

  // Orient arcB so it continues from wherever arcA left off.
  const orientedArcB = arcBStartTag === arcAEndTag ? arcB : [...arcB].reverse()

  let merged = [...arcA, ...orientedArcB.slice(1)]
  // Splicing can leave the closing point duplicated at both ends (arcB's
  // last point circling back to arcA's first) -- drop the redundant copy,
  // since a closed piece's vertex list never repeats its own start point.
  if (merged.length > 1 && pointsEqual(merged[0].point, merged[merged.length - 1].point)) {
    merged = merged.slice(0, -1)
  }
  return merged
}
