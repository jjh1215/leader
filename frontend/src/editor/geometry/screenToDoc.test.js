import { describe, expect, it } from 'vitest'
import { pxToMm, screenToDocPoint } from './screenToDoc.js'

function fakeSvg(left, top, width, height) {
  return { getBoundingClientRect: () => ({ left, top, width, height }) }
}

describe('screenToDocPoint', () => {
  it('maps correctly when the element aspect ratio exactly matches the viewBox (no letterboxing)', () => {
    const viewBox = { x: 0, y: 0, width: 100, height: 100 }
    const svg = fakeSvg(0, 0, 200, 200) // 2x uniform scale, square, no slack
    expect(screenToDocPoint(svg, viewBox, 100, 100)).toEqual({ x: 50, y: 50 })
    expect(screenToDocPoint(svg, viewBox, 0, 0)).toEqual({ x: 0, y: 0 })
    expect(screenToDocPoint(svg, viewBox, 200, 200)).toEqual({ x: 100, y: 100 })
  })

  it('accounts for horizontal letterboxing when the element is wider than the viewBox aspect ratio', () => {
    // Square viewBox in a wide element: preserveAspectRatio="xMidYMid meet" (the
    // SVG default) scales to fit the height (the binding dimension) and centers
    // horizontally -- a naive per-axis stretch (the pre-fix bug) would instead
    // spread x across the full width, drifting away from the real cursor position.
    const viewBox = { x: 0, y: 0, width: 100, height: 100 }
    const svg = fakeSvg(0, 0, 400, 200) // height-bound: scale = 200/100 = 2, rendered width = 200, offsetX = 100
    // Click at the exact horizontal center of the element (x=200) should land at doc x=50 (viewBox center).
    expect(screenToDocPoint(svg, viewBox, 200, 100)).toEqual({ x: 50, y: 50 })
    // Click in the left letterbox margin (x=50, inside the 100px empty margin)
    // should map to before the viewBox's left edge, not a positive-but-wrong value.
    const leftMargin = screenToDocPoint(svg, viewBox, 50, 100)
    expect(leftMargin.x).toBeLessThan(0)
  })

  it('accounts for vertical letterboxing when the element is taller than the viewBox aspect ratio', () => {
    const viewBox = { x: 0, y: 0, width: 100, height: 100 }
    const svg = fakeSvg(0, 0, 200, 400) // width-bound: scale = 200/100 = 2, rendered height = 200, offsetY = 100
    expect(screenToDocPoint(svg, viewBox, 100, 200)).toEqual({ x: 50, y: 50 })
  })

  it('respects a non-zero viewBox origin (pan)', () => {
    const viewBox = { x: -20, y: 30, width: 100, height: 100 }
    const svg = fakeSvg(0, 0, 100, 100)
    expect(screenToDocPoint(svg, viewBox, 0, 0)).toEqual({ x: -20, y: 30 })
  })
})

describe('pxToMm', () => {
  it('uses the uniform meet-scale, not a per-axis width/height ratio', () => {
    const viewBox = { x: 0, y: 0, width: 100, height: 100 }
    const svg = fakeSvg(0, 0, 400, 200) // meet-scale is 2 (bound by height), not 4 (width/viewBox.width)
    expect(pxToMm(svg, viewBox, 20)).toBeCloseTo(10, 6)
  })
})
