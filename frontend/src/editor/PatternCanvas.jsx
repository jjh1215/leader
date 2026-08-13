import { useRef, useState } from 'react'
import { verticesToPathD } from './geometry/fillet.js'
import { pxToMm, screenToDocPoint } from './geometry/screenToDoc.js'

const HIT_RADIUS_PX = 8
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

function PatternCanvas({ state, dispatch }) {
  const svgRef = useRef(null)
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX)
  const [dragVertex, setDragVertex] = useState(null) // transient preview: { pieceId, vertexId, point }
  const [panStart, setPanStart] = useState(null)

  const { document, toolMode, activePieceId, selection } = state

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

  function handlePointerDown(e) {
    const point = toDoc(e)

    if (toolMode === 'draw-line' && activePieceId) {
      const piece = document.pieces.find((p) => p.id === activePieceId)
      if (piece && piece.vertices.length >= 3) {
        const first = piece.vertices[0]
        const d = Math.hypot(first.point.x - point.x, first.point.y - point.y)
        if (d < hitRadiusMm()) {
          dispatch({ type: 'CLOSE_ACTIVE_PIECE' })
          return
        }
      }
      dispatch({ type: 'ADD_VERTEX', pieceId: activePieceId, point })
      return
    }

    if (toolMode === 'select') {
      const hit = findNearestVertex(point)
      if (hit) {
        dispatch({ type: 'SELECT_VERTEX', pieceId: hit.pieceId, vertexId: hit.vertexId })
        const piece = document.pieces.find((p) => p.id === hit.pieceId)
        const v = piece.vertices.find((vv) => vv.id === hit.vertexId)
        setDragVertex({ ...hit, point: v.point })
      } else {
        dispatch({ type: 'CLEAR_SELECTION' })
      }
      return
    }

    if (toolMode === 'pan') {
      setPanStart({ clientX: e.clientX, clientY: e.clientY, viewBox })
    }
  }

  function handlePointerMove(e) {
    if (dragVertex) {
      setDragVertex({ ...dragVertex, point: toDoc(e) })
    } else if (panStart) {
      const rect = svgRef.current.getBoundingClientRect()
      const dxMm = (e.clientX - panStart.clientX) * (panStart.viewBox.width / rect.width)
      const dyMm = (e.clientY - panStart.clientY) * (panStart.viewBox.height / rect.height)
      setViewBox({ ...panStart.viewBox, x: panStart.viewBox.x - dxMm, y: panStart.viewBox.y - dyMm })
    }
  }

  function handlePointerUp() {
    if (dragVertex) {
      dispatch({
        type: 'MOVE_VERTEX',
        pieceId: dragVertex.pieceId,
        vertexId: dragVertex.vertexId,
        point: dragVertex.point,
      })
      setDragVertex(null)
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
    }
  }

  function handleKeyDown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      dispatch({ type: 'DELETE_VERTEX', pieceId: selection.pieceId, vertexId: selection.vertexId })
    } else if (e.key === 'Escape' && toolMode === 'draw-line') {
      dispatch({ type: 'END_OPEN_PATH' })
    }
  }

  const vertexRadiusMm = viewBox.width / 130

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      tabIndex={0}
      style={{
        width: '100%',
        height: '100%',
        background: '#fafafa',
        touchAction: 'none',
        outline: 'none',
        cursor: toolMode === 'pan' ? 'grab' : toolMode === 'draw-line' ? 'crosshair' : 'default',
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

        return (
          <g key={piece.id}>
            {d && (
              <path
                d={d}
                fill={piece.closed ? 'rgba(122, 74, 30, 0.08)' : 'none'}
                stroke="#7a4a1e"
                strokeWidth={1.5}
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
    </svg>
  )
}

export default PatternCanvas
