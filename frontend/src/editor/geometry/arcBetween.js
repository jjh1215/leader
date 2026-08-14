// Walks a closed vertex loop forward from index iStart to iEnd, wrapping
// around the end if needed. Shared by stitchMerge.js (walking the "real"
// side of a shared-vertex pair) and splitPolygon.js's vertex-index split
// (the exact inverse: cutting a piece at two of its own existing vertices).
export function arcBetween(vertices, iStart, iEnd) {
  const n = vertices.length
  const arc = []
  let i = iStart
  while (true) {
    arc.push(vertices[i])
    if (i === iEnd) break
    i = (i + 1) % n
  }
  return arc
}
