import { useState } from 'react'
import { isAxisAlignedRect } from './geometry/rectDetect.js'
import Button from '../ui/Button.jsx'

function lineLengthAngle(piece) {
  const [a, b] = piece.vertices
  const dx = b.point.x - a.point.x
  const dy = b.point.y - a.point.y
  return { length: Math.hypot(dx, dy), angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI }
}

function pieceBoundingBoxMin(piece) {
  const xs = piece.vertices.map((v) => v.point.x)
  const ys = piece.vertices.map((v) => v.point.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys) }
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const panelStyle = {
  position: 'absolute',
  right: '1rem',
  bottom: '1rem',
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  fontSize: '0.85rem',
  zIndex: 10,
  minWidth: '11rem',
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: '0.4rem' }
const fieldStyle = { width: '5rem' }

function Field({ label, ...inputProps }) {
  return (
    <label style={rowStyle}>
      <span style={{ flex: 1 }}>{label}</span>
      <input type="number" style={fieldStyle} {...inputProps} />
    </label>
  )
}

function DrawByDimensionSection({ toolMode, dispatch }) {
  const [width, setWidth] = useState(50)
  const [height, setHeight] = useState(30)
  const [length, setLength] = useState(50)
  const [angleDeg, setAngleDeg] = useState(0)

  if (toolMode === 'rect') {
    return (
      <>
        <strong>치수로 그리기</strong>
        <Field label="폭 (mm)" min={0.1} step={1} value={width} onChange={(e) => setWidth(e.target.value)} />
        <Field label="높이 (mm)" min={0.1} step={1} value={height} onChange={(e) => setHeight(e.target.value)} />
        <Button
          icon="⬜"
          variant="primary"
          onClick={() =>
            dispatch({
              type: 'ADD_RECT_PIECE',
              corner1: { x: 0, y: 0 },
              corner2: { x: num(width, 1), y: num(height, 1) },
            })
          }
        >
          그리기
        </Button>
      </>
    )
  }

  if (toolMode === 'line') {
    return (
      <>
        <strong>치수로 그리기</strong>
        <Field label="길이 (mm)" min={0.1} step={1} value={length} onChange={(e) => setLength(e.target.value)} />
        <Field label="각도 (°)" step={1} value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} />
        <Button
          icon="📏"
          variant="primary"
          onClick={() => {
            const rad = (num(angleDeg) * Math.PI) / 180
            const len = num(length, 1)
            dispatch({
              type: 'ADD_LINE_PIECE',
              start: { x: 0, y: 0 },
              end: { x: len * Math.cos(rad), y: len * Math.sin(rad) },
            })
          }}
        >
          그리기
        </Button>
      </>
    )
  }

  return null
}

