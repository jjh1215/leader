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
})
