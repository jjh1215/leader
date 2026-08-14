// Detects whether a closed 4-vertex piece is (still) an axis-aligned
// rectangle, regardless of vertex order -- used to decide whether to offer
// width/height numeric editing on a selected piece. Vertices may have drifted
// from the original ADD_RECT_PIECE order via manual dragging, so this checks
// the actual point set against the shape's own bounding box rather than
// assuming a fixed corner order.
export function isAxisAlignedRect(vertices) {
  if (vertices.length !== 4) return null

  const xs = vertices.map((v) => v.point.x)
  const ys = vertices.map((v) => v.point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (maxX - minX < 1e-9 || maxY - minY < 1e-9) return null

  const expectedCorners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const remaining = [...expectedCorners]
  for (const v of vertices) {
    const idx = remaining.findIndex((c) => Math.abs(c.x - v.point.x) < 1e-6 && Math.abs(c.y - v.point.y) < 1e-6)
    if (idx === -1) return null
    remaining.splice(idx, 1)
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY }
}
