import { useCallback, useState } from 'react'

const STORAGE_KEY = 'leader:screenCalibration'
// CSS reference-pixel guess (96dpi) used only until the user calibrates against
// their actual monitor -- this is usually wrong for real physical mm.
const DEFAULT_PX_PER_MM = 96 / 25.4

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.pxPerMm > 0 ? parsed.pxPerMm : null
  } catch {
    return null
  }
}

// Per-device screen calibration (mm <-> CSS px), stored in localStorage only --
// it is specific to this monitor/OS scaling combo and must never sync across
// devices or be treated as document data.
export function useScreenCalibration() {
  const [pxPerMm, setPxPerMmState] = useState(() => readStored() ?? DEFAULT_PX_PER_MM)
  const [calibrated, setCalibrated] = useState(() => readStored() !== null)

  const setPxPerMm = useCallback((value) => {
    setPxPerMmState(value)
    setCalibrated(true)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pxPerMm: value }))
    } catch {
      // localStorage unavailable (private mode etc.) -- calibration still
      // works for this page load, just won't persist across reloads.
    }
  }, [])

  const reset = useCallback(() => {
    setPxPerMmState(DEFAULT_PX_PER_MM)
    setCalibrated(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return { pxPerMm, calibrated, setPxPerMm, reset }
}
