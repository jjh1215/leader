import { useState } from 'react'
import Button from '../ui/Button.jsx'

const BAR_PX = 300

function CalibrationModal({ onClose, onCalibrate }) {
  const [measuredMm, setMeasuredMm] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const mm = Number(measuredMm)
    if (mm > 0) {
      onCalibrate(BAR_PX / mm)
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
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 8, maxWidth: 420, fontFamily: 'sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>화면 보정</h2>
        <p>
          모니터마다 화면 배율이 달라서, 브라우저가 계산한 "1mm"는 실제 물리적 mm와 다른 경우가 많습니다.
          실제 자로 재서 이 화면을 보정해두면, "실물 크기로 보기"에서 자를 대고 정확한 치수를 확인할 수 있습니다.
        </p>
        <p>
          아래 막대에 <strong>실제 자</strong>를 대고 길이를 측정해서 mm 단위로 입력해주세요.
        </p>
        <div style={{ width: BAR_PX, height: 12, background: '#e0781e', margin: '1rem 0' }} />
        <form onSubmit={handleSubmit}>
          <label>
            측정한 길이 (mm):{' '}
            <input
              type="number"
              step="0.1"
              min="1"
              value={measuredMm}
              onChange={(e) => setMeasuredMm(e.target.value)}
              autoFocus
            />
          </label>
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
