import { useEffect, useRef, useState } from 'react'
import { pointOnArc } from '../utils/angle'
import { GAUGE_ZONES as ZONES } from './gaugeZones'
import './ScoreGauge.css'

const CX = 100
const CY = 100
const R = 86
const ACTIVE_R = 94
const NEEDLE_LENGTH = 56
const LABEL_RADIUS = 70

function zonePath(fromAngle, toAngle, r) {
  const outer = pointOnArc(CX, CY, r, toAngle)
  const inner = pointOnArc(CX, CY, r, fromAngle)
  return `M ${CX} ${CY} L ${outer.x} ${outer.y} A ${r} ${r} 0 0 1 ${inner.x} ${inner.y} Z`
}

// Jauge du score final : l'aiguille va de 0 point (extrême gauche)
// à maxScore points (extrême droite). L'aiguille balaie progressivement
// vers sa nouvelle position chaque fois que le score change, pour la
// cinématique de fin de partie.
export function ScoreGauge({ score, maxScore, sweepDurationMs = 600 }) {
  const targetRatio = maxScore > 0 ? Math.max(0, Math.min(1, score / maxScore)) : 0
  const targetAngle = 180 - targetRatio * 180

  // Part de 0 point (extrême gauche) au montage, puis balaie vers le score.
  const [angle, setAngle] = useState(180)
  const angleRef = useRef(180)

  useEffect(() => {
    const start = angleRef.current
    const delta = targetAngle - start
    if (delta === 0) return undefined

    const startTime = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / sweepDurationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = start + delta * eased
      angleRef.current = next
      setAngle(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [targetAngle, sweepDurationMs])

  const ratio = 1 - angle / 180
  const activeIndex = Math.min(ZONES.length - 1, Math.max(0, Math.floor(ratio * ZONES.length)))
  const needle = pointOnArc(CX, CY, NEEDLE_LENGTH, angle)
  const step = 180 / ZONES.length

  return (
    <svg viewBox="0 0 200 115" className="score-gauge">
      {ZONES.map((zone, i) => {
        const active = i === activeIndex
        const from = 180 - (i + 1) * step
        const to = 180 - i * step
        const labelAngle = (from + to) / 2
        const labelPos = pointOnArc(CX, CY, active ? LABEL_RADIUS + 8 : LABEL_RADIUS, labelAngle)
        return (
          <g key={zone.label}>
            <path
              d={zonePath(from, to, active ? ACTIVE_R : R)}
              fill={zone.color}
              className={active ? 'score-gauge__zone--active' : undefined}
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              className={`score-gauge__label${active ? ' score-gauge__label--active' : ''}`}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${90 - labelAngle} ${labelPos.x} ${labelPos.y})`}
            >
              {zone.label}
            </text>
          </g>
        )
      })}

      <line
        x1={CX}
        y1={CY}
        x2={needle.x}
        y2={needle.y}
        className="score-gauge__needle"
      />
      <circle cx={CX} cy={CY} r="13" className="score-gauge__pivot" />

      <text x="10" y="109" className="score-gauge__bound" textAnchor="start">
        0
      </text>
      <text x="190" y="109" className="score-gauge__bound" textAnchor="end">
        {maxScore}
      </text>
    </svg>
  )
}
