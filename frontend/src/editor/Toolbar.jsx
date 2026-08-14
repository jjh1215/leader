import { flattenToPolygon } from './geometry/fillet.js'
import { insertLineIntersectionPoints, splitClosedPolygonByLine } from './geometry/splitPolygon.js'

const baseButtonStyle = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.15rem',
  minWidth: '2.6rem',
  padding: '0.3rem 0.4rem',
  border: '1px solid #d6d6d6',
  borderRadius: 6,
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
}

const iconStyle = { fontSize: '1.1rem', lineHeight: 1 }
const labelStyle = { fontSize: '0.6rem', lineHeight: 1, whiteSpace: 'nowrap' }

const activeButtonStyle = {
  background: '#1e6fe0',
  borderColor: '#1e6fe0',
  color: '#fff',
}

const disabledButtonStyle = {
  opacity: 0.4,
  cursor: 'default',
}

// Icon on top, a small label underneath -- icons alone turned out too hard
// to tell apart, but every button sharing this same fixed layout (icon row
// + tiny label row) means the label doesn't change the toolbar's height no
// matter how long a given button's text is, so it still can't push the
// canvas below it around. The title tooltip (name + description) stays for
// the extra detail that doesn't fit at this size.
function ToolButton({ icon, label, active, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ? `${label} — ${title}` : label}
      style={{
        ...baseButtonStyle,
        ...(active ? activeButtonStyle : {}),
        ...(disabled ? disabledButtonStyle : {}),
      }}
    >
      <span aria-hidden="true" style={iconStyle}>
        {icon}
      </span>
      <span style={labelStyle}>{label}</span>
    </button>
  )
}

function Divider() {
  return <span style={{ borderLeft: '1px solid #ddd', height: '2.2rem' }} />
}

function Toolbar({
  state,
  dispatch,
  actualSize,
  onToggleActualSize,
  calibrated,
  onOpenCalibration,
  showHints,
  onToggleHints,
}) {
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

  // Same selection precondition as "나누기" (a closed piece + a crossing
  // open line), but marks the crossing instead of cutting: the piece stays
  // one piece, the 2 crossing points become real vertices on it (so it
  // behaves like a hexagon afterward), and the line between them is kept as
  // a visible internal fold/score guide.
  function handleAddInternalLine() {
    if (!splitTarget) return
    const closedPiece = document.pieces.find((p) => p.id === splitTarget.closedPieceId)
    const linePiece = document.pieces.find((p) => p.id === splitTarget.linePieceId)
    const polygon = flattenToPolygon(closedPiece.vertices, true)
    const result = insertLineIntersectionPoints(polygon, linePiece.vertices[0].point, linePiece.vertices[1].point)
    if (!result) {
      alert(
        '선이 면을 정확히 두 번 가로지르지 않아 내부선을 표시할 수 없습니다.\n선의 양 끝이 면 밖에 있고, 면 경계를 한 번만 관통하도록 그려주세요.'
      )
      return
    }
    dispatch({ type: 'ADD_INTERNAL_LINE', ...splitTarget })
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
      <ToolButton
        icon="〰️"
        label="내부선 표시"
        disabled={!splitTarget}
        onClick={handleAddInternalLine}
        title="닫힌 도형 1개 + 가로지르는 선 1개를 선택하면, 도형은 둘로 나누지 않고 그대로 두면서 교차점 2개를 도형의 진짜 꼭짓점으로 추가하고 그 사이를 내부선(접는선/스티치 가이드)으로 남깁니다"
      />
      <ToolButton
        icon="➕"
        label="내부선 점 추가"
        active={toolMode === 'internal-point'}
        disabled={document.internalLines.length === 0}
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'internal-point' })}
        title="이 버튼을 누른 뒤 내부선을 클릭하면, 그 자리에서 내부선이 둘로 나뉘어 각각 따로 선택할 수 있게 됩니다"
      />

      <Divider />

      <ToolButton
        icon="↶"
        label="실행취소"
        disabled={past.length === 0}
        onClick={() => dispatch({ type: 'UNDO' })}
        title="마지막 작업을 취소합니다"
      />
      <ToolButton
        icon="↷"
        label="다시실행"
        disabled={future.length === 0}
        onClick={() => dispatch({ type: 'REDO' })}
        title="취소한 작업을 다시 실행합니다"
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
        title="모니터에 자를 대고 확인할 수 있도록 실제 치수 그대로 화면에 표시합니다"
      />

      <Divider />

      <ToolButton
        icon="💬"
        label="툴팁"
        active={showHints}
        onClick={onToggleHints}
        title="화면 좌측 하단에 뜨는 사용법 안내를 켜고 끕니다"
      />
    </div>
  )
}

export default Toolbar
