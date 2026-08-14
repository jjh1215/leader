import { describe, expect, it } from 'vitest'
import { snapOrthogonal } from './snap.js'

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
