import React from 'react'

export default function MandalaBackground() {
  const mandala = (
    <svg width="320" height="320" viewBox="0 0 300 300" fill="none" opacity="0.15">
      {[40, 60, 80, 100, 120, 140].map((r) => (
        <circle key={r} cx="150" cy="150" r={r} stroke="#FFF" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((angle) => {
        const rad = (angle * Math.PI) / 180
        return (
          <line
            key={angle}
            x1={150 + 35 * Math.cos(rad)} y1={150 + 35 * Math.sin(rad)}
            x2={150 + 140 * Math.cos(rad)} y2={150 + 140 * Math.sin(rad)}
            stroke="#FFF" strokeWidth="0.4"
          />
        )
      })}
      {Array.from({ length: 8 }, (_, i) => i * 45).map((angle) => {
        const rad = (angle * Math.PI) / 180
        const r1 = 90, r2 = 115
        const a1 = ((angle - 12) * Math.PI) / 180
        const a2 = ((angle + 12) * Math.PI) / 180
        return (
          <path
            key={`petal-${angle}`}
            d={`M 150 150 Q ${150 + r1 * Math.cos(a1)} ${150 + r1 * Math.sin(a1)} ${150 + r2 * Math.cos(rad)} ${150 + r2 * Math.sin(rad)} Q ${150 + r1 * Math.cos(a2)} ${150 + r1 * Math.sin(a2)} 150 150`}
            fill="none" stroke="#FFF" strokeWidth="0.4"
          />
        )
      })}
    </svg>
  )

  return (
    <>
      <div className="fixed left-[-80px] top-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-60" style={{ animation: 'compass-rotate 120s linear infinite' }}>
        {mandala}
      </div>
      <div className="fixed right-[-80px] top-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-60" style={{ transform: 'translateY(-50%) scaleX(-1)', animation: 'compass-rotate 120s linear infinite reverse' }}>
        {mandala}
      </div>
    </>
  )
}
