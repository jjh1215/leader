import { useRef, useState } from 'react'
import Button from '../ui/Button.jsx'

const MIN_BAR_PX = 40
const DEFAULT_BAR_PX = 300
const DEFAULT_TARGET_MM = 100
const NUDGE_PX = 1
const FAST_NUDGE_PX = 10

// Drag the bar's right-edge handle (or use arrow keys) until the bar's
// on-screen length exactly matches a real object held against the screen
// (a ruler's 100mm mark, a card, whatever is on hand), then confirm that
// object's actual length. Replaces the earlier "read a fixed 300px bar off
// a ruler and type the mm you saw" flow -- eyeballing which fine mm tick a
// bar's edge lines up with (especially through any ruler-to-screen parallax)
// is what was producing calibration errors far larger than the sub-mm
// precision this is supposed to have; aligning two edges by eye/drag is much
// more precise than reading a graduated scale by eye.
function CalibrationModal({ onClose, onCalibrate }) {
  const [barPx, setBarPx] = useState(DEFAULT_BAR_PX)
  const [targetMm, setTargetMm] = useState(DEFAULT_TARGET_MM)
  const barPxRef = useRef(barPx)
  barPxRef.current = barPx

  function handleDragStart(e) {
    e.preventDefault()
    const startX = e.clientX
    const startBarPx = barPxRef.current

    function handleMove(moveEvent) {
      setBarPx(Math.max(MIN_BAR_PX, startBarPx + (moveEvent.clientX - startX)))
    }
    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function handleHandleKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const step = e.shiftKey ? FAST_NUDGE_PX : NUDGE_PX
      const delta = e.key === 'ArrowRight' ? step : -step
      setBarPx((v) => Math.max(MIN_BAR_PX, v + delta))
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const mm = Number(targetMm)
    if (mm > 0 && barPx > 0) {
      onCalibrate(barPx / mm)
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 8, maxWidth: 560, fontFamily: 'sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>화면 보정</h2>
        <p>
          모니터마다 화면 배율이 달라서, 브라우저가 계산한 "1mm"는 실제 물리적 mm와 다른 경우가 많습니다.
          아래 막대 오른쪽 끝의 <strong>파란 손잡이를 드래그</strong>하거나 <strong>좌우 화살표 키</strong>로
          (Shift=10px씩) 조절해서, 화면에 대고 있는 자나 카드 등 실제 물건의 길이에 막대 길이를 정확히 맞춰주세요.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            맞춘 물건의 실제 길이 (mm):{' '}
            <input
              type="number"
              step="0.1"
              min="1"
              value={targetMm}
              onChange={(e) => setTargetMm(e.target.value)}
            />
          </label>

          <div style={{ marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ position: 'relative', width: barPx, height: 12, background: '#e0781e' }}>
              <div
                onPointerDown={handleDragStart}
                onKeyDown={handleHandleKeyDown}
                tabIndex={0}
                role="slider"
                aria-label="막대 길이"
                aria-valuenow={barPx}
                aria-valuemin={MIN_BAR_PX}
                title="드래그하거나 화살표 키로 길이 조절 (Shift=10px씩)"
                style={{
                  position: 'absolute',
                  right: -9,
                  top: -6,
                  width: 18,
                  height: 24,
                  background: '#1e6fe0',
                  borderRadius: 4,
                  cursor: 'ew-resize',
                  touchAction: 'none',
                }}
              />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>막대 길이: {barPx}px</p>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button type="button" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" variant="primary" icon="📐">
              저장
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CalibrationModal
