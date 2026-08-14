import { useState } from 'react'
import { generateId } from './geometry/id.js'
import Button from '../ui/Button.jsx'

const smallButtonStyle = { padding: '0.15rem 0.4rem', fontSize: '0.75rem' }

const STYLE_LABELS = { single: '단일 홀', diagonal: '다이아몬드', slash: '대각선(사선)', backslash: '역사선(사선 반대)' }

function StitchPatternManager({ document, dispatch }) {
  const [name, setName] = useState('기본 스티치')
  const [pitch, setPitch] = useState(4)
  const [holeDiameter, setHoleDiameter] = useState(1)
  const [style, setStyle] = useState('single')

  function handleAdd() {
    dispatch({
      type: 'ADD_STITCH_PATTERN_DEF',
      def: { id: generateId(), name, pitch, holeDiameter, style },
    })
  }

  return (
    <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #ddd' }}>
      <h3 style={{ marginTop: 0 }}>스티치 패턴 프리셋</h3>
      {document.stitchPatternDefs.length === 0 && <p style={{ color: '#888', fontSize: '0.85rem' }}>아직 없음</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {document.stitchPatternDefs.map((def) => (
          <li key={def.id} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>
              {def.name} (pitch {def.pitch}mm, 홀 {def.holeDiameter}mm, {STYLE_LABELS[def.style] ?? def.style})
            </span>
            <Button
              icon="✕"
              variant="danger"
              style={smallButtonStyle}
              onClick={() => dispatch({ type: 'DELETE_STITCH_PATTERN_DEF', id: def.id })}
            />
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
        <label>
          간격(pitch, mm):{' '}
          <input type="number" step="0.5" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} style={{ width: '3.5rem' }} />
        </label>
        <label>
          홀 지름(mm):{' '}
          <input
            type="number"
            step="0.1"
            value={holeDiameter}
            onChange={(e) => setHoleDiameter(Number(e.target.value))}
            style={{ width: '3.5rem' }}
          />
        </label>
        <label>
          스타일:{' '}
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="single">단일 홀</option>
            <option value="diagonal">다이아몬드</option>
            <option value="slash">대각선(사선)</option>
            <option value="backslash">역사선(사선 반대)</option>
          </select>
        </label>
        <Button icon="➕" onClick={handleAdd}>
          프리셋 추가
        </Button>
      </div>
    </div>
  )
}

export default StitchPatternManager
