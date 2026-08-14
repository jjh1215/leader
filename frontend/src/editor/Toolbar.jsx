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

  const canMerge =
    selectedPieceIds.length === 2 &&
    selectedPieceIds.every((id) => document.pieces.find((p) => p.id === id && !p.closed))

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
        label="선 합치기"
        disabled={!canMerge}
        onClick={() =>
          dispatch({ type: 'MERGE_PIECES', pieceIdA: selectedPieceIds[0], pieceIdB: selectedPieceIds[1] })
        }
        title="열린 선 2개를 가까운 끝점끼리 하나로 합칩니다"
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
