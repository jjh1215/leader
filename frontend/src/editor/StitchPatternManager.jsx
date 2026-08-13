import { useState } from 'react'
import { generateId } from './geometry/id.js'

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
              {def.name} (pitch {def.pitch}mm, 홀 {def.holeDiameter}mm, {def.style === 'single' ? '단일' : '대각'})
            </span>
            <button onClick={() => dispatch({ type: 'DELETE_STITCH_PATTERN_DEF', id: def.id })}>×</button>
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
            <option value="diagonal">대각선(유럽식)</option>
          </select>
        </label>
        <button onClick={handleAdd}>+ 프리셋 추가</button>
      </div>
    </div>
  )
}

export default StitchPatternManager
