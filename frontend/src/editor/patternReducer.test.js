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

  describe('SET_LINE_DIMENSIONS', () => {
    it('repositions the second vertex from the first by exact length and angle', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 5, y: 5 }, end: { x: 999, y: 999 } })
      const pieceId = state.document.pieces[0].id

      state = patternReducer(state, { type: 'SET_LINE_DIMENSIONS', pieceId, length: 10, angleDeg: 0 })
      let end = state.document.pieces[0].vertices[1].point
      expect(end.x).toBeCloseTo(15, 6)
      expect(end.y).toBeCloseTo(5, 6)

      state = patternReducer(state, { type: 'SET_LINE_DIMENSIONS', pieceId, length: 10, angleDeg: 90 })
      end = state.document.pieces[0].vertices[1].point
      expect(end.x).toBeCloseTo(5, 6)
      expect(end.y).toBeCloseTo(15, 6)
    })
  })

  describe('SET_RECT_DIMENSIONS', () => {
    it('rescales a rectangle to exact width/height anchored at minX/minY', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const pieceId = state.document.pieces[0].id

      state = patternReducer(state, { type: 'SET_RECT_DIMENSIONS', pieceId, minX: 0, minY: 0, width: 30, height: 20 })
      const points = state.document.pieces[0].vertices.map((v) => v.point)
      expect(points).toEqual([
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 20 },
        { x: 0, y: 20 },
      ])
    })

    it('preserves each vertex\'s corner role instead of scrambling order after manual dragging', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const pieceId = state.document.pieces[0].id
      // Simulate the vertices having been reordered/dragged so they are no
      // longer in the canonical ADD_RECT_PIECE perimeter order -- swap
      // vertex 0 and vertex 2 (opposite corners) in the array.
      const original = state.document.pieces[0].vertices
      const shuffled = [original[2], original[1], original[0], original[3]]
      state = {
        ...state,
        document: {
          ...state.document,
          pieces: [{ ...state.document.pieces[0], vertices: shuffled }],
        },
      }

      state = patternReducer(state, { type: 'SET_RECT_DIMENSIONS', pieceId, minX: 0, minY: 0, width: 40, height: 20 })
      const points = state.document.pieces[0].vertices.map((v) => v.point)
      // Corner roles must be preserved: what was (10,10) [maxX,maxY] must
      // become (40,20) [new maxX,maxY], not silently become (0,0).
      expect(points).toEqual([
        { x: 40, y: 20 },
        { x: 40, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 20 },
      ])
      // And it must still trace a proper (non-self-crossing) rectangle perimeter.
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      expect(new Set(xs)).toEqual(new Set([0, 40]))
      expect(new Set(ys)).toEqual(new Set([0, 20]))
    })
  })

  describe('SELECT_PIECES', () => {
    it('replaces the selection by default, or unions with it additively', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 2, y: 0 }, end: { x: 3, y: 0 } })
      const idB = state.document.pieces[1].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 4, y: 0 }, end: { x: 5, y: 0 } })
      const idC = state.document.pieces[2].id

      state = patternReducer(state, { type: 'SELECT_PIECES', pieceIds: [idA, idB], additive: false })
      expect(state.selectedPieceIds).toEqual([idA, idB])

      state = patternReducer(state, { type: 'SELECT_PIECES', pieceIds: [idB, idC], additive: true })
      expect(new Set(state.selectedPieceIds)).toEqual(new Set([idA, idB, idC]))
    })
  })

  describe('DELETE_PIECES', () => {
    it('removes all listed pieces and their dependents in a single history step', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 2, y: 0 }, end: { x: 3, y: 0 } })
      const idB = state.document.pieces[1].id
      state = patternReducer(state, {
        type: 'ADD_OFFSET_PATH',
        offsetPath: { id: 'o1', name: 'o', sourcePieceId: idA, offsetDistance: 5 },
      })
      state = patternReducer(state, { type: 'SELECT_PIECES', pieceIds: [idA, idB], additive: false })

      const before = state
      state = patternReducer(state, { type: 'DELETE_PIECES', pieceIds: [idA, idB] })
      expect(state.document.pieces).toHaveLength(0)
      expect(state.document.offsetPaths).toHaveLength(0)
      expect(state.selectedPieceIds).toEqual([])

      // one undo restores both pieces (and the offset path) at once
      state = patternReducer(state, { type: 'UNDO' })
      expect(state.document.pieces).toHaveLength(2)
      expect(state.document.offsetPaths).toHaveLength(1)
      expect(state).not.toBe(before) // sanity: undo landed on a fresh object, not a no-op
    })
  })

  describe('edge docking (live constraint)', () => {
    it('a vertex docked to a host edge follows it when the host is resized', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const hostId = state.document.pieces[0].id

      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 20 }, end: { x: 25, y: 25 } })
      const linePieceId = state.document.pieces[1].id
      const vertexId = state.document.pieces[1].vertices[0].id

      // Dock that line's first vertex to the host's bottom edge (edgeIndex 0), midpoint.
      state = patternReducer(state, {
        type: 'MOVE_VERTEX',
        pieceId: linePieceId,
        vertexId,
        point: { x: 5, y: 0 },
        dock: { kind: 'edge', targetPieceId: hostId, edgeIndex: 0, t: 0.5 },
      })
      const dockedVertex = () => state.document.pieces.find((p) => p.id === linePieceId).vertices[0]
      expect(dockedVertex().point).toEqual({ x: 5, y: 0 })

      // Resize the host -- the docked point must follow the new edge position.
      state = patternReducer(state, {
        type: 'SET_RECT_DIMENSIONS',
        pieceId: hostId,
        minX: 0,
        minY: 0,
        width: 40,
        height: 10,
      })
      expect(dockedVertex().point).toEqual({ x: 20, y: 0 })
      expect(dockedVertex().dock).not.toBeNull()
    })

    it('breaks the dock (keeps last position) when the host piece is deleted', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const hostId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 20 }, end: { x: 25, y: 25 } })
      const linePieceId = state.document.pieces[1].id
      const vertexId = state.document.pieces[1].vertices[0].id

      state = patternReducer(state, {
        type: 'MOVE_VERTEX',
        pieceId: linePieceId,
        vertexId,
        point: { x: 5, y: 0 },
        dock: { kind: 'edge', targetPieceId: hostId, edgeIndex: 0, t: 0.5 },
      })
      state = patternReducer(state, { type: 'DELETE_PIECE', pieceId: hostId })

      const v = state.document.pieces.find((p) => p.id === linePieceId).vertices[0]
      expect(v.dock).toBeNull()
      expect(v.point).toEqual({ x: 5, y: 0 })
    })

    it('a plain MOVE_VERTEX with no dock argument clears any prior dock (does not silently snap back)', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const hostId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 20 }, end: { x: 25, y: 25 } })
      const linePieceId = state.document.pieces[1].id
      const vertexId = state.document.pieces[1].vertices[0].id

      state = patternReducer(state, {
        type: 'MOVE_VERTEX',
        pieceId: linePieceId,
        vertexId,
        point: { x: 5, y: 0 },
        dock: { kind: 'edge', targetPieceId: hostId, edgeIndex: 0, t: 0.5 },
      })
      // Drag it away with no dock -- must land exactly at (50,50), not get
      // pulled back to the host edge by the next commit's resolveDocks pass.
      state = patternReducer(state, { type: 'MOVE_VERTEX', pieceId: linePieceId, vertexId, point: { x: 50, y: 50 } })
      const v = state.document.pieces.find((p) => p.id === linePieceId).vertices[0]
      expect(v.point).toEqual({ x: 50, y: 50 })
      expect(v.dock).toBeNull()
    })
  })

  describe('SPLIT_PIECE', () => {
    it('splits a rectangle into two closed pieces along a crossing line, consuming both inputs', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: -5, y: 5 }, end: { x: 15, y: 5 } })
      const lineId = state.document.pieces[1].id

      state = patternReducer(state, { type: 'SPLIT_PIECE', closedPieceId: rectId, linePieceId: lineId })
      expect(state.document.pieces).toHaveLength(2)
      expect(state.document.pieces.every((p) => p.closed)).toBe(true)
      expect(state.document.pieces.find((p) => p.id === rectId)).toBeUndefined()
      expect(state.document.pieces.find((p) => p.id === lineId)).toBeUndefined()

      const bbox = (piece) => {
        const xs = piece.vertices.map((v) => v.point.x)
        const ys = piece.vertices.map((v) => v.point.y)
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
      }
      const bboxes = state.document.pieces.map(bbox).sort((a, b) => a.minY - b.minY)
      expect(bboxes[0]).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 5 })
      expect(bboxes[1]).toEqual({ minX: 0, maxX: 10, minY: 5, maxY: 10 })
    })

    it('is a no-op when the line does not cross the shape exactly twice', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 20 }, end: { x: 30, y: 30 } })
      const lineId = state.document.pieces[1].id

      const before = state
      state = patternReducer(state, { type: 'SPLIT_PIECE', closedPieceId: rectId, linePieceId: lineId })
      expect(state).toBe(before)
    })
  })

  describe('MERGE_PIECES on two closed pieces', () => {
    it('re-merges two split halves via the CAD-like point stitch, keeping the split points as real vertices', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: -5, y: 5 }, end: { x: 15, y: 5 } })
      const lineId = state.document.pieces[1].id
      state = patternReducer(state, { type: 'SPLIT_PIECE', closedPieceId: rectId, linePieceId: lineId })
      const [idA, idB] = state.document.pieces.map((p) => p.id)

      state = patternReducer(state, { type: 'MERGE_PIECES', pieceIdA: idA, pieceIdB: idB })
      expect(state.document.pieces).toHaveLength(1)
      const merged = state.document.pieces[0]
      expect(merged.closed).toBe(true)
      // Stitch merge (not a from-scratch union) reconstructs the exact
      // 6-point perimeter -- the 4 original corners plus the 2 split points,
      // each an individually addressable vertex going forward.
      expect(merged.vertices.map((v) => v.point)).toEqual([
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 5 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ])
    })

    it('falls back to polygon union when the two closed pieces do not share exactly 2 vertices', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const idA = state.document.pieces[0].id
      // Overlapping but independently drawn -- no shared vertices at all.
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 5, y: 5 }, corner2: { x: 15, y: 15 } })
      const idB = state.document.pieces[1].id

      state = patternReducer(state, { type: 'MERGE_PIECES', pieceIdA: idA, pieceIdB: idB })
      expect(state.document.pieces).toHaveLength(1)
      const merged = state.document.pieces[0]
      const xs = merged.vertices.map((v) => v.point.x)
      const ys = merged.vertices.map((v) => v.point.y)
      expect(Math.min(...xs)).toBeCloseTo(0, 6)
      expect(Math.max(...xs)).toBeCloseTo(15, 6)
      expect(Math.min(...ys)).toBeCloseTo(0, 6)
      expect(Math.max(...ys)).toBeCloseTo(15, 6)
    })
  })

  describe('ADD_INTERNAL_LINE', () => {
    it('keeps the piece as one 6-vertex shape and records the crossing as an internalLine, instead of splitting it', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: -5, y: 5 }, end: { x: 15, y: 5 } })
      const lineId = state.document.pieces[1].id

      state = patternReducer(state, { type: 'ADD_INTERNAL_LINE', closedPieceId: rectId, linePieceId: lineId })

      // Still one piece -- not split -- and the line piece is consumed.
      expect(state.document.pieces).toHaveLength(1)
      const piece = state.document.pieces[0]
      expect(piece.id).toBe(rectId)
      expect(piece.closed).toBe(true)

      // 6 vertices now (hexagon-like): the original 4 corners plus the 2
      // crossing points, and the outer silhouette is unchanged (the new
      // points sit exactly on the existing edges).
      expect(piece.vertices.map((v) => v.point)).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 5 },
      ])

      // Original corners keep their own vertex identity (not regenerated).
      const originalCornerIds = new Set(
        state.past[state.past.length - 1].pieces[0].vertices.map((v) => v.id)
      )
      const survivingOriginalCorners = piece.vertices.filter((v) => originalCornerIds.has(v.id))
      expect(survivingOriginalCorners).toHaveLength(4)

      // The internal line connects the 2 new (non-original) vertices.
      expect(state.document.internalLines).toHaveLength(1)
      const line = state.document.internalLines[0]
      expect(line.sourcePieceId).toBe(rectId)
      const lineVertexIds = new Set([line.vertexIdA, line.vertexIdB])
      const lineVertices = piece.vertices.filter((v) => lineVertexIds.has(v.id))
      expect(lineVertices.map((v) => v.point).sort((a, b) => a.x - b.x)).toEqual([
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ])
      expect(lineVertices.every((v) => !originalCornerIds.has(v.id))).toBe(true)
    })

    it('is a no-op when the line does not cross the shape exactly twice', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 20 }, end: { x: 30, y: 30 } })
      const lineId = state.document.pieces[1].id

      const before = state
      state = patternReducer(state, { type: 'ADD_INTERNAL_LINE', closedPieceId: rectId, linePieceId: lineId })
      expect(state).toBe(before)
    })

    it('drops the internal line when one of its endpoint vertices is deleted', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: -5, y: 5 }, end: { x: 15, y: 5 } })
      const lineId = state.document.pieces[1].id
      state = patternReducer(state, { type: 'ADD_INTERNAL_LINE', closedPieceId: rectId, linePieceId: lineId })
      expect(state.document.internalLines).toHaveLength(1)

      const endpointId = state.document.internalLines[0].vertexIdA
      state = patternReducer(state, { type: 'DELETE_VERTEX', pieceId: rectId, vertexId: endpointId })
      expect(state.document.internalLines).toHaveLength(0)
    })

    it('a stitch line placed on an internal line is removed along with it (endpoint delete, piece delete)', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: -5, y: 5 }, end: { x: 15, y: 5 } })
      const lineId = state.document.pieces[1].id
      state = patternReducer(state, { type: 'ADD_INTERNAL_LINE', closedPieceId: rectId, linePieceId: lineId })
      const internalLineId = state.document.internalLines[0].id
      state = patternReducer(state, {
        type: 'ADD_STITCH_LINE',
        stitchLine: { id: 's1', name: 's', sourceInternalLineId: internalLineId, insetDistance: 1, stitchPatternDefId: 'd1' },
      })
      expect(state.document.stitchLines).toHaveLength(1)

      const endpointId = state.document.internalLines[0].vertexIdA
      state = patternReducer(state, { type: 'DELETE_VERTEX', pieceId: rectId, vertexId: endpointId })
      expect(state.document.internalLines).toHaveLength(0)
      expect(state.document.stitchLines).toHaveLength(0)
    })

    it('a stitch line placed on an internal line is removed when its source piece is deleted', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const rectId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: -5, y: 5 }, end: { x: 15, y: 5 } })
      const lineId = state.document.pieces[1].id
      state = patternReducer(state, { type: 'ADD_INTERNAL_LINE', closedPieceId: rectId, linePieceId: lineId })
      const internalLineId = state.document.internalLines[0].id
      state = patternReducer(state, {
        type: 'ADD_STITCH_LINE',
        stitchLine: { id: 's1', name: 's', sourceInternalLineId: internalLineId, insetDistance: 1, stitchPatternDefId: 'd1' },
      })

      state = patternReducer(state, { type: 'DELETE_PIECE', pieceId: rectId })
      expect(state.document.internalLines).toHaveLength(0)
      expect(state.document.stitchLines).toHaveLength(0)
    })
  })

  describe('TRANSLATE_PIECES', () => {
    it('shifts every vertex of the listed pieces by (dx, dy), leaving others untouched', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const idA = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 20, y: 20 }, corner2: { x: 30, y: 30 } })
      const idB = state.document.pieces[1].id
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 50, y: 50 }, corner2: { x: 60, y: 60 } })
      const idUntouched = state.document.pieces[2].id

      state = patternReducer(state, { type: 'TRANSLATE_PIECES', pieceIds: [idA, idB], dx: 5, dy: -2 })

      const byId = (id) => state.document.pieces.find((p) => p.id === id)
      expect(byId(idA).vertices.map((v) => v.point)).toEqual([
        { x: 5, y: -2 },
        { x: 15, y: -2 },
        { x: 15, y: 8 },
        { x: 5, y: 8 },
      ])
      expect(byId(idB).vertices[0].point).toEqual({ x: 25, y: 18 })
      expect(byId(idUntouched).vertices[0].point).toEqual({ x: 50, y: 50 })
    })

    it('is a no-op for a zero delta (no history entry pushed)', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const id = state.document.pieces[0].id
      const before = state
      state = patternReducer(state, { type: 'TRANSLATE_PIECES', pieceIds: [id], dx: 0, dy: 0 })
      expect(state).toBe(before)
    })

    it('clears dock on moved vertices (a rigid move overrides any prior constraint)', () => {
      let state = initState()
      state = patternReducer(state, { type: 'ADD_RECT_PIECE', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } })
      const hostId = state.document.pieces[0].id
      state = patternReducer(state, { type: 'ADD_LINE_PIECE', start: { x: 20, y: 20 }, end: { x: 25, y: 25 } })
      const lineId = state.document.pieces[1].id
      const vertexId = state.document.pieces[1].vertices[0].id
      state = patternReducer(state, {
        type: 'MOVE_VERTEX',
        pieceId: lineId,
        vertexId,
        point: { x: 5, y: 0 },
        dock: { kind: 'edge', targetPieceId: hostId, edgeIndex: 0, t: 0.5 },
      })

      state = patternReducer(state, { type: 'TRANSLATE_PIECES', pieceIds: [lineId], dx: 1, dy: 1 })
      const v = state.document.pieces.find((p) => p.id === lineId).vertices[0]
      expect(v.dock).toBeNull()
      expect(v.point).toEqual({ x: 6, y: 1 })
    })
  })

  describe('LOAD', () => {
    it('normalizes a document missing newer fields (e.g. a pattern saved before internalLines existed)', () => {
      const legacyDocument = { pieces: [], stitchPatternDefs: [], stitchLines: [], offsetPaths: [] }
      const state = patternReducer(undefined, { type: 'LOAD', document: legacyDocument })
      expect(state.document.internalLines).toEqual([])
    })
  })
})
