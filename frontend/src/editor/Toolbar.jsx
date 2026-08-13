function Toolbar({ state, dispatch }) {
  const { toolMode, document, selection, past, future } = state

  const selectedVertex = selection
    ? document.pieces
        .find((p) => p.id === selection.pieceId)
        ?.vertices.find((v) => v.id === selection.vertexId)
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
      <button
        onClick={() => dispatch({ type: 'START_NEW_PIECE' })}
        disabled={toolMode === 'draw-line'}
      >
        + 새 레이아웃 그리기
      </button>
      <button
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'select' })}
        disabled={toolMode === 'select'}
      >
        선택
      </button>
      <button
        onClick={() => dispatch({ type: 'SET_TOOL_MODE', mode: 'pan' })}
        disabled={toolMode === 'pan'}
      >
        이동(팬)
      </button>

      <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />

      <button onClick={() => dispatch({ type: 'UNDO' })} disabled={past.length === 0}>
        ↶ 실행취소
      </button>
      <button onClick={() => dispatch({ type: 'REDO' })} disabled={future.length === 0}>
        ↷ 다시실행
      </button>

      {selectedVertex && (
        <>
          <span style={{ borderLeft: '1px solid #ccc', height: '1.5rem' }} />
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
                  radius: Math.max(0, Number(e.target.value) || 0),
                })
              }
              style={{ width: '4rem' }}
            />
          </label>
        </>
      )}

      {toolMode === 'draw-line' && (
        <span style={{ color: '#888' }}>
          클릭해서 점 추가 · 시작점 근처를 클릭하면 닫힘 · Esc/더블클릭으로 열린 선 종료
        </span>
      )}
    </div>
  )
}

export default Toolbar
