function Toolbar({ state, dispatch, actualSize, onToggleActualSize, calibrated, onOpenCalibration }) {
  const { toolMode, document, selectedPieceIds, past, future } = state

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

      {toolMode === 'draw-line' && (
        <span style={{ color: '#888' }}>
          클릭해서 점 추가 (Shift=직각 스냅) · 시작점 근처를 클릭하면 닫힘 · Esc/더블클릭으로 열린 선 종료
        </span>
      )}
      {toolMode === 'rect' && <span style={{ color: '#888' }}>드래그해서 직사각형 그리기 (또는 우측 하단에서 치수 입력)</span>}
      {toolMode === 'line' && <span style={{ color: '#888' }}>드래그해서 직선 그리기 (Shift=직각 스냅, 또는 우측 하단에서 치수 입력)</span>}
      {toolMode === 'select' && selectedPieceIds.length > 0 && (
        <span style={{ color: '#888' }}>Shift+클릭으로 여러 조각 선택 · {selectedPieceIds.length}개 선택됨</span>
      )}
    </div>
  )
}

export default Toolbar
