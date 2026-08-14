// "Docking": while drawing, if a point lands within `thresholdMm` of an
// existing vertex (on any piece), snap exactly onto it instead of leaving a
// near-miss gap -- so two separately drawn lines end up sharing an exact
// coordinate and read as joined, with no hairline gap at the seam.
export function snapToNearbyVertex(point, pieces, thresholdMm) {
  let best = null
  let bestDist = thresholdMm
  for (const piece of pieces) {
    for (const v of piece.vertices) {
      const d = Math.hypot(v.point.x - point.x, v.point.y - point.y)
      if (d < bestDist) {
        bestDist = d
        best = v.point
      }
    }
  }
  return best ?? point
}
