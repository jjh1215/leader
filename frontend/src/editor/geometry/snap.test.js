import { describe, expect, it } from 'vitest'
import { projectPointOntoLine, snapOrthogonal } from './snap.js'

describe('snapOrthogonal', () => {
  it('snaps to horizontal when the raw direction is more horizontal than vertical', () => {
    const result = snapOrthogonal({ x: 0, y: 0 }, { x: 10, y: 3 })
    expect(result).toEqual({ x: 10, y: 0 })
  })

  it('snaps to vertical when the raw direction is more vertical than horizontal', () => {
    const result = snapOrthogonal({ x: 0, y: 0 }, { x: 3, y: 10 })
    expect(result).toEqual({ x: 0, y: 10 })
  })

  it('is exact for already-orthogonal input', () => {
    expect(snapOrthogonal({ x: 5, y: 5 }, { x: 20, y: 5 })).toEqual({ x: 20, y: 5 })
    expect(snapOrthogonal({ x: 5, y: 5 }, { x: 5, y: 20 })).toEqual({ x: 5, y: 20 })
  })
})

describe('projectPointOntoLine', () => {
  it('projects perpendicular onto a vertical line', () => {
    expect(projectPointOntoLine({ x: 7, y: 5 }, { x: 10, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 5 })
  })

  it('extends past the segment (not clamped, unlike edge projection)', () => {
    // lineA-lineB only spans y 0..10, but the projection of a point far
    // beyond that range still lands on the infinite line, not clamped to it.
    expect(projectPointOntoLine({ x: 3, y: 100 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toEqual({ x: 0, y: 100 })
  })

  it('returns the shared point for a degenerate (zero-length) line', () => {
    expect(projectPointOntoLine({ x: 5, y: 5 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 })
  })
})
