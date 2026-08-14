// Stitch pattern presets (StitchPatternManager) live inside each pattern's
// own saved document, so they don't carry over to a brand new pattern --
// you'd have to redefine "기본 스티치" every time. This mirrors them into
// localStorage (like screen calibration) purely as a seed for new patterns;
// it never overwrites an existing pattern's own preset list.
const STORAGE_KEY = 'leader:stitchPatternPresets'

export function readStoredPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeStoredPresets(defs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defs))
  } catch {
    // localStorage unavailable (private mode etc.) -- presets still work
    // for this session, just won't seed the next new pattern.
  }
}
