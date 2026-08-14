import { useRef, useState } from 'react'
import { flattenToPolygon, verticesToPathD } from './geometry/fillet.js'
import { distanceToPolyline } from './geometry/hitTest.js'
import { projectPointToPolyline } from './geometry/edgeDock.js'
import { offsetPolygon } from './geometry/offset.js'
import { pointsToPathD } from './geometry/path.js'
import { pxToMm, screenToDocPoint } from './geometry/screenToDoc.js'
import { snapOrthogonal } from './geometry/snap.js'
import { placeStitchHoles } from './geometry/stitch.js'

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

  function findNearestPiece(point) {
    const threshold = hitRadiusMm()
    let best = null
    let bestDist = threshold
    for (const piece of document.pieces) {
      if (piece.vertices.length < 2) continue
      const poly = flattenToPolygon(piece.vertices, piece.closed)
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
        dispatch({ type: 'SELECT_PIECE', pieceId, additive: e.shiftKey })
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
      // Re-evaluate docking on every move (not just at drag-start): sliding
      // near an edge docks it live, dragging far enough away frees it again.
      const snap = computeSnap(toDoc(e), { excludePieceId: dragVertex.pieceId })
      setDragVertex({ ...dragVertex, point: snap.point, dock: snap.dock })
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
      const piece = document.pieces.find((p) => p.id === activePieceId)
      const lastVertex = piece?.vertices[piece.vertices.length - 1]
      if (lastVertex) {
        const raw = toDoc(e)
        const constrained = e.shiftKey ? snapOrthogonal(lastVertex.point, raw) : raw
        const snap = computeSnap(constrained)
        setHoverPoint(snap.point)
        setHoverDock(snap.dock)
      }
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
        const vertices =
          dragVertex && piece.id === dragVertex.pieceId
            ? piece.vertices.map((v) => (v.id === dragVertex.vertexId ? { ...v, point: dragVertex.point } : v))
            : piece.vertices
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
              vertices.map((v) => (
                <circle
                  key={v.id}
                  cx={v.point.x}
                  cy={v.point.y}
                  r={selection?.vertexId === v.id ? vertexRadiusMm * 1.5 : vertexRadiusMm}
                  fill={selection?.vertexId === v.id ? '#e0781e' : '#fff'}
                  stroke="#7a4a1e"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
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

      {document.stitchLines.map((stitchLine) => {
        const piece = document.pieces.find((p) => p.id === stitchLine.sourcePieceId)
        const def = document.stitchPatternDefs.find((d) => d.id === stitchLine.stitchPatternDefId)
        if (!piece || !def || piece.vertices.length < 2) return null
        const flattened = flattenToPolygon(piece.vertices, piece.closed)
        const loops = offsetPolygon(flattened, -stitchLine.insetDistance, piece.closed)
        const holeRadius = def.holeDiameter / 2

        return (
          <g key={stitchLine.id}>
            {loops.flatMap((loop, li) => {
              const holes = placeStitchHoles(loop, piece.closed, def.pitch)
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
