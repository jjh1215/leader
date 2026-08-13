import { describe, expect, it } from 'vitest'
import { patternReducer, emptyDocument } from './patternReducer.js'

function initState(document = emptyDocument()) {
  return patternReducer(undefined, { type: 'LOAD', document })
}

describe('patternReducer', () => {
  it('undo reverts the last committed change, redo restores it', () => {
    let state = initState()
    state = patternReducer(state, { type: 'START_NEW_PIECE' })
    const pieceId = state.document.pieces[0].id
    state = patternReducer(state, { type: 'ADD_VERTEX', pieceId, point: { x: 0, y: 0 } })
    state = patternReducer(state, { type: 'ADD_VERTEX', pieceId, point: { x: 10, y: 0 } })
    expect(state.document.pieces[0].vertices).toHaveLength(2)

    state = patternReducer(state, { type: 'UNDO' })
    expect(state.document.pieces[0].vertices).toHaveLength(1)

    state = patternReducer(state, { type: 'REDO' })
    expect(state.document.pieces[0].vertices).toHaveLength(2)
  })

  it('a new action after undo clears the redo stack (standard undo/redo semantics)', () => {
    let state = initState()
    state = patternReducer(state, { type: 'START_NEW_PIECE' })
    const pieceId = state.document.pieces[0].id
    state = patternReducer(state, { type: 'ADD_VERTEX', pieceId, point: { x: 0, y: 0 } })
    state = patternReducer(state, { type: 'ADD_VERTEX', pieceId, point: { x: 10, y: 0 } })
    state = patternReducer(state, { type: 'UNDO' })
    expect(state.future).toHaveLength(1)

    state = patternReducer(state, { type: 'ADD_VERTEX', pieceId, point: { x: 5, y: 5 } })
    expect(state.future).toHaveLength(0)
  })

  it('deleting the active/selected piece clears activePieceId, toolMode, and selection', () => {
    let state = initState()
    state = patternReducer(state, { type: 'START_NEW_PIECE' })
    const pieceId = state.document.pieces[0].id
    expect(state.activePieceId).toBe(pieceId)
    expect(state.toolMode).toBe('draw-line')

    state = patternReducer(state, { type: 'ADD_VERTEX', pieceId, point: { x: 0, y: 0 } })
    const vertexId = state.document.pieces[0].vertices[0].id
    state = patternReducer(state, { type: 'SELECT_VERTEX', pieceId, vertexId })

    state = patternReducer(state, { type: 'DELETE_PIECE', pieceId })
    expect(state.document.pieces).toHaveLength(0)
    expect(state.activePieceId).toBeNull()
    expect(state.toolMode).toBe('select')
    expect(state.selection).toBeNull()
  })

  it('deleting a piece also removes its dependent stitch lines and offset paths', () => {
    let state = initState()
    state = patternReducer(state, { type: 'START_NEW_PIECE' })
    const pieceId = state.document.pieces[0].id
    state = patternReducer(state, {
      type: 'ADD_OFFSET_PATH',
      offsetPath: { id: 'o1', name: 'o', sourcePieceId: pieceId, offsetDistance: 5 },
    })
    state = patternReducer(state, {
      type: 'ADD_STITCH_LINE',
      stitchLine: { id: 's1', name: 's', sourcePieceId: pieceId, insetDistance: 3, stitchPatternDefId: 'd1' },
    })
    expect(state.document.offsetPaths).toHaveLength(1)
    expect(state.document.stitchLines).toHaveLength(1)

    state = patternReducer(state, { type: 'DELETE_PIECE', pieceId })
    expect(state.document.offsetPaths).toHaveLength(0)
    expect(state.document.stitchLines).toHaveLength(0)
  })

  it('ADD_RECT_PIECE creates a closed 4-vertex rectangle from two opposite corners', () => {
    let state = initState()
    state = patternReducer(state, {
      type: 'ADD_RECT_PIECE',
      corner1: { x: 10, y: 10 },
      corner2: { x: 0, y: 0 },
    })
    const piece = state.document.pieces[0]
    expect(piece.closed).toBe(true)
    expect(piece.vertices.map((v) => v.point)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])
    expect(state.toolMode).toBe('select')
    expect(state.selectedPieceIds).toEqual([piece.id])
  })

  it('ADD_LINE_PIECE creates an open 2-vertex piece', () => {
    let state = initState()
    state = patternReducer(state, {
      type: 'ADD_LINE_PIECE',
      start: { x: 0, y: 0 },
      end: { x: 20, y: 5 },
    })
    const piece = state.document.pieces[0]
    expect(piece.closed).toBe(false)
    expect(piece.vertices.map((v) => v.point)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 5 },
    ])
  })

  describe('SELECT_PIECE', () => {
    it('replaces the selection by default, and toggles additively with shift', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 2, y: 0 }, end: { x: 3, y: 0 } })
      const idB = state.document.pieces[1].id

      state = patternReducer(state, { type: 'SELECT_PIECE', pieceId: idA, additive: false })
      expect(state.selectedPieceIds).toEqual([idA])

      state = patternReducer(state, { type: 'SELECT_PIECE', pieceId: idB, additive: true })
      expect(state.selectedPieceIds).toEqual([idA, idB])

      // additive click on an already-selected piece toggles it back off
      state = patternReducer(state, { type: 'SELECT_PIECE', pieceId: idA, additive: true })
      expect(state.selectedPieceIds).toEqual([idB])
    })
  })

  describe('MERGE_PIECES', () => {
    it('joins two open pieces end-to-end via their closest endpoints, dropping the duplicate joint vertex', () => {
      let state = initState()
      // A: (0,0) -> (10,0).  B: (10,0) -> (10,10) -- B's start touches A's end.
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 10, y: 0 }, end: { x: 10, y: 10 } })
      const idB = state.document.pieces[1].id

      state = patternReducer(state, { type: 'MERGE_PIECES', pieceIdA: idA, pieceIdB: idB })
      expect(state.document.pieces).toHaveLength(1)
      const merged = state.document.pieces[0]
      expect(merged.closed).toBe(false)
      expect(merged.vertices.map((v) => v.point)).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ])
    })

    it('reverses pieces as needed so the closest endpoints always end up adjacent', () => {
      let state = initState()
      // A runs (0,0)->(10,0). B runs (10,10)->(10,0) (B's END touches A's end,
      // not B's start) -- must reverse B before concatenating.
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 10, y: 10 }, end: { x: 10, y: 0 } })
      const idB = state.document.pieces[1].id

      state = patternReducer(state, { type: 'MERGE_PIECES', pieceIdA: idA, pieceIdB: idB })
      const merged = state.document.pieces[0]
      expect(merged.vertices.map((v) => v.point)).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ])
    })

    it('is a no-op when either piece is closed', () => {
      let state = initState()
      state = patternReducer(state, {
        type: 'ADD_RECT_PIECE',
        corner1: { x: 0, y: 0 },
        corner2: { x: 10, y: 10 },
      })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 0 }, end: { x: 30, y: 0 } })
      const idB = state.document.pieces[1].id

      const before = state
      state = patternReducer(state, { type: 'MERGE_PIECES', pieceIdA: idA, pieceIdB: idB })
      expect(state).toBe(before)
    })
  })
})
