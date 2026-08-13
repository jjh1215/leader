import { useState } from 'react'

function OffsetPathControls({ piece, offsetPaths, dispatch }) {
  const [distance, setDistance] = useState(5)
  const pieceOffsets = offsetPaths.filter((o) => o.sourcePieceId === piece.id)

  return (
    <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <input
          type="number"
          step="0.5"
          value={distance}
          onChange={(e) => setDistance(Number(e.target.value))}
          style={{ width: '3.5rem' }}
        />
        <span style={{ fontSize: '0.75rem' }}>mm</span>
        <button
          onClick={() =>
            dispatch({
              type: 'ADD_OFFSET_PATH',
              offsetPath: {
                id: crypto.randomUUID(),
                name: `오프셋 +${distance}mm`,
                sourcePieceId: piece.id,
                offsetDistance: distance,
              },
            })
          }
        >
          + 바깥 오프셋
        </button>
      </div>
      {pieceOffsets.map((o) => (
        <div key={o.id} style={{ fontSize: '0.75rem', color: '#2a7a4a', display: 'flex', justifyContent: 'space-between' }}>
          <span>{o.name}</span>
          <button onClick={() => dispatch({ type: 'DELETE_OFFSET_PATH', id: o.id })}>×</button>
        </div>
      ))}
    </div>
  )
}

function PieceListSidebar({ state, dispatch }) {
  const { document } = state

  return (
    <div style={{ width: 260, borderLeft: '1px solid #ddd', padding: '0.75rem', overflowY: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>레이아웃 조각</h3>
      {document.pieces.length === 0 && <p style={{ color: '#888' }}>아직 없음</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {document.pieces.map((piece) => (
          <li key={piece.id} style={{ marginBottom: '0.75rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                value={piece.name}
                onChange={(e) => dispatch({ type: 'RENAME_PIECE', pieceId: piece.id, name: e.target.value })}
                style={{ flex: 1, minWidth: 0 }}
              />
              <span style={{ fontSize: '0.75rem', color: '#888' }}>{piece.vertices.length}점</span>
              <button onClick={() => dispatch({ type: 'DELETE_PIECE', pieceId: piece.id })}>×</button>
            </div>
            <OffsetPathControls piece={piece} offsetPaths={document.offsetPaths} dispatch={dispatch} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PieceListSidebar
