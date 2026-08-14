import { useState } from 'react'
import { isAxisAlignedRect } from './geometry/rectDetect.js'

function lineLengthAngle(piece) {
  const [a, b] = piece.vertices
  const dx = b.point.x - a.point.x
  const dy = b.point.y - a.point.y
  return { length: Math.hypot(dx, dy), angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI }
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function DrawByDimensionPanel({ toolMode, dispatch }) {
  const [width, setWidth] = useState(50)
  const [height, setHeight] = useState(30)
  const [length, setLength] = useState(50)
  const [angleDeg, setAngleDeg] = useState(0)

  if (toolMode === 'rect') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ color: '#888' }}>치수로 그리기:</span>
        <input type="number" min={0.1} step={1} value={width} onChange={(e) => setWidth(e.target.value)} style={{ width: '4rem' }} />
        <span>×</span>
        <input type="number" min={0.1} step={1} value={height} onChange={(e) => setHeight(e.target.value)} style={{ width: '4rem' }} />
        <span>mm</span>
        <button
          onClick={() =>
            dispatch({
              type: 'ADD_RECT_PIECE',
              corner1: { x: 0, y: 0 },
              corner2: { x: num(width, 1), y: num(height, 1) },
            })
          }
        >
          그리기
        </button>
      </span>
    )
  }

  if (toolMode === 'line') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ color: '#888' }}>치수로 그리기: 길이</span>
        <input type="number" min={0.1} step={1} value={length} onChange={(e) => setLength(e.target.value)} style={{ width: '4rem' }} />
        <span>mm, 각도</span>
        <input type="number" step={1} value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} style={{ width: '4rem' }} />
        <span>°</span>
        <button
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
        </button>
      </span>
    )
  }

  return null
}

function Toolbar({ state, dispatch, actualSize, onToggleActualSize, calibrated, onOpenCalibration }) {
  const { toolMode, document, selection, selectedPieceIds, past, future } = state

  const selectedVertex = selection
    ? document.pieces.find((p) => p.id === selection.pieceId)?.vertices.find((v) => v.id === selection.vertexId)
    : null

  const singleSelectedPiece =
    selectedPieceIds.length === 1 ? document.pieces.find((p) => p.id === selectedPieceIds[0]) : null
  const selectedLinePiece =
    singleSelectedPiece && !singleSelectedPiece.closed && singleSelectedPiece.vertices.length === 2
      ? singleSelectedPiece
      : null
  const selectedRect = singleSelectedPiece && singleSelectedPiece.closed ? isAxisAlignedRect(singleSelectedPiece.vertices) : null

  const canMerge =
    selectedPieceIds.length === 2 &&
    selectedPieceIds.every((id) => document.pieces.find((p) => p.id === id && !p.closed))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
      <button onClick={() => dispatch({ type: 'START_NEW_PIECE' })} disabled={toolMode === 'draw-line'}>
        + 자유 그리기
      </button>
      <button onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'rect' })} disabled={toolMode === 'rect'}>
        + 직사각형
      </button>
      <button onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'line' })} disabled={toolMode === 'line'}>
        + 직선
      </button>
      <button onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'select' })} disabled={toolMode === 'select'}>
        선택
      </button>
      <button onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'pan' })} disabled={toolMode === 'pan'}>
        이동(팬)
      </button>

      <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />

      <button
        onClick={() =>
          dispatch({ type: 'MERGE_PIECES', pieceIdA: selectedPieceIds[0], pieceIdB: selectedPieceIds[1] })
        }
        disabled={!canMerge}
        title="열린 선 2개를 가까운 끝점끼리 하나로 합칩니다"
      >
        선 합치기
      </button>

      <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />

      <button onClick={() => dispatch({ type: 'UNDO' })} disabled={past.length === 0}>
        ↶ 실행취소
      </button>
      <button onClick={() => dispatch({ type: 'REDO' })} disabled={future.length === 0}>
        ↷ 다시실행
      </button>

      <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />

      <button onClick={onOpenCalibration}>{calibrated ? '화면 보정 다시하기' : '⚠ 화면 보정 필요'}</button>
      <button onClick={onToggleActualSize} disabled={!calibrated} aria-pressed={actualSize}>
        {actualSize ? '✓ 실물 크기로 보는 중' : '실물 크기로 보기'}
      </button>

      {(toolMode === 'rect' || toolMode === 'line') && (
        <>
          <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />
          <DrawByDimensionPanel toolMode={toolMode} dispatch={dispatch} />
        </>
      )}

      {selectedVertex && (
        <>
          <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />
          <label>
            X (mm):{' '}
            <input
              type="number"
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
              style={{ width: '4.5rem' }}
            />
          </label>
          <label>
            Y (mm):{' '}
            <input
              type="number"
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
              style={{ width: '4.5rem' }}
            />
          </label>
          <label>
            모서리 radius (mm):{' '}
            <input
              type="number"
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
              style={{ width: '4rem' }}
            />
          </label>
        </>
      )}

      {selectedLinePiece &&
        (() => {
          const { length, angleDeg } = lineLengthAngle(selectedLinePiece)
          return (
            <>
              <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />
              <label>
                길이 (mm):{' '}
                <input
                  type="number"
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
                  style={{ width: '4.5rem' }}
                />
              </label>
              <label>
                각도 (°):{' '}
                <input
                  type="number"
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
                  style={{ width: '4.5rem' }}
                />
              </label>
            </>
          )
        })()}

      {selectedRect && (
        <>
          <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />
          <label>
            폭 (mm):{' '}
            <input
              type="number"
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
              style={{ width: '4.5rem' }}
            />
          </label>
          <label>
            높이 (mm):{' '}
            <input
              type="number"
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
              style={{ width: '4.5rem' }}
            />
          </label>
        </>
      )}

      {toolMode === 'draw-line' && (
        <span style={{ color: '#888' }}>
          클릭해서 점 추가 (Shift=직각 스냅) · 시작점 근처를 클릭하면 닫힘 · Esc/더블클릭으로 열린 선 종료
        </span>
      )}
      {toolMode === 'rect' && <span style={{ color: '#888' }}>드래그해서 직사각형 그리기</span>}
      {toolMode === 'line' && <span style={{ color: '#888' }}>드래그해서 직선 그리기 (Shift=직각 스냅)</span>}
      {toolMode === 'select' && selectedPieceIds.length > 0 && (
        <span style={{ color: '#888' }}>Shift+클릭으로 여러 조각 선택 · {selectedPieceIds.length}개 선택됨</span>
      )}
    </div>
  )
}

export default Toolbar
