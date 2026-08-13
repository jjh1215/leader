import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPattern, updatePattern } from '../api/patternsApi'

function PatternEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pattern, setPattern] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPattern(id)
      .then(setPattern)
      .catch((e) => setError(e.message))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await updatePattern(id, { name: pattern.name, content: pattern.content })
      setPattern(saved)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
        <p style={{ color: 'crimson' }}>{error}</p>
        <button onClick={() => navigate('/')}>목록으로</button>
      </div>
    )
  }

  if (!pattern) {
    return <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>불러오는 중...</div>
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <button onClick={() => navigate('/')}>← 목록으로</button>
      <h1>
        <input
          value={pattern.name}
          onChange={(e) => setPattern({ ...pattern, name: e.target.value })}
          style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
        />
      </h1>
      <button onClick={handleSave} disabled={saving}>
        {saving ? '저장 중...' : '저장'}
      </button>
      <p style={{ color: '#888' }}>에디터 캔버스 준비 중 — 지금은 저장/불러오기 왕복만 확인하는 단계입니다.</p>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto' }}>
        {JSON.stringify(pattern.content, null, 2)}
      </pre>
    </div>
  )
}

export default PatternEditorPage
