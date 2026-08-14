// Document reducer with snapshot-based undo/redo. Only discrete, "committed"
// changes (pointerup, not every pointermove) push a snapshot onto history --
// in-progress drag previews live in local component state instead.
import { useReducer } from 'react'
import { generateId } from './geometry/id.js'
import { flattenToPolygon } from './geometry/fillet.js'
import { resolveDockPoint } from './geometry/edgeDock.js'
import { insertLineIntersectionPoints, splitClosedPolygonByLine } from './geometry/splitPolygon.js'
import { unionPolygons } from './geometry/polygonUnion.js'
import { stitchMergeAtSharedVertices } from './geometry/stitchMerge.js'

const HISTORY_LIMIT = 100
const DOCK_RESOLVE_PASSES = 5 // lets short dock chains (A on B, B on C) settle

export const emptyDocument = () => ({
  pieces: [],
  stitchPatternDefs: [],
  stitchLines: [],
  offsetPaths: [],
  internalLines: [], // fold/score guide lines marked across a single piece (see ADD_INTERNAL_LINE)
})

function cloneDoc(doc) {
  return JSON.parse(JSON.stringify(doc))
}

// Fills in any document-level arrays missing from `document` (e.g. a pattern
// saved before `internalLines` -- or any future field -- existed) with
// emptyDocument()'s defaults, so loading an older saved pattern doesn't
// crash on a missing array instead of just treating it as "none yet."
function normalizeDocument(document) {
  return { ...emptyDocument(), ...document }
}

function initState(document) {
  return {
    document: normalizeDocument(document),
    past: [],
    future: [],
    toolMode: 'select',
    activePieceId: null,
    selection: null, // { pieceId, vertexId }
    selectedPieceIds: [], // whole-piece selection, for merge/split/internal-line etc.
  }
}

// Recomputes every docked vertex's live position from its target. Runs as
// the last step of every commit so no individual action needs its own
// "also update anything docked to what I just changed" logic -- editing a
// rectangle's dimensions, moving a vertex, anything at all, and dock
// resolution happens uniformly afterward from the resulting document alone.
function resolveDocks(document) {
  let pieces = document.pieces
  for (let pass = 0; pass < DOCK_RESOLVE_PASSES; pass++) {
    let changed = false
    const snapshot = pieces
    pieces = pieces.map((piece) => ({
      ...piece,
      vertices: piece.vertices.map((v) => {
        if (!v.dock) return v
        const resolved = resolveDockPoint(v.dock, snapshot)
        if (!resolved) {
          changed = true
          return { ...v, dock: null } // target gone/invalid: constraint breaks, keep last point
        }
        if (resolved.x === v.point.x && resolved.y === v.point.y) return v
        changed = true
        return { ...v, point: resolved }
      }),
    }))
    if (!changed) break
  }
  return pieces === document.pieces ? document : { ...document, pieces }
}

