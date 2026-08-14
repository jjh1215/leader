// Document reducer with snapshot-based undo/redo. Only discrete, "committed"
// changes (pointerup, not every pointermove) push a snapshot onto history --
// in-progress drag previews live in local component state instead.
import { useReducer } from 'react'
import { generateId } from './geometry/id.js'

const HISTORY_LIMIT = 100

export const emptyDocument = () => ({
  pieces: [],
  stitchPatternDefs: [],
  stitchLines: [],
  offsetPaths: [],
})

function cloneDoc(doc) {
  return JSON.parse(JSON.stringify(doc))
}

function initState(document) {
  return {
    document,
    past: [],
    future: [],
    toolMode: 'select',
    activePieceId: null,
    selection: null, // { pieceId, vertexId }
    selectedPieceIds: [], // whole-piece selection, for merge etc. -- separate from vertex `selection`
  }
}

function commit(state, nextDocument) {
  const past = [...state.past, cloneDoc(state.document)].slice(-HISTORY_LIMIT)
  return { ...state, document: nextDocument, past, future: [] }
}

export function patternReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return initState(action.document)

    case 'SET_TOOL_MODE':
      return { ...state, toolMode: action.mode }

    case 'START_NEW_PIECE': {
      const id = generateId()
      const piece = {
        id,
        name: `조각 ${state.document.pieces.length + 1}`,
        closed: false,
        vertices: [],
      }
      const nextDoc = { ...state.document, pieces: [...state.document.pieces, piece] }
      return {
        ...commit(state, nextDoc),
        activePieceId: id,
        toolMode: 'draw-line',
        selection: null,
        selectedPieceIds: [],
      }
    }

    case 'ADD_VERTEX': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id === action.pieceId
          ? { ...p, vertices: [...p.vertices, { id: generateId(), point: action.point, cornerRadius: 0 }] }
          : p
      )
      return commit(state, { ...state.document, pieces: nextPieces })
    }

    case 'ADD_RECT_PIECE': {
      const { corner1, corner2 } = action
      const minX = Math.min(corner1.x, corner2.x)
      const maxX = Math.max(corner1.x, corner2.x)
      const minY = Math.min(corner1.y, corner2.y)
      const maxY = Math.max(corner1.y, corner2.y)
      const piece = {
        id: generateId(),
        name: `조각 ${state.document.pieces.length + 1}`,
        closed: true,
        vertices: [
          { id: generateId(), point: { x: minX, y: minY }, cornerRadius: 0 },
          { id: generateId(), point: { x: maxX, y: minY }, cornerRadius: 0 },
          { id: generateId(), point: { x: maxX, y: maxY }, cornerRadius: 0 },
          { id: generateId(), point: { x: minX, y: maxY }, cornerRadius: 0 },
        ],
      }
      const nextDoc = { ...state.document, pieces: [...state.document.pieces, piece] }
      return {
        ...commit(state, nextDoc),
        activePieceId: null,
        toolMode: 'select',
        selection: null,
        selectedPieceIds: [piece.id],
      }
    }

    case 'ADD_LINE_PIECE': {
      const { start, end } = action
      const piece = {
        id: generateId(),
        name: `조각 ${state.document.pieces.length + 1}`,
        closed: false,
        vertices: [
          { id: generateId(), point: start, cornerRadius: 0 },
          { id: generateId(), point: end, cornerRadius: 0 },
        ],
      }
      const nextDoc = { ...state.document, pieces: [...state.document.pieces, piece] }
      return {
        ...commit(state, nextDoc),
        activePieceId: null,
        toolMode: 'select',
        selection: null,
        selectedPieceIds: [piece.id],
      }
    }

    case 'CLOSE_ACTIVE_PIECE': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id === state.activePieceId ? { ...p, closed: true } : p
      )
      return {
        ...commit(state, { ...state.document, pieces: nextPieces }),
        activePieceId: null,
        toolMode: 'select',
      }
    }

    case 'END_OPEN_PATH':
      return { ...state, activePieceId: null, toolMode: 'select' }

    case 'SELECT_VERTEX':
      return { ...state, selection: { pieceId: action.pieceId, vertexId: action.vertexId }, selectedPieceIds: [] }

    case 'CLEAR_SELECTION':
      return { ...state, selection: null }

    case 'SELECT_PIECE': {
      const { pieceId, additive } = action
      if (!additive) {
        return { ...state, selection: null, selectedPieceIds: [pieceId] }
      }
      const already = state.selectedPieceIds.includes(pieceId)
      const selectedPieceIds = already
        ? state.selectedPieceIds.filter((id) => id !== pieceId)
        : [...state.selectedPieceIds, pieceId]
      return { ...state, selection: null, selectedPieceIds }
    }

    case 'CLEAR_PIECE_SELECTION':
      return { ...state, selectedPieceIds: [] }

    case 'MERGE_PIECES': {
      const { pieceIdA, pieceIdB } = action
      const a = state.document.pieces.find((p) => p.id === pieceIdA)
      const b = state.document.pieces.find((p) => p.id === pieceIdB)
      if (!a || !b || a.closed || b.closed || a.vertices.length < 2 || b.vertices.length < 2) {
        return state
      }

      const dist = (p, q) => Math.hypot(p.point.x - q.point.x, p.point.y - q.point.y)
      const aFirst = a.vertices[0]
      const aLast = a.vertices[a.vertices.length - 1]
      const bFirst = b.vertices[0]
      const bLast = b.vertices[b.vertices.length - 1]

      // Try all 4 end-to-end pairings and connect via whichever pair of
      // endpoints is closest (the "overlapping" ends the user clicked together).
      const candidates = [
        { d: dist(aLast, bFirst), reverseA: false, reverseB: false },
        { d: dist(aLast, bLast), reverseA: false, reverseB: true },
        { d: dist(aFirst, bFirst), reverseA: true, reverseB: false },
        { d: dist(aFirst, bLast), reverseA: true, reverseB: true },
      ]
      const best = candidates.reduce((min, c) => (c.d < min.d ? c : min))

      const aVerts = best.reverseA ? [...a.vertices].reverse() : a.vertices
      const bVerts = best.reverseB ? [...b.vertices].reverse() : b.vertices
      // aVerts' last point and bVerts' first point are the joined pair --
      // keep a's as the single joint vertex, drop b's duplicate.
      const mergedPiece = {
        id: generateId(),
        name: a.name,
        closed: false,
        vertices: [...aVerts, ...bVerts.slice(1)],
      }

      const nextDoc = {
        ...state.document,
        pieces: [
          ...state.document.pieces.filter((p) => p.id !== pieceIdA && p.id !== pieceIdB),
          mergedPiece,
        ],
        stitchLines: state.document.stitchLines.filter(
          (s) => s.sourcePieceId !== pieceIdA && s.sourcePieceId !== pieceIdB
        ),
        offsetPaths: state.document.offsetPaths.filter(
          (o) => o.sourcePieceId !== pieceIdA && o.sourcePieceId !== pieceIdB
        ),
      }

      return {
        ...commit(state, nextDoc),
        selectedPieceIds: [mergedPiece.id],
        activePieceId: null,
        selection: null,
      }
    }

    case 'MOVE_VERTEX': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id !== action.pieceId
          ? p
          : { ...p, vertices: p.vertices.map((v) => (v.id === action.vertexId ? { ...v, point: action.point } : v)) }
      )
      return commit(state, { ...state.document, pieces: nextPieces })
    }

    // Repositions a 2-vertex open piece's second point from its first, by
    // exact length + angle -- the numeric alternative to dragging a line tool.
    case 'SET_LINE_DIMENSIONS': {
      const { pieceId, length, angleDeg } = action
      const rad = (angleDeg * Math.PI) / 180
      const nextPieces = state.document.pieces.map((p) => {
        if (p.id !== pieceId || p.vertices.length !== 2) return p
        const start = p.vertices[0].point
        const end = { x: start.x + length * Math.cos(rad), y: start.y + length * Math.sin(rad) }
        return { ...p, vertices: [p.vertices[0], { ...p.vertices[1], point: end }] }
      })
      return commit(state, { ...state.document, pieces: nextPieces })
    }

    // Rescales a closed 4-vertex axis-aligned rectangle to an exact
    // width/height, anchored at its current min-x/min-y corner. Remaps each
    // vertex by which corner it currently occupies (left/right, top/bottom)
    // rather than by array index, so a rectangle whose vertices are no longer
    // in the original perimeter order (e.g. after manual dragging) doesn't
    // get its edges scrambled into a self-crossing shape.
    case 'SET_RECT_DIMENSIONS': {
      const { pieceId, minX, minY, width, height } = action
      const nextPieces = state.document.pieces.map((p) => {
        if (p.id !== pieceId || p.vertices.length !== 4) return p
        const xs = p.vertices.map((v) => v.point.x)
        const ys = p.vertices.map((v) => v.point.y)
        const oldMinX = Math.min(...xs)
        const oldMinY = Math.min(...ys)
        return {
          ...p,
          vertices: p.vertices.map((v) => ({
            ...v,
            point: {
              x: v.point.x === oldMinX ? minX : minX + width,
              y: v.point.y === oldMinY ? minY : minY + height,
            },
          })),
        }
      })
      return commit(state, { ...state.document, pieces: nextPieces })
    }

    case 'SET_VERTEX_RADIUS': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id !== action.pieceId
          ? p
          : {
              ...p,
              vertices: p.vertices.map((v) =>
                v.id === action.vertexId ? { ...v, cornerRadius: action.radius } : v
              ),
            }
      )
      return commit(state, { ...state.document, pieces: nextPieces })
    }

    case 'DELETE_VERTEX': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id !== action.pieceId ? p : { ...p, vertices: p.vertices.filter((v) => v.id !== action.vertexId) }
      )
      const nextState = commit(state, { ...state.document, pieces: nextPieces })
      return state.selection?.vertexId === action.vertexId ? { ...nextState, selection: null } : nextState
    }

    case 'DELETE_PIECE': {
      const nextDoc = {
        ...state.document,
        pieces: state.document.pieces.filter((p) => p.id !== action.pieceId),
        stitchLines: state.document.stitchLines.filter((s) => s.sourcePieceId !== action.pieceId),
        offsetPaths: state.document.offsetPaths.filter((o) => o.sourcePieceId !== action.pieceId),
      }
      const nextState = commit(state, nextDoc)
      const wasActive = state.activePieceId === action.pieceId
      const hadSelection = state.selection?.pieceId === action.pieceId
      return {
        ...nextState,
        activePieceId: wasActive ? null : nextState.activePieceId,
        toolMode: wasActive ? 'select' : nextState.toolMode,
        selection: hadSelection ? null : nextState.selection,
        selectedPieceIds: nextState.selectedPieceIds.filter((id) => id !== action.pieceId),
      }
    }

    case 'RENAME_PIECE': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id === action.pieceId ? { ...p, name: action.name } : p
      )
      return commit(state, { ...state.document, pieces: nextPieces })
    }

    case 'ADD_STITCH_PATTERN_DEF':
      return commit(state, {
        ...state.document,
        stitchPatternDefs: [...state.document.stitchPatternDefs, action.def],
      })

    case 'UPDATE_STITCH_PATTERN_DEF':
      return commit(state, {
        ...state.document,
        stitchPatternDefs: state.document.stitchPatternDefs.map((d) =>
          d.id === action.def.id ? action.def : d
        ),
      })

    case 'DELETE_STITCH_PATTERN_DEF':
      return commit(state, {
        ...state.document,
        stitchPatternDefs: state.document.stitchPatternDefs.filter((d) => d.id !== action.id),
        stitchLines: state.document.stitchLines.filter((s) => s.stitchPatternDefId !== action.id),
      })

    case 'ADD_STITCH_LINE':
      return commit(state, { ...state.document, stitchLines: [...state.document.stitchLines, action.stitchLine] })

    case 'UPDATE_STITCH_LINE':
      return commit(state, {
        ...state.document,
        stitchLines: state.document.stitchLines.map((s) => (s.id === action.stitchLine.id ? action.stitchLine : s)),
      })

    case 'DELETE_STITCH_LINE':
      return commit(state, {
        ...state.document,
        stitchLines: state.document.stitchLines.filter((s) => s.id !== action.id),
      })

    case 'ADD_OFFSET_PATH':
      return commit(state, { ...state.document, offsetPaths: [...state.document.offsetPaths, action.offsetPath] })

    case 'UPDATE_OFFSET_PATH':
      return commit(state, {
        ...state.document,
        offsetPaths: state.document.offsetPaths.map((o) => (o.id === action.offsetPath.id ? action.offsetPath : o)),
      })

    case 'DELETE_OFFSET_PATH':
      return commit(state, {
        ...state.document,
        offsetPaths: state.document.offsetPaths.filter((o) => o.id !== action.id),
      })

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const past = state.past.slice(0, -1)
      const future = [cloneDoc(state.document), ...state.future]
      return { ...state, document: previous, past, future }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const future = state.future.slice(1)
      const past = [...state.past, cloneDoc(state.document)]
      return { ...state, document: next, past, future }
    }

    default:
      return state
  }
}

export function usePatternReducer(initialDocument) {
  return useReducer(patternReducer, initialDocument, initState)
}
