function PieceListSidebar({ state, dispatch }) {
  const { document } = state

  return (
    <div style={{ width: 220, borderLeft: '1px solid #ddd', padding: '0.75rem' }}>
      <h3 style={{ marginTop: 0 }}>레이아웃 조각</h3>
      {document.pieces.length === 0 && <p style={{ color: '#888' }}>아직 없음</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {document.pieces.map((piece) => (
          <li key={piece.id} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
              value={piece.name}
              onChange={(e) => dispatch({ type: 'RENAME_PIECE', pieceId: piece.id, name: e.target.value })}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span style={{ fontSize: '0.75rem', color: '#888' }}>{piece.vertices.length}점</span>
            <button onClick={() => dispatch({ type: 'DELETE_PIECE', pieceId: piece.id })}>×</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PieceListSidebar
