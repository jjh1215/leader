import { describe, expect, it } from 'vitest'
import { snapToNearbyVertex } from './dockSnap.js'

const pieces = [
  { vertices: [{ point: { x: 0, y: 0 } }, { point: { x: 10, y: 0 } }] },
  { vertices: [{ point: { x: 50, y: 50 } }] },
]

describe('snapToNearbyVertex', () => {
  it('snaps exactly onto the nearest vertex within threshold', () => {
    expect(snapToNearbyVertex({ x: 10.2, y: 0.1 }, pieces, 1)).toEqual({ x: 10, y: 0 })
  })

  it('leaves the point unchanged when nothing is within threshold', () => {
    const point = { x: 25, y: 25 }
    expect(snapToNearbyVertex(point, pieces, 1)).toEqual(point)
  })

  it('picks the closest vertex when multiple are within threshold', () => {
    expect(snapToNearbyVertex({ x: 4, y: 0 }, pieces, 10)).toEqual({ x: 0, y: 0 })
    expect(snapToNearbyVertex({ x: 6, y: 0 }, pieces, 10)).toEqual({ x: 10, y: 0 })
  })
})