// Floating, absolutely-positioned panel for every dimension/radius input
// (selected vertex X/Y/radius, selected line length/angle, selected rect
// width/height, and the rect/line "draw by dimension" fields). Kept out of
// the toolbar's normal document flow on purpose: these fields appear and
// disappear based on selection/tool mode, and having them inline in the
// toolbar row made that row wrap/resize, which shifted the canvas underneath
// it every time. Rendered as a sibling overlay on the canvas instead, so
// showing/hiding it never moves the canvas.
function DimensionPanel({ state, dispatch }) {
  const { toolMode, document, selection, selectedPieceIds, internalLineSelection } = state

  const selectedVertex = selection
    ? document.pieces.find((p) => p.id === selection.pieceId)?.vertices.find((v) => v.id === selection.vertexId)
    : null

  const selectedInternalLinePoint = internalLineSelection
    ? document.internalLines
        .find((l) => l.id === internalLineSelection.internalLineId)
        ?.points.find((p) => p.id === internalLineSelection.pointId)
    : null

  const singleSelectedPiece =
    selectedPieceIds.length === 1 ? document.pieces.find((p) => p.id === selectedPieceIds[0]) : null
  const selectedLinePiece =
    singleSelectedPiece && !singleSelectedPiece.closed && singleSelectedPiece.vertices.length === 2
      ? singleSelectedPiece
      : null
  const selectedRect =
    singleSelectedPiece && singleSelectedPiece.closed ? isAxisAlignedRect(singleSelectedPiece.vertices) : null

  const showDrawByDimension = toolMode === 'rect' || toolMode === 'line'
  const positionMin = toolMode === 'select' && singleSelectedPiece ? pieceBoundingBoxMin(singleSelectedPiece) : null

  if (
    !selectedVertex &&
    !selectedInternalLinePoint &&
    !selectedLinePiece &&
    !selectedRect &&
    !showDrawByDimension &&
    !positionMin
  ) {
    return null
  }

  return (
    <div style={panelStyle}>
      {selectedInternalLinePoint && (
        <>
          <strong>내부선 점 위치</strong>
          <Field
            label="X (mm)"
            step={0.5}
            value={Number(selectedInternalLinePoint.point.x.toFixed(3))}
            onChange={(e) =>
              dispatch({
                type: 'MOVE_INTERNAL_LINE_POINT',
                internalLineId: internalLineSelection.internalLineId,
                pointId: internalLineSelection.pointId,
                point: {
                  x: num(e.target.value, selectedInternalLinePoint.point.x),
                  y: selectedInternalLinePoint.point.y,
                },
              })
            }
          />
          <Field
            label="Y (mm)"
            step={0.5}
            value={Number(selectedInternalLinePoint.point.y.toFixed(3))}
            onChange={(e) =>
              dispatch({
                type: 'MOVE_INTERNAL_LINE_POINT',
                internalLineId: internalLineSelection.internalLineId,
                pointId: internalLineSelection.pointId,
                point: {
                  x: selectedInternalLinePoint.point.x,
                  y: num(e.target.value, selectedInternalLinePoint.point.y),
                },
              })
            }
          />
        </>
      )}

      {positionMin && (
        <>
          <strong>조각 위치</strong>
          <Field
            label="X (mm)"
            step={0.5}
            value={Number(positionMin.minX.toFixed(3))}
            onChange={(e) => {
              const dx = num(e.target.value, positionMin.minX) - positionMin.minX
              dispatch({ type: 'TRANSLATE_PIECES', pieceIds: [singleSelectedPiece.id], dx, dy: 0 })
            }}
          />
          <Field
            label="Y (mm)"
            step={0.5}
            value={Number(positionMin.minY.toFixed(3))}
            onChange={(e) => {
              const dy = num(e.target.value, positionMin.minY) - positionMin.minY
              dispatch({ type: 'TRANSLATE_PIECES', pieceIds: [singleSelectedPiece.id], dx: 0, dy })
            }}
          />
        </>
      )}

      {selectedVertex && (
        <>
          <strong>점 위치</strong>
          <Field
            label="X (mm)"
            step={0.5}
            value={selectedVertex.point.x}
            onChange={(e) =>
              dispatch({
                type: 'MOVE_VERTEX',
                pieceId: selection.pieceId,
                vertexId: selection.vertexId,
                point: { x: num(e.target.value, selectedVertex.point.x), y: selectedVertex.point.y },
              })
            }
          />
          <Field
            label="Y (mm)"
            step={0.5}
            value={selectedVertex.point.y}
            onChange={(e) =>
              dispatch({
                type: 'MOVE_VERTEX',
                pieceId: selection.pieceId,
                vertexId: selection.vertexId,
                point: { x: selectedVertex.point.x, y: num(e.target.value, selectedVertex.point.y) },
              })
            }
          />
          <Field
            label="모서리 R (mm)"
            min={0}
            step={0.5}
            value={selectedVertex.cornerRadius}
            onChange={(e) =>
              dispatch({
                type: 'SET_VERTEX_RADIUS',
                pieceId: selection.pieceId,
                vertexId: selection.vertexId,
                radius: Math.max(0, num(e.target.value)),
              })
            }
          />
        </>
      )}

      {selectedLinePiece &&
        (() => {
          const { length, angleDeg } = lineLengthAngle(selectedLinePiece)
          return (
            <>
              <strong>선 치수</strong>
              <Field
                label="길이 (mm)"
                min={0.1}
                step={0.5}
                value={Number(length.toFixed(3))}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_LINE_DIMENSIONS',
                    pieceId: selectedLinePiece.id,
                    length: Math.max(0.1, num(e.target.value, length)),
                    angleDeg,
                  })
                }
              />
              <Field
                label="각도 (°)"
                step={1}
                value={Number(angleDeg.toFixed(2))}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_LINE_DIMENSIONS',
                    pieceId: selectedLinePiece.id,
                    length,
                    angleDeg: num(e.target.value, angleDeg),
                  })
                }
              />
            </>
          )
        })()}

      {selectedRect && (
        <>
          <strong>사각형 치수</strong>
          <Field
            label="폭 (mm)"
            min={0.1}
            step={0.5}
            value={Number(selectedRect.width.toFixed(3))}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_DIMENSIONS',
                pieceId: singleSelectedPiece.id,
                minX: selectedRect.minX,
                minY: selectedRect.minY,
                width: Math.max(0.1, num(e.target.value, selectedRect.width)),
                height: selectedRect.height,
              })
            }
          />
          <Field
            label="높이 (mm)"
            min={0.1}
            step={0.5}
            value={Number(selectedRect.height.toFixed(3))}
            onChange={(e) =>
              dispatch({
                type: 'SET_RECT_DIMENSIONS',
                pieceId: singleSelectedPiece.id,
                minX: selectedRect.minX,
                minY: selectedRect.minY,
                width: selectedRect.width,
                height: Math.max(0.1, num(e.target.value, selectedRect.height)),
              })
            }
          />
        </>
      )}

      {showDrawByDimension && <DrawByDimensionSection toolMode={toolMode} dispatch={dispatch} />}
    </div>
  )
}

export default DimensionPanel
