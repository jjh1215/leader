import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPattern, updatePattern } from '../api/patternsApi'
import { usePatternReducer, emptyDocument } from '../editor/patternReducer.js'
import PatternCanvas from '../editor/PatternCanvas.jsx'
import Toolbar from '../editor/Toolbar.jsx'
import PieceListSidebar from '../editor/PieceListSidebar.jsx'
import { useScreenCalibration } from '../calibration/useScreenCalibration.js'
import CalibrationModal from '../calibration/CalibrationModal.jsx'

function PatternEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [state, dispatch] = usePatternReducer(emptyDocument())
  const calibration = useScreenCalibration()
  const [actualSize, setActualSize] = useState(false)
  const [showCalibrationModal, setShowCalibrationModal] = useState(false)

  useEffect(() => {
    getPattern(id)
      .then((pattern) => {
        setName(pattern.name)
        dispatch({ type: 'LOAD', document: pattern.content })
        setLoaded(true)
      })
      .catch((e) => setError(e.message))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      await updatePattern(id, { name, content: state.document })
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

  if (!loaded) {
    return <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>불러오는 중...</div>
  }

  return (
    <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/')}>← 목록으로</button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
        />
        <button onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div style={{ padding: '0 1rem', borderBottom: '1px solid #eee' }}>
        <Toolbar
          state={state}
          dispatch={dispatch}
          actualSize={actualSize}
          onToggleActualSize={() => setActualSize((v) => !v)}
          calibrated={calibration.calibrated}
          onOpenCalibration={() => setShowCalibrationModal(true)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PatternCanvas
            state={state}
            dispatch={dispatch}
            actualSize={actualSize}
            pxPerMm={calibration.pxPerMm}
          />
        </div>
        <PieceListSidebar state={state} dispatch={dispatch} />
      </div>

      {showCalibrationModal && (
        <CalibrationModal
          onClose={() => setShowCalibrationModal(false)}
          onCalibrate={calibration.setPxPerMm}
        />
      )}
    </div>
  )
}

export default PatternEditorPage
