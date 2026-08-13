// Builds an SVG path `d` string from a plain array of {x,y} mm points --
// used for rendering already-computed geometry (offset/stitch results),
// as opposed to fillet.js's verticesToPathD which builds from vertex+radius data.
export function pointsToPathD(points, closed) {
  if (points.length < 2) return ''
  const [first, ...rest] = points
  let d = `M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`
  for (const p of rest) {
    d += ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`
  }
  if (closed) d += ' Z'
  return d
}
