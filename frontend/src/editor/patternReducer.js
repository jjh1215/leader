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
      return { ...commit(state, nextDoc), activePieceId: id, toolMode: 'draw-line', selection: null }
    }

    case 'ADD_VERTEX': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id === action.pieceId
          ? { ...p, vertices: [...p.vertices, { id: generateId(), point: action.point, cornerRadius: 0 }] }
          : p
      )
      return commit(state, { ...state.document, pieces: nextPieces })
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
      return { ...state, selection: { pieceId: action.pieceId, vertexId: action.vertexId } }

    case 'CLEAR_SELECTION':
      return { ...state, selection: null }

    case 'MOVE_VERTEX': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id !== action.pieceId
          ? p
          : { ...p, vertices: p.vertices.map((v) => (v.id === action.vertexId ? { ...v, point: action.point } : v)) }
      )
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
