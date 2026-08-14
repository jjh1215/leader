import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPattern, updatePattern } from '../api/patternsApi'
import { usePatternReducer, emptyDocument } from '../editor/patternReducer.js'
import PatternCanvas from '../editor/PatternCanvas.jsx'
import Toolbar from '../editor/Toolbar.jsx'
import DimensionPanel from '../editor/DimensionPanel.jsx'
import HintOverlay from '../editor/HintOverlay.jsx'
import PieceListSidebar from '../editor/PieceListSidebar.jsx'
import { useScreenCalibration } from '../calibration/useScreenCalibration.js'
import CalibrationModal from '../calibration/CalibrationModal.jsx'
import { writeStoredPresets } from '../editor/stitchPresetsStorage.js'
import Button from '../ui/Button.jsx'

const HINTS_STORAGE_KEY = 'leader:showHints'

function readShowHints() {
  try {
    return localStorage.getItem(HINTS_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

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
  const [showHints, setShowHints] = useState(readShowHints)

  function toggleHints() {
    setShowHints((v) => {
      const next = !v
      try {
        localStorage.setItem(HINTS_STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        // localStorage unavailable (private mode etc.) -- toggle still works
        // for this page load, just won't persist across reloads.
      }
      return next
    })
  }

  useEffect(() => {
    getPattern(id)
      .then((pattern) => {
        setName(pattern.name)
        dispatch({ type: 'LOAD', document: pattern.content })
        setLoaded(true)
      })
      .catch((e) => setError(e.message))
  }, [id])

  // Mirrors this pattern's stitch pattern presets into localStorage so a
  // brand new pattern can seed from them (see PatternListPage) instead of
  // starting with none every time. Guarded on `loaded`: before the fetch
  // resolves, state.document is still the reducer's empty initial value,
  // and writing that would wipe out whatever was stored already.
  useEffect(() => {
    if (!loaded) return
    writeStoredPresets(state.document.stitchPatternDefs)
  }, [loaded, state.document.stitchPatternDefs])

  useEffect(() => {
    function handleGlobalKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' })
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [dispatch])

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
    <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button icon="←" onClick={() => navigate('/')}>
          목록으로
        </Button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            fontSize: '1.1rem',
            fontWeight: 'bold',
            border: '1px solid transparent',
            borderRadius: 6,
            padding: '0.3rem 0.5rem',
          }}
        />
        <Button icon="💾" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>

      <div style={{ padding: '0 1rem', borderBottom: '1px solid #eee' }}>
        <Toolbar
          state={state}
          dispatch={dispatch}
          actualSize={actualSize}
          onToggleActualSize={() => setActualSize((v) => !v)}
          calibrated={calibration.calibrated}
          onOpenCalibration={() => setShowCalibrationModal(true)}
          showHints={showHints}
          onToggleHints={toggleHints}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          <PatternCanvas
            state={state}
            dispatch={dispatch}
            actualSize={actualSize}
            pxPerMm={calibration.pxPerMm}
          />
          <DimensionPanel state={state} dispatch={dispatch} />
          {showHints && <HintOverlay state={state} />}
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
