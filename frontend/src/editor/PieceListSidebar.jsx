import { useState } from 'react'
import StitchPatternManager from './StitchPatternManager.jsx'
import { generateId } from './geometry/id.js'
import Button from '../ui/Button.jsx'

const smallButtonStyle = { padding: '0.15rem 0.4rem', fontSize: '0.75rem' }

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
        <Button
          icon="↗"
          style={smallButtonStyle}
          onClick={() =>
            dispatch({
              type: 'ADD_OFFSET_PATH',
              offsetPath: {
                id: generateId(),
                name: `오프셋 +${distance}mm`,
                sourcePieceId: piece.id,
                offsetDistance: distance,
              },
            })
          }
        >
          바깥 오프셋
        </Button>
      </div>
      {pieceOffsets.map((o) => (
        <div key={o.id} style={{ fontSize: '0.75rem', color: '#2a7a4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{o.name}</span>
          <Button icon="✕" variant="danger" style={smallButtonStyle} onClick={() => dispatch({ type: 'DELETE_OFFSET_PATH', id: o.id })} />
        </div>
      ))}
    </div>
  )
}

function StitchLineControls({ piece, document, dispatch }) {
  const [inset, setInset] = useState(3)
  const [defId, setDefId] = useState(document.stitchPatternDefs[0]?.id ?? '')
  const pieceStitchLines = document.stitchLines.filter((s) => s.sourcePieceId === piece.id)

  if (document.stitchPatternDefs.length === 0) {
    return <p style={{ fontSize: '0.7rem', color: '#888', marginLeft: '0.5rem' }}>스티치 라인을 추가하려면 먼저 위에서 프리셋을 만드세요</p>
  }

  return (
    <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number"
          step="0.5"
          value={inset}
          onChange={(e) => setInset(Number(e.target.value))}
          style={{ width: '3.5rem' }}
        />
        <span style={{ fontSize: '0.75rem' }}>mm 인셋</span>
        <select value={defId} onChange={(e) => setDefId(e.target.value)}>
          {document.stitchPatternDefs.map((def) => (
            <option key={def.id} value={def.id}>
              {def.name}
            </option>
          ))}
        </select>
        <Button
          icon="🧵"
          style={smallButtonStyle}
          onClick={() =>
            dispatch({
              type: 'ADD_STITCH_LINE',
              stitchLine: {
                id: generateId(),
                name: `스티치 -${inset}mm`,
                sourcePieceId: piece.id,
                insetDistance: inset,
                stitchPatternDefId: defId,
              },
            })
          }
        >
          스티치 라인
        </Button>
      </div>
      {pieceStitchLines.map((s) => (
        <div key={s.id} style={{ fontSize: '0.75rem', color: '#b03060', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{s.name}</span>
          <Button icon="✕" variant="danger" style={smallButtonStyle} onClick={() => dispatch({ type: 'DELETE_STITCH_LINE', id: s.id })} />
        </div>
      ))}
    </div>
  )
}

function InternalLineStitchControls({ internalLine, document, dispatch }) {
  const [inset, setInset] = useState(2)
  const [defId, setDefId] = useState(document.stitchPatternDefs[0]?.id ?? '')
  const lineStitchLines = document.stitchLines.filter((s) => s.sourceInternalLineId === internalLine.id)

  if (document.stitchPatternDefs.length === 0) return null

  return (
    <div style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: '#7a4a1e' }}>{internalLine.name}</span>
        <input
          type="number"
          step="0.5"
          value={inset}
          onChange={(e) => setInset(Number(e.target.value))}
          style={{ width: '3.5rem' }}
        />
        <span style={{ fontSize: '0.75rem' }}>mm 인셋</span>
        <select value={defId} onChange={(e) => setDefId(e.target.value)}>
          {document.stitchPatternDefs.map((def) => (
            <option key={def.id} value={def.id}>
              {def.name}
            </option>
          ))}
        </select>
        <Button
          icon="🧵"
          style={smallButtonStyle}
          onClick={() =>
            dispatch({
              type: 'ADD_STITCH_LINE',
              stitchLine: {
                id: generateId(),
                name: `내부선 스티치 -${inset}mm`,
                sourceInternalLineId: internalLine.id,
                insetDistance: inset,
                stitchPatternDefId: defId,
              },
            })
          }
        >
          스티치
        </Button>
      </div>
      {lineStitchLines.map((s) => (
        <div key={s.id} style={{ fontSize: '0.75rem', color: '#b03060', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{s.name}</span>
          <Button icon="✕" variant="danger" style={smallButtonStyle} onClick={() => dispatch({ type: 'DELETE_STITCH_LINE', id: s.id })} />
        </div>
      ))}
    </div>
  )
}

function PieceListSidebar({ state, dispatch }) {
  const { document } = state

  return (
    <div style={{ width: 280, borderLeft: '1px solid #ddd', padding: '0.75rem', overflowY: 'auto' }}>
      <StitchPatternManager document={document} dispatch={dispatch} />

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
              <Button icon="✕" variant="danger" style={smallButtonStyle} onClick={() => dispatch({ type: 'DELETE_PIECE', pieceId: piece.id })} />
            </div>
            <OffsetPathControls piece={piece} offsetPaths={document.offsetPaths} dispatch={dispatch} />
            <StitchLineControls piece={piece} document={document} dispatch={dispatch} />
            {document.internalLines
              .filter((l) => l.sourcePieceId === piece.id)
              .map((internalLine) => (
                <InternalLineStitchControls
                  key={internalLine.id}
                  internalLine={internalLine}
                  document={document}
                  dispatch={dispatch}
                />
              ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PieceListSidebar
