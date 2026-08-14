import { useRef, useState } from 'react'
import { flattenToPolygon, verticesToPathD } from './geometry/fillet.js'
import { distanceToPolyline, pointInPolygon } from './geometry/hitTest.js'
import { projectPointToPolyline } from './geometry/edgeDock.js'
import { offsetPolygon } from './geometry/offset.js'
import { pointsToPathD } from './geometry/path.js'
import { pxToMm, screenToDocPoint } from './geometry/screenToDoc.js'
import { projectPointOntoLine, snapOrthogonal } from './geometry/snap.js'
import { insetSegment, placeStitchHoles } from './geometry/stitch.js'

const HIT_RADIUS_PX = 8
const MIN_SHAPE_DRAG_MM = 0.5 // ignore accidental clicks-without-drag for rect/line tools
const DEFAULT_VIEWBOX = { x: -20, y: -20, width: 240, height: 240 }

function Grid({ viewBox }) {
  const lines = []
  const step = 10 // mm
  const startX = Math.floor(viewBox.x / step) * step
  const endX = viewBox.x + viewBox.width
  const startY = Math.floor(viewBox.y / step) * step
  const endY = viewBox.y + viewBox.height

  for (let x = startX; x <= endX; x += step) {
    const major = Math.round(x / step) % 5 === 0
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={viewBox.y}
        x2={x}
        y2={viewBox.y + viewBox.height}
        stroke={major ? '#ccc' : '#e8e8e8'}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  for (let y = startY; y <= endY; y += step) {
    const major = Math.round(y / step) % 5 === 0
    lines.push(
      <line
        key={`h${y}`}
        x1={viewBox.x}
        y1={y}
        x2={viewBox.x + viewBox.width}
        y2={y}
        stroke={major ? '#ccc' : '#e8e8e8'}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  return <g>{lines}</g>
}

function PatternCanvas({ state, dispatch, actualSize = false, pxPerMm = 96 / 25.4 }) {
  const svgRef = useRef(null)
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX)
  const [dragVertex, setDragVertex] = useState(null) // transient preview: { pieceId, vertexId, point }
  const [panStart, setPanStart] = useState(null)
  const [shapeDrag, setShapeDrag] = useState(null) // transient rect/line preview: { start, end }
  const [hoverPoint, setHoverPoint] = useState(null) // rubber-band preview for the draw-line pen tool
  const [hoverDock, setHoverDock] = useState(null) // dock the hoverPoint is currently snapped to, if any
  const [marquee, setMarquee] = useState(null) // transient drag-select box: { start, end, additive }
  const [pieceDrag, setPieceDrag] = useState(null) // whole-piece move: { pieceIds, start, current }

  const { document, toolMode, activePieceId, selection, selectedPieceIds } = state

  function toDoc(e) {
    return screenToDocPoint(svgRef.current, viewBox, e.clientX, e.clientY)
  }

  function hitRadiusMm() {
    return pxToMm(svgRef.current, viewBox, HIT_RADIUS_PX)
  }

  function findNearestVertex(point) {
    const threshold = hitRadiusMm()
    let best = null
    let bestDist = threshold
    for (const piece of document.pieces) {
      for (const v of piece.vertices) {
        const d = Math.hypot(v.point.x - point.x, v.point.y - point.y)
        if (d < bestDist) {
          bestDist = d
          best = { pieceId: piece.id, vertexId: v.id }
        }
      }
    }
    return best
  }

  // "Docking": snaps a point being placed or dragged onto nearby geometry,
  // and reports *what* it snapped to as a `dock` reference so the reducer
  // can turn it into a live constraint (see patternReducer.js resolveDocks).
  // Vertex-to-vertex takes priority over point-to-edge (a vertex is a more
  // precise target than a projection onto its edge). `excludePieceId` /
  // `excludeVertexId` keep an existing vertex from docking to itself while
  // it's being dragged.
  function computeSnap(point, { excludePieceId, excludeVertexId } = {}) {
    const threshold = hitRadiusMm()

    let bestVertex = null
    let bestVertexDist = threshold
    for (const piece of document.pieces) {
      for (const v of piece.vertices) {
        if (v.id === excludeVertexId) continue
        const d = Math.hypot(v.point.x - point.x, v.point.y - point.y)
        if (d < bestVertexDist) {
          bestVertexDist = d
          bestVertex = { pieceId: piece.id, vertexId: v.id, point: v.point }
        }
      }
    }
    if (bestVertex) {
      return {
        point: bestVertex.point,
        dock: { kind: 'vertex', targetPieceId: bestVertex.pieceId, targetVertexId: bestVertex.vertexId },
      }
    }

    let bestEdge = null
    for (const piece of document.pieces) {
      if (piece.id === excludePieceId || piece.vertices.length < 2) continue
      const poly = flattenToPolygon(piece.vertices, piece.closed)
      const proj = projectPointToPolyline(point, poly, piece.closed)
      if (proj && proj.distance < threshold && (!bestEdge || proj.distance < bestEdge.distance)) {
        bestEdge = { ...proj, pieceId: piece.id }
      }
    }
    if (bestEdge) {
      return {
        point: bestEdge.point,
        dock: { kind: 'edge', targetPieceId: bestEdge.pieceId, edgeIndex: bestEdge.edgeIndex, t: bestEdge.t },
      }
    }

    return { point, dock: null }
  }

  // Hits a piece either by proximity to its edge (any piece) or by landing
  // inside its filled interior (closed pieces only) -- the latter is what
  // lets clicking/dragging anywhere inside a shape select or move it, not
  // just its outline.
  function findNearestPiece(point) {
    const threshold = hitRadiusMm()
    let best = null
    let bestDist = threshold
    for (const piece of document.pieces) {
      if (piece.vertices.length < 2) continue
      const poly = flattenToPolygon(piece.vertices, piece.closed)
      if (piece.closed && pointInPolygon(point, poly)) return piece.id
      const d = distanceToPolyline(point, poly, piece.closed)
      if (d < bestDist) {
        bestDist = d
        best = piece.id
      }
    }
    return best
  }

  // Marquee/drag-select: any piece with at least one vertex inside the box
  // (the common "touch" rubber-band behavior, not strict full-enclosure).
  function piecesTouchingRect(minX, minY, maxX, maxY) {
    return document.pieces
      .filter((piece) =>
        piece.vertices.some((v) => v.point.x >= minX && v.point.x <= maxX && v.point.y >= minY && v.point.y <= maxY)
      )
      .map((p) => p.id)
  }

  function handlePointerDown(e) {
    let point = toDoc(e)

    if (toolMode === 'draw-line' && activePieceId) {
      const piece = document.pieces.find((p) => p.id === activePieceId)
      const lastVertex = piece?.vertices[piece.vertices.length - 1]
      if (lastVertex && e.shiftKey) {
        point = snapOrthogonal(lastVertex.point, point)
      }
      if (piece && piece.vertices.length >= 3) {
        const first = piece.vertices[0]
        const d = Math.hypot(first.point.x - point.x, first.point.y - point.y)
        if (d < hitRadiusMm()) {
          dispatch({ type: 'CLOSE_ACTIVE_PIECE' })
          setHoverPoint(null)
          setHoverDock(null)
          return
        }
      }
      const snap = computeSnap(point)
      dispatch({ type: 'ADD_VERTEX', pieceId: activePieceId, point: snap.point, dock: snap.dock })
      return
    }

    if (toolMode === 'rect' || toolMode === 'line') {
      const snap = computeSnap(point)
      setShapeDrag({ start: snap.point, end: snap.point, startDock: snap.dock, endDock: snap.dock })
      return
    }

    if (toolMode === 'select') {
      const hit = findNearestVertex(point)
      if (hit) {
        dispatch({ type: 'SELECT_VERTEX', pieceId: hit.pieceId, vertexId: hit.vertexId })
        const piece = document.pieces.find((p) => p.id === hit.pieceId)
        const v = piece.vertices.find((vv) => vv.id === hit.vertexId)
        setDragVertex({ ...hit, point: v.point, dock: v.dock ?? null })
        return
      }
      const pieceId = findNearestPiece(point)
      if (pieceId) {
        if (e.shiftKey) {
          // Shift+click only builds/toggles the selection -- it doesn't also
          // start a move, so it stays usable purely for multi-selecting.
          dispatch({ type: 'SELECT_PIECE', pieceId, additive: true })
          return
        }
        // Dragging a piece that's already part of the current selection
        // moves the whole selected group together; dragging an unselected
        // one selects just it first, matching standard design-tool behavior.
        const alreadySelected = selectedPieceIds.includes(pieceId)
        if (!alreadySelected) {
          dispatch({ type: 'SELECT_PIECE', pieceId, additive: false })
        }
        setPieceDrag({ pieceIds: alreadySelected ? selectedPieceIds : [pieceId], start: point, current: point })
        return
      }
      // Empty space: start a marquee drag, resolved on pointerup (a drag too
      // small to be intentional is treated as a plain deselect-click instead).
      setMarquee({ start: point, end: point, additive: e.shiftKey })
      return
    }

    if (toolMode === 'pan') {
      setPanStart({ clientX: e.clientX, clientY: e.clientY, viewBox })
    }
  }

  function handlePointerMove(e) {
    if (dragVertex) {
      let raw = toDoc(e)
      // Shift: keep this point collinear with its two boundary neighbors --
      // e.g. sliding an internal-line endpoint back and forth along the edge
      // it sits on without letting it drift off that line and distort the
      // outer silhouette.
      if (e.shiftKey) {
        const piece = document.pieces.find((p) => p.id === dragVertex.pieceId)
        const index = piece?.vertices.findIndex((v) => v.id === dragVertex.vertexId) ?? -1
        if (piece && index !== -1 && piece.vertices.length >= 3) {
          const n = piece.vertices.length
          const prev = piece.vertices[(index - 1 + n) % n]
          const next = piece.vertices[(index + 1) % n]
          raw = projectPointOntoLine(raw, prev.point, next.point)
        }
      }
      // Re-evaluate docking on every move (not just at drag-start): sliding
      // near an edge docks it live, dragging far enough away frees it again.
      const snap = computeSnap(raw, { excludePieceId: dragVertex.pieceId })
      setDragVertex({ ...dragVertex, point: snap.point, dock: snap.dock })
    } else if (pieceDrag) {
      setPieceDrag({ ...pieceDrag, current: toDoc(e) })
    } else if (shapeDrag) {
      const raw = toDoc(e)
      const constrained = e.shiftKey ? snapOrthogonal(shapeDrag.start, raw) : raw
      const snap = computeSnap(constrained)
      setShapeDrag({ ...shapeDrag, end: snap.point, endDock: snap.dock })
    } else if (marquee) {
      setMarquee({ ...marquee, end: toDoc(e) })
    } else if (panStart) {
      const rect = svgRef.current.getBoundingClientRect()
      const dxMm = (e.clientX - panStart.clientX) * (panStart.viewBox.width / rect.width)
      const dyMm = (e.clientY - panStart.clientY) * (panStart.viewBox.height / rect.height)
      setViewBox({ ...panStart.viewBox, x: panStart.viewBox.x - dxMm, y: panStart.viewBox.y - dyMm })
    } else if (toolMode === 'draw-line' && activePieceId) {
      // Compute the dock preview even before the first point is placed --
      // only the shift-orthogonal constraint and the rubber-band *line*
      // itself need an existing lastVertex to measure/draw from; the dock
      // ring should already show while aiming the very first click.
      const piece = document.pieces.find((p) => p.id === activePieceId)
      const lastVertex = piece?.vertices[piece.vertices.length - 1]
      const raw = toDoc(e)
      const constrained = lastVertex && e.shiftKey ? snapOrthogonal(lastVertex.point, raw) : raw
      const snap = computeSnap(constrained)
      setHoverPoint(snap.point)
      setHoverDock(snap.dock)
    }
  }

  function handlePointerUp() {
    if (dragVertex) {
      dispatch({
        type: 'MOVE_VERTEX',
        pieceId: dragVertex.pieceId,
        vertexId: dragVertex.vertexId,
        point: dragVertex.point,
        dock: dragVertex.dock,
      })
      setDragVertex(null)
    }
    if (pieceDrag) {
      const dx = pieceDrag.current.x - pieceDrag.start.x
      const dy = pieceDrag.current.y - pieceDrag.start.y
      dispatch({ type: 'TRANSLATE_PIECES', pieceIds: pieceDrag.pieceIds, dx, dy })
      setPieceDrag(null)
    }
    if (shapeDrag) {
      const dist = Math.hypot(shapeDrag.end.x - shapeDrag.start.x, shapeDrag.end.y - shapeDrag.start.y)
      if (dist >= MIN_SHAPE_DRAG_MM) {
        if (toolMode === 'rect') {
          dispatch({ type: 'ADD_RECT_PIECE', corner1: shapeDrag.start, corner2: shapeDrag.end })
        } else if (toolMode === 'line') {
          dispatch({
            type: 'ADD_LINE_PIECE',
            start: shapeDrag.start,
            end: shapeDrag.end,
            startDock: shapeDrag.startDock,
            endDock: shapeDrag.endDock,
          })
        }
      }
      setShapeDrag(null)
    }
    if (marquee) {
      const dist = Math.hypot(marquee.end.x - marquee.start.x, marquee.end.y - marquee.start.y)
      if (dist >= MIN_SHAPE_DRAG_MM) {
        const minX = Math.min(marquee.start.x, marquee.end.x)
        const maxX = Math.max(marquee.start.x, marquee.end.x)
        const minY = Math.min(marquee.start.y, marquee.end.y)
        const maxY = Math.max(marquee.start.y, marquee.end.y)
        const ids = piecesTouchingRect(minX, minY, maxX, maxY)
        if (ids.length > 0) {
          dispatch({ type: 'SELECT_PIECES', pieceIds: ids, additive: marquee.additive })
        } else if (!marquee.additive) {
          dispatch({ type: 'CLEAR_SELECTION' })
          dispatch({ type: 'CLEAR_PIECE_SELECTION' })
        }
      } else if (!marquee.additive) {
        dispatch({ type: 'CLEAR_SELECTION' })
        dispatch({ type: 'CLEAR_PIECE_SELECTION' })
      }
      setMarquee(null)
    }
    setPanStart(null)
  }

  function handleWheel(e) {
    e.preventDefault()
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    const point = toDoc(e)
    setViewBox((vb) => ({
      x: point.x - (point.x - vb.x) * scale,
      y: point.y - (point.y - vb.y) * scale,
      width: vb.width * scale,
      height: vb.height * scale,
    }))
  }

  function handleDoubleClick() {
    if (toolMode === 'draw-line') {
      dispatch({ type: 'END_OPEN_PATH' })
      setHoverPoint(null)
      setHoverDock(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selection) {
        dispatch({ type: 'DELETE_VERTEX', pieceId: selection.pieceId, vertexId: selection.vertexId })
      } else if (selectedPieceIds.length > 0) {
        dispatch({ type: 'DELETE_PIECES', pieceIds: selectedPieceIds })
      }
    } else if (e.key === 'Escape' && toolMode === 'draw-line') {
      dispatch({ type: 'END_OPEN_PATH' })
      setHoverPoint(null)
      setHoverDock(null)
    }
  }

  const vertexRadiusMm = viewBox.width / 130

  const pieceDragOffset = pieceDrag
    ? { dx: pieceDrag.current.x - pieceDrag.start.x, dy: pieceDrag.current.y - pieceDrag.start.y }
    : null

  // Live (in-progress-drag) point for a single vertex, reflecting whichever
  // of the two drag gestures is touching it -- single-vertex drag, or a
  // whole-piece move currently in progress. Shared by the outline/vertex
  // rendering below and the internal-line rendering, so both stay in sync
  // with the drag instead of only the outline updating live.
  function liveVertexPoint(pieceId, vertex) {
    if (dragVertex && dragVertex.pieceId === pieceId && dragVertex.vertexId === vertex.id) {
      return dragVertex.point
    }
    if (pieceDragOffset && pieceDrag.pieceIds.includes(pieceId)) {
      return { x: vertex.point.x + pieceDragOffset.dx, y: vertex.point.y + pieceDragOffset.dy }
    }
    return vertex.point
  }

  // The "docking" visual cue: whichever point is currently live-snapped
  // (tracked explicitly via computeSnap's returned dock, not re-derived by
  // guessing from position -- an edge dock's point isn't necessarily equal
  // to any stored vertex, so an equality check alone can't detect it).
  const dockPoint =
    toolMode === 'draw-line' && hoverDock
      ? hoverPoint
      : toolMode === 'line' && shapeDrag?.endDock
        ? shapeDrag.end
        : toolMode === 'select' && dragVertex?.dock
          ? dragVertex.point
          : null

  // In "actual size" mode the SVG is given an explicit CSS pixel size derived
  // from the calibrated pxPerMm, instead of stretching to fill its container --
  // that's what makes holding a physical ruler to the screen agree with the
  // document's mm coordinates. Regular mode fills the available space instead.
  const sizeStyle = actualSize
    ? { width: viewBox.width * pxPerMm, height: viewBox.height * pxPerMm }
    : { width: '100%', height: '100%' }

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      tabIndex={0}
      style={{
        ...sizeStyle,
        display: 'block',
        background: '#fafafa',
        touchAction: 'none',
        outline: 'none',
        cursor:
          toolMode === 'pan'
            ? 'grab'
            : toolMode === 'draw-line' || toolMode === 'rect' || toolMode === 'line'
              ? 'crosshair'
              : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <Grid viewBox={viewBox} />

      {document.pieces.map((piece) => {
        const vertices = piece.vertices.map((v) => ({ ...v, point: liveVertexPoint(piece.id, v) }))
        const d = vertices.length >= 2 ? verticesToPathD(vertices, piece.closed) : ''
        const isActive = piece.id === activePieceId
        const isSelected = selectedPieceIds.includes(piece.id)

        return (
          <g key={piece.id}>
            {d && (
              <path
                d={d}
                fill={piece.closed ? 'rgba(122, 74, 30, 0.08)' : 'none'}
                stroke={isSelected ? '#1e6fe0' : '#7a4a1e'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {(toolMode === 'select' || isActive) &&
              vertices.map((v) => {
                const isSingleSelected = selection?.vertexId === v.id
                return (
                  <circle
                    key={v.id}
                    cx={v.point.x}
                    cy={v.point.y}
                    r={isSingleSelected ? vertexRadiusMm * 1.5 : vertexRadiusMm}
                    fill={isSingleSelected ? '#e0781e' : '#fff'}
                    stroke="#7a4a1e"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
          </g>
        )
      })}

      {document.offsetPaths.map((offsetPath) => {
        const piece = document.pieces.find((p) => p.id === offsetPath.sourcePieceId)
        if (!piece || piece.vertices.length < 2) return null
        const flattened = flattenToPolygon(piece.vertices, piece.closed)
        const loops = offsetPolygon(flattened, offsetPath.offsetDistance, piece.closed)
        return (
          <g key={offsetPath.id}>
            {loops.map((loop, i) => (
              <path
                key={i}
                d={pointsToPathD(loop, piece.closed)}
                fill="none"
                stroke="#2a7a4a"
                strokeDasharray="6 3"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )
      })}

      {document.internalLines.map((line) => {
        const piece = document.pieces.find((p) => p.id === line.sourcePieceId)
        if (!piece) return null
        const a = piece.vertices.find((v) => v.id === line.vertexIdA)
        const b = piece.vertices.find((v) => v.id === line.vertexIdB)
        if (!a || !b) return null

        const aLive = liveVertexPoint(piece.id, a)
        const bLive = liveVertexPoint(piece.id, b)
        const isMoving = aLive !== a.point || bLive !== b.point

        return (
          <g key={line.id}>
            {isMoving && (
              // "Before" ghost: the committed (pre-drag) position, so the
              // original placement stays visible for reference while dragging.
              <line
                x1={a.point.x}
                y1={a.point.y}
                x2={b.point.x}
                y2={b.point.y}
                stroke="#7a4a1e"
                strokeDasharray="2 3"
                strokeWidth={0.8}
                opacity={0.35}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <line
              x1={aLive.x}
              y1={aLive.y}
              x2={bLive.x}
              y2={bLive.y}
              stroke="#7a4a1e"
              strokeDasharray="5 3"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}

      {document.stitchLines.map((stitchLine) => {
        const def = document.stitchPatternDefs.find((d) => d.id === stitchLine.stitchPatternDefId)
        if (!def) return null

        let loops
        let holesClosed = false
        if (stitchLine.sourceInternalLineId) {
          // Stitching along a fold/mark internalLine: "inset" trims back
          // from its two endpoints instead of offsetting inward (an open
          // 2-point segment has no interior side to offset into), and it
          // tracks the same live drag position as the internalLine's
          // on-screen rendering so the holes don't lag behind a drag either.
          const line = document.internalLines.find((l) => l.id === stitchLine.sourceInternalLineId)
          if (!line) return null
          const linePiece = document.pieces.find((p) => p.id === line.sourcePieceId)
          if (!linePiece) return null
          const a = linePiece.vertices.find((v) => v.id === line.vertexIdA)
          const b = linePiece.vertices.find((v) => v.id === line.vertexIdB)
          if (!a || !b) return null
          const segment = insetSegment(liveVertexPoint(linePiece.id, a), liveVertexPoint(linePiece.id, b), stitchLine.insetDistance)
          loops = segment ? [segment] : []
        } else {
          const piece = document.pieces.find((p) => p.id === stitchLine.sourcePieceId)
          if (!piece || piece.vertices.length < 2) return null
          const flattened = flattenToPolygon(piece.vertices, piece.closed)
          loops = offsetPolygon(flattened, -stitchLine.insetDistance, piece.closed)
          holesClosed = piece.closed
        }
        const holeRadius = def.holeDiameter / 2

        return (
          <g key={stitchLine.id}>
            {loops.flatMap((loop, li) => {
              const holes = placeStitchHoles(loop, holesClosed, def.pitch)
              return holes.map((h, hi) =>
                def.style === 'diagonal' ? (
                  <rect
                    key={`${li}-${hi}`}
                    x={h.x - holeRadius}
                    y={h.y - holeRadius}
                    width={holeRadius * 2}
                    height={holeRadius * 2}
                    transform={`rotate(45 ${h.x} ${h.y})`}
                    fill="#b03060"
                  />
                ) : (
                  <circle key={`${li}-${hi}`} cx={h.x} cy={h.y} r={holeRadius} fill="#b03060" />
                )
              )
            })}
          </g>
        )
      })}

      {shapeDrag &&
        (toolMode === 'rect' ? (
          <rect
            x={Math.min(shapeDrag.start.x, shapeDrag.end.x)}
            y={Math.min(shapeDrag.start.y, shapeDrag.end.y)}
            width={Math.abs(shapeDrag.end.x - shapeDrag.start.x)}
            height={Math.abs(shapeDrag.end.y - shapeDrag.start.y)}
            fill="rgba(30,111,224,0.08)"
            stroke="#1e6fe0"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            x1={shapeDrag.start.x}
            y1={shapeDrag.start.y}
            x2={shapeDrag.end.x}
            y2={shapeDrag.end.y}
            stroke="#1e6fe0"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}

      {marquee && (
        <rect
          x={Math.min(marquee.start.x, marquee.end.x)}
          y={Math.min(marquee.start.y, marquee.end.y)}
          width={Math.abs(marquee.end.x - marquee.start.x)}
          height={Math.abs(marquee.end.y - marquee.start.y)}
          fill="rgba(30,111,224,0.06)"
          stroke="#1e6fe0"
          strokeDasharray="2 2"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {toolMode === 'draw-line' &&
        activePieceId &&
        hoverPoint &&
        (() => {
          const piece = document.pieces.find((p) => p.id === activePieceId)
          const lastVertex = piece?.vertices[piece.vertices.length - 1]
          if (!lastVertex) return null
          return (
            <line
              x1={lastVertex.point.x}
              y1={lastVertex.point.y}
              x2={hoverPoint.x}
              y2={hoverPoint.y}
              stroke="#1e6fe0"
              strokeDasharray="3 3"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )
        })()}

      {dockPoint && (
        <circle
          cx={dockPoint.x}
          cy={dockPoint.y}
          r={vertexRadiusMm * 2.2}
          fill="none"
          stroke="#e0781e"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}

export default PatternCanvas
