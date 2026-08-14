import { flattenToPolygon } from './geometry/fillet.js'
import { splitClosedPolygonByLine } from './geometry/splitPolygon.js'

const baseButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.4rem 0.7rem',
  border: '1px solid #d6d6d6',
  borderRadius: 6,
  background: '#fff',
  color: '#333',
  fontSize: '0.85rem',
  lineHeight: 1,
  cursor: 'pointer',
}

const activeButtonStyle = {
  background: '#1e6fe0',
  borderColor: '#1e6fe0',
  color: '#fff',
}

const disabledButtonStyle = {
  opacity: 0.4,
  cursor: 'default',
}

function ToolButton({ icon, label, active, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...baseButtonStyle,
        ...(active ? activeButtonStyle : {}),
        ...(disabled ? disabledButtonStyle : {}),
      }}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function Divider() {
  return <span style={{ borderLeft: '1px solid #ddd', height: '1.5rem' }} />
}

function Toolbar({ state, dispatch, actualSize, onToggleActualSize, calibrated, onOpenCalibration }) {
  const { toolMode, document, selectedPieceIds, past, future } = state

  const twoSelected =
    selectedPieceIds.length === 2
      ? selectedPieceIds.map((id) => document.pieces.find((p) => p.id === id)).filter(Boolean)
      : []

  const canMerge =
    twoSelected.length === 2 && (twoSelected.every((p) => !p.closed) || twoSelected.every((p) => p.closed))

  // Split needs exactly one closed piece (the face) + one open 2-point line
  // (the cut) selected together, in either click order.
  const splitTarget =
    twoSelected.length === 2
      ? twoSelected[0].closed && !twoSelected[1].closed && twoSelected[1].vertices.length === 2
        ? { closedPieceId: twoSelected[0].id, linePieceId: twoSelected[1].id }
        : twoSelected[1].closed && !twoSelected[0].closed && twoSelected[0].vertices.length === 2
          ? { closedPieceId: twoSelected[1].id, linePieceId: twoSelected[0].id }
          : null
      : null

  function handleSplit() {
    if (!splitTarget) return
    const closedPiece = document.pieces.find((p) => p.id === splitTarget.closedPieceId)
    const linePiece = document.pieces.find((p) => p.id === splitTarget.linePieceId)
    const polygon = flattenToPolygon(closedPiece.vertices, true)
    const loops = splitClosedPolygonByLine(polygon, linePiece.vertices[0].point, linePiece.vertices[1].point)
    if (!loops) {
      alert(
        '선이 면을 정확히 두 번 가로지르지 않아 나눌 수 없습니다.\n선의 양 끝이 면 밖에 있고, 면 경계를 한 번만 관통하도록 그려주세요.'
      )
      return
    }
    dispatch({ type: 'SPLIT_PIECE', ...splitTarget })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
      <ToolButton
        icon="✏️"
        label="자유 그리기"
        active={toolMode === 'draw-line'}
        disabled={toolMode === 'draw-line'}
        onClick={() => dispatch({ type: 'START_NEW_PIECE' })}
        title="클릭으로 점을 찍어 자유롭게 선/도형을 그립니다"
      />
      <ToolButton
        icon="⬜"
        label="직사각형"
        active={toolMode === 'rect'}
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'rect' })}
        title="드래그로 직사각형을 그립니다"
      />
      <ToolButton
        icon="📏"
        label="직선"
        active={toolMode === 'line'}
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'line' })}
        title="드래그로 직선을 그립니다"
      />
      <ToolButton
        icon="↖"
        label="선택"
        active={toolMode === 'select'}
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'select' })}
        title="점/조각을 선택해서 이동·수정합니다"
      />
      <ToolButton
        icon="✋"
        label="이동"
        active={toolMode === 'pan'}
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'pan' })}
        title="드래그로 화면을 이동합니다"
      />

      <Divider />

      <ToolButton
        icon="🔗"
        label="합치기"
        disabled={!canMerge}
        onClick={() =>
          dispatch({ type: 'MERGE_PIECES', pieceIdA: selectedPieceIds[0], pieceIdB: selectedPieceIds[1] })
        }
        title="열린 선 2개는 끝점끼리 이어서, 닫힌 도형 2개는 겹치는 영역을 합쳐서 하나로 만듭니다"
      />
      <ToolButton
        icon="✂️"
        label="나누기"
        disabled={!splitTarget}
        onClick={handleSplit}
        title="닫힌 도형 1개 + 그 도형을 가로지르는 열린 선 1개를 선택하면, 선을 기준으로 도형을 둘로 나눕니다"
      />

      <Divider />

      <ToolButton
        icon="↶"
        label="실행취소"
        disabled={past.length === 0}
        onClick={() => dispatch({ type: 'UNDO' })}
      />
      <ToolButton
        icon="↷"
        label="다시실행"
        disabled={future.length === 0}
        onClick={() => dispatch({ type: 'REDO' })}
      />

      <Divider />

      <ToolButton
        icon="📐"
        label={calibrated ? '화면 보정 다시하기' : '화면 보정 필요'}
        onClick={onOpenCalibration}
        title="모니터에 자를 대고 실측해서 1:1 표시를 보정합니다"
      />
      <ToolButton
        icon="🔍"
        label="실물 크기로 보기"
        active={actualSize}
        disabled={!calibrated}
        onClick={onToggleActualSize}
      />
    </div>
  )
}

export default Toolbar
