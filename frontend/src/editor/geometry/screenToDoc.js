// Converts pointer/screen coordinates into document mm coordinates, given the
// SVG element's current on-screen box and its viewBox (also in mm). This is the
// only place pixel<->mm conversion happens for interaction; stored data is never
// touched by zoom/pan.
export function screenToDocPoint(svgEl, viewBox, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect()
  const relX = (clientX - rect.left) / rect.width
  const relY = (clientY - rect.top) / rect.height
  return {
    x: viewBox.x + relX * viewBox.width,
    y: viewBox.y + relY * viewBox.height,
  }
}

// Converts a screen-pixel distance (e.g. a hit-test radius) into an equivalent
// mm distance at the current zoom level.
export function pxToMm(svgEl, viewBox, px) {
  const rect = svgEl.getBoundingClientRect()
  if (!rect.width) return px
  return px * (viewBox.width / rect.width)
}
