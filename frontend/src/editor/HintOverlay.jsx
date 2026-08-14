// Floating, absolutely-positioned hint text for the current tool mode --
// pulled out of the toolbar row for the same reason as DimensionPanel: this
// text changes per tool mode, and having it inline in the toolbar's flex-wrap
// row made the row's height (and therefore the canvas beneath it) shift
// depending on which hint was showing. Rendered as a bottom-left overlay on
// the canvas instead, so it never affects layout.
const panelStyle = {
  position: 'absolute',
  left: '1rem',
  bottom: '1rem',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid #ddd',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.8rem',
  color: '#666',
  zIndex: 10,
  maxWidth: '22rem',
}

function hintFor(state) {
  const { toolMode, selectedPieceIds } = state
  switch (toolMode) {
    case 'draw-line':
      return '클릭해서 점 추가 (Shift=직각 스냅) · 시작점 근처를 클릭하면 닫힘 · Esc/더블클릭으로 열린 선 종료'
    case 'rect':
      return '드래그해서 직사각형 그리기 · 우측 하단에서 치수로도 그릴 수 있음'
    case 'line':
      return '드래그해서 직선 그리기 (Shift=직각 스냅) · 우측 하단에서 치수로도 그릴 수 있음'
    case 'select':
      return selectedPieceIds.length > 0
        ? `Shift+클릭으로 여러 조각 선택 · ${selectedPieceIds.length}개 선택됨`
        : null
    default:
      return null
  }
}

function HintOverlay({ state }) {
  const text = hintFor(state)
  if (!text) return null
  return <div style={panelStyle}>{text}</div>
}

export default HintOverlay
