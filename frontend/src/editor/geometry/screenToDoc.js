// Converts pointer/screen coordinates into document mm coordinates, given the
// SVG element's current on-screen box and its viewBox (also in mm). This is the
// only place pixel<->mm conversion happens for interaction; stored data is never
// touched by zoom/pan.
//
// The SVG uses the default preserveAspectRatio ("xMidYMid meet"): it scales
// uniformly (same factor on x and y, required for undistorted mm) to fit
// inside the element's box, then centers it -- letterboxing whichever axis
// has slack. The element's box is essentially never the same aspect ratio as
// the viewBox (the canvas area is a wide flex panel, the viewBox starts
// square), so that letterbox offset is real and must be accounted for, or
// clicks drift away from the cursor the further the two aspect ratios diverge.
function meetTransform(rect, viewBox) {
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height)
  const renderedWidth = viewBox.width * scale
  const renderedHeight = viewBox.height * scale
  const offsetX = (rect.width - renderedWidth) / 2
  const offsetY = (rect.height - renderedHeight) / 2
  return { scale, offsetX, offsetY }
}

export function screenToDocPoint(svgEl, viewBox, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect()
  const { scale, offsetX, offsetY } = meetTransform(rect, viewBox)
  return {
    x: viewBox.x + (clientX - rect.left - offsetX) / scale,
    y: viewBox.y + (clientY - rect.top - offsetY) / scale,
  }
}

// Converts a screen-pixel distance (e.g. a hit-test radius) into an equivalent
// mm distance at the current zoom level.
export function pxToMm(svgEl, viewBox, px) {
  const rect = svgEl.getBoundingClientRect()
  if (!rect.width || !rect.height) return px
  const { scale } = meetTransform(rect, viewBox)
  return px / scale
}
