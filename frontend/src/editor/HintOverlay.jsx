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
  const { toolMode, selectedPieceIds, selectedVertexIds } = state
  switch (toolMode) {
    case 'draw-line':
      return '클릭해서 점 추가 (Shift=직각 스냅) · 다른 점/변 근처에 놓으면 도킹되어 따라 움직임 · 시작점 근처를 클릭하면 닫힘 · Esc/더블클릭으로 열린 선 종료'
    case 'rect':
      return '드래그해서 직사각형 그리기 · 우측 하단에서 치수로도 그릴 수 있음'
    case 'line':
      return '드래그해서 직선 그리기 (Shift=직각 스냅) · 다른 점/변 근처에 놓으면 도킹됨 · 우측 하단에서 치수로도 그릴 수 있음'
    case 'select':
      if (selectedVertexIds.length > 0) {
        return `점 위에서 Shift+클릭으로 나눌 두 점 선택 · ${selectedVertexIds.length}/2개 선택됨`
      }
      return selectedPieceIds.length > 0
        ? `Shift+클릭/드래그로 여러 조각 선택 · Delete로 삭제 · 도형+선 선택 후 나누기/합치기 · ${selectedPieceIds.length}개 선택됨`
        : '빈 곳에서 드래그하면 여러 조각을 한번에 선택 · 점에 Shift+클릭하면 그 점끼리 나누기'
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