function commit(state, nextDocument) {
  const resolved = resolveDocks(nextDocument)
  const past = [...state.past, cloneDoc(state.document)].slice(-HISTORY_LIMIT)
  return { ...state, document: resolved, past, future: [] }
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
          ? {
              ...p,
              vertices: [
                ...p.vertices,
                { id: generateId(), point: action.point, cornerRadius: 0, dock: action.dock ?? null },
              ],
            }
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
      const { start, end, startDock, endDock } = action
      const piece = {
        id: generateId(),
        name: `조각 ${state.document.pieces.length + 1}`,
        closed: false,
        vertices: [
          { id: generateId(), point: start, cornerRadius: 0, dock: startDock ?? null },
          { id: generateId(), point: end, cornerRadius: 0, dock: endDock ?? null },
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
      return {
        ...state,
        selection: { pieceId: action.pieceId, vertexId: action.vertexId },
        selectedPieceIds: [],
      }

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

    // Marquee/drag-select result: a set of piece ids all at once. Unlike
    // SELECT_PIECE (single click), this always adds/replaces -- it doesn't
    // toggle pieces back off, matching standard rubber-band-select behavior.
    case 'SELECT_PIECES': {
      const { pieceIds, additive } = action
      const selectedPieceIds = additive
        ? Array.from(new Set([...state.selectedPieceIds, ...pieceIds]))
        : pieceIds
      return { ...state, selection: null, selectedPieceIds }
    }

    case 'CLEAR_PIECE_SELECTION':
      return { ...state, selectedPieceIds: [] }

    // The "mark, don't cut" counterpart to SPLIT_PIECE: same selection (a
    // closed piece + a crossing open 2-point line) and the same underlying
    // line-vs-boundary math, but instead of dividing the piece into two, it
    // inserts the 2 crossing points as real vertices into the piece's own
    // boundary (so a rectangle behaves like a hexagon afterward -- both new
    // points are individually draggable, and dragging them reshapes the
    // outer boundary like any other vertex) and records the line between
    // them as an `internalLine` entry, rendered as a fold/score guide across
    // the piece's interior. The piece stays one piece; only the line piece
    // is consumed.
    case 'ADD_INTERNAL_LINE': {
      const { closedPieceId, linePieceId } = action
      const closedPiece = state.document.pieces.find((p) => p.id === closedPieceId)
      const linePiece = state.document.pieces.find((p) => p.id === linePieceId)
      if (
        !closedPiece ||
        !linePiece ||
        !closedPiece.closed ||
        linePiece.closed ||
        linePiece.vertices.length !== 2
      ) {
        return state
      }

      const polygon = flattenToPolygon(closedPiece.vertices, true)
      const result = insertLineIntersectionPoints(polygon, linePiece.vertices[0].point, linePiece.vertices[1].point)
      if (!result) return state

      // Match each non-inserted boundary point back to its original vertex
      // (exact position match -- reliable for the common no-fillet case,
      // where flattening is a 1:1 passthrough) to preserve id/cornerRadius/
      // dock; only the 2 newly inserted points get fresh vertex objects.
      const findOriginal = (point) =>
        closedPiece.vertices.find((v) => v.point.x === point.x && v.point.y === point.y)

      const newVertexIds = []
      const nextVertices = result.boundary.map(({ point, inserted }) => {
        if (!inserted) {
          const original = findOriginal(point)
          if (original) return original
        }
        const id = generateId()
        newVertexIds.push(id)
        return { id, point, cornerRadius: 0, dock: null }
      })

      const updatedPiece = { ...closedPiece, vertices: nextVertices }
      const internalLine = {
        id: generateId(),
        name: `내부선`,
        sourcePieceId: closedPieceId,
        vertexIdA: newVertexIds[0],
        vertexIdB: newVertexIds[1],
      }

      const nextDoc = {
        ...state.document,
        pieces: state.document.pieces
          .filter((p) => p.id !== linePieceId)
          .map((p) => (p.id === closedPieceId ? updatedPiece : p)),
        internalLines: [...state.document.internalLines, internalLine],
        stitchLines: state.document.stitchLines.filter((s) => s.sourcePieceId !== linePieceId),
        offsetPaths: state.document.offsetPaths.filter((o) => o.sourcePieceId !== linePieceId),
      }

      return {
        ...commit(state, nextDoc),
        selectedPieceIds: [closedPieceId],
        activePieceId: null,
        selection: null,
      }
    }

    // Two closed shapes merge either by stitching their original vertices
    // back together (the CAD-like, identity-preserving path -- used when
    // they share exactly 2 vertices, the standard case right after
    // SPLIT_PIECE) or, failing that, by polygon union (clipper-lib, same
    // engine as offset.js) for two closed pieces that just happen to
    // touch/overlap without ever having been split from one another.
    case 'MERGE_PIECES': {
      const { pieceIdA, pieceIdB } = action
      const a = state.document.pieces.find((p) => p.id === pieceIdA)
      const b = state.document.pieces.find((p) => p.id === pieceIdB)
      if (!a || !b) return state

      if (a.closed && b.closed) {
        const stitched = stitchMergeAtSharedVertices(a.vertices, b.vertices)
        const newPieces = stitched
          ? [
              {
                id: generateId(),
                name: a.name,
                closed: true,
                vertices: stitched.map((v) => ({ ...v, id: generateId() })),
              },
            ]
          : (() => {
              const polyA = flattenToPolygon(a.vertices, true)
              const polyB = flattenToPolygon(b.vertices, true)
              const unioned = unionPolygons(polyA, polyB)
              return unioned.map((loop, i) => ({
                id: generateId(),
                name: unioned.length > 1 ? `${a.name} ${i + 1}` : a.name,
                closed: true,
                vertices: loop.map((p) => ({ id: generateId(), point: p, cornerRadius: 0, dock: null })),
              }))
            })()

        const nextDoc = {
          ...state.document,
          pieces: [
            ...state.document.pieces.filter((p) => p.id !== pieceIdA && p.id !== pieceIdB),
            ...newPieces,
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
          selectedPieceIds: newPieces.map((p) => p.id),
          activePieceId: null,
          selection: null,
        }
      }

      if (a.closed || b.closed || a.vertices.length < 2 || b.vertices.length < 2) {
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

    // Cuts a closed piece into two closed pieces along an open 2-point line
    // piece, replacing both inputs. Only handles the line crossing the
    // boundary exactly twice (see splitPolygon.js) -- anything else is a
    // no-op, left for the UI to report as "can't split that."
    case 'SPLIT_PIECE': {
      const { closedPieceId, linePieceId } = action
      const closedPiece = state.document.pieces.find((p) => p.id === closedPieceId)
      const linePiece = state.document.pieces.find((p) => p.id === linePieceId)
      if (
        !closedPiece ||
        !linePiece ||
        !closedPiece.closed ||
        linePiece.closed ||
        linePiece.vertices.length !== 2
      ) {
        return state
      }

      const polygon = flattenToPolygon(closedPiece.vertices, true)
      const loops = splitClosedPolygonByLine(polygon, linePiece.vertices[0].point, linePiece.vertices[1].point)
      if (!loops) return state

      const toPiece = (points, suffix) => ({
        id: generateId(),
        name: `${closedPiece.name} ${suffix}`,
        closed: true,
        vertices: points.map((p) => ({ id: generateId(), point: p, cornerRadius: 0, dock: null })),
      })
      const pieceA = toPiece(loops[0], 'A')
      const pieceB = toPiece(loops[1], 'B')

      const nextDoc = {
        ...state.document,
        pieces: [
          ...state.document.pieces.filter((p) => p.id !== closedPieceId && p.id !== linePieceId),
          pieceA,
          pieceB,
        ],
        stitchLines: state.document.stitchLines.filter(
          (s) => s.sourcePieceId !== closedPieceId && s.sourcePieceId !== linePieceId
        ),
        offsetPaths: state.document.offsetPaths.filter(
          (o) => o.sourcePieceId !== closedPieceId && o.sourcePieceId !== linePieceId
        ),
      }

      return {
        ...commit(state, nextDoc),
        selectedPieceIds: [pieceA.id, pieceB.id],
        activePieceId: null,
        selection: null,
      }
    }

    // Always sets `dock` to whatever the action specifies (defaulting to
    // null/free) rather than preserving whatever the vertex had before --
    // otherwise a plain move on a previously-docked vertex would appear to
    // silently snap back next render, since resolveDocks runs on every
    // commit and would immediately recompute the old dock's position.
    case 'MOVE_VERTEX': {
      const nextPieces = state.document.pieces.map((p) =>
        p.id !== action.pieceId
          ? p
          : {
              ...p,
              vertices: p.vertices.map((v) =>
                v.id === action.vertexId ? { ...v, point: action.point, dock: action.dock ?? null } : v
              ),
            }
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
        // An explicit numeric edit overrides any prior dock on the point it moves.
        return { ...p, vertices: [p.vertices[0], { ...p.vertices[1], point: end, dock: null }] }
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
            dock: null, // explicit numeric edit overrides any prior dock
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
      const nextDoc = {
        ...state.document,
        pieces: nextPieces,
        // An internal line's endpoint no longer exists -- the line goes with it.
        internalLines: state.document.internalLines.filter(
          (l) => l.vertexIdA !== action.vertexId && l.vertexIdB !== action.vertexId
        ),
      }
      const nextState = commit(state, nextDoc)
      return state.selection?.vertexId === action.vertexId ? { ...nextState, selection: null } : nextState
    }

    case 'DELETE_PIECE': {
      const nextDoc = {
        ...state.document,
        pieces: state.document.pieces.filter((p) => p.id !== action.pieceId),
        stitchLines: state.document.stitchLines.filter((s) => s.sourcePieceId !== action.pieceId),
        offsetPaths: state.document.offsetPaths.filter((o) => o.sourcePieceId !== action.pieceId),
        internalLines: state.document.internalLines.filter((l) => l.sourcePieceId !== action.pieceId),
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

    // Bulk variant of DELETE_PIECE -- used for Delete-key removal of a
    // whole-piece selection (which may hold up to 2 pieces at once). Kept as
    // one commit so undo restores every deleted piece in a single step.
    case 'DELETE_PIECES': {
      const { pieceIds } = action
      const nextDoc = {
        ...state.document,
        pieces: state.document.pieces.filter((p) => !pieceIds.includes(p.id)),
        stitchLines: state.document.stitchLines.filter((s) => !pieceIds.includes(s.sourcePieceId)),
        offsetPaths: state.document.offsetPaths.filter((o) => !pieceIds.includes(o.sourcePieceId)),
        internalLines: state.document.internalLines.filter((l) => !pieceIds.includes(l.sourcePieceId)),
      }
      const nextState = commit(state, nextDoc)
      const wasActive = pieceIds.includes(state.activePieceId)
      const hadSelection = state.selection && pieceIds.includes(state.selection.pieceId)
      return {
        ...nextState,
        activePieceId: wasActive ? null : nextState.activePieceId,
        toolMode: wasActive ? 'select' : nextState.toolMode,
        selection: hadSelection ? null : nextState.selection,
        selectedPieceIds: nextState.selectedPieceIds.filter((id) => !pieceIds.includes(id)),
      }
    }

    // Rigid-body translate of one or more whole pieces by (dx, dy) -- used
    // for both drag-to-move (the interior-drag gesture) and typed X/Y
    // position edits. A no-op for a zero delta so a plain click (no actual
    // drag) doesn't push a pointless history entry. Clears `dock` on every
    // moved vertex: a bulk rigid-body move isn't the same gesture as
    // "slide this point along its dock target," so treating it as an
    // explicit edit (same precedent as SET_RECT_DIMENSIONS/SET_LINE_DIMENSIONS)
    // avoids a docked point fighting the drag by snapping back next commit.
    case 'TRANSLATE_PIECES': {
      const { pieceIds, dx, dy } = action
      if (dx === 0 && dy === 0) return state
      const nextPieces = state.document.pieces.map((p) =>
        !pieceIds.includes(p.id)
          ? p
          : {
              ...p,
              vertices: p.vertices.map((v) => ({
                ...v,
                point: { x: v.point.x + dx, y: v.point.y + dy },
                dock: null,
              })),
            }
      )
      return commit(state, { ...state.document, pieces: nextPieces })
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
