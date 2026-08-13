import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPattern, deletePattern, listPatterns } from '../api/patternsApi'

const EMPTY_CONTENT = {
  pieces: [],
  stitchPatternDefs: [],
  stitchLines: [],
  offsetPaths: [],
}

function PatternListPage() {
  const [patterns, setPatterns] = useState(null)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  function refresh() {
    listPatterns().then(setPatterns).catch((e) => setError(e.message))
  }

  useEffect(refresh, [])

  async function handleCreate() {
    try {
      const created = await createPattern({ name: '새 패턴', content: EMPTY_CONTENT })
      navigate(`/patterns/${created.id}`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('이 패턴을 삭제할까요?')) return
    try {
      await deletePattern(id)
      refresh()
    } catch (e2) {
      setError(e2.message)
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>가죽공예 패턴</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button onClick={handleCreate}>+ 새 패턴</button>
      {patterns === null ? (
        <p>불러오는 중...</p>
      ) : patterns.length === 0 ? (
        <p>저장된 패턴이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
          {patterns.map((p) => (
            <li
              key={p.id}
              onClick={() => navigate(`/patterns/${p.id}`)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                border: '1px solid #ddd',
                borderRadius: 6,
                marginBottom: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <span>
                <strong>{p.name}</strong>
                <br />
                <small>수정: {new Date(p.updatedAt).toLocaleString('ko-KR')}</small>
              </span>
              <button onClick={(e) => handleDelete(p.id, e)}>삭제</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PatternListPage
