import { pointOnArc } from '../utils/angle'
import './ScoreGauge.css'

const CX = 100
const CY = 100
const R = 86
const ACTIVE_R = 94
const NEEDLE_LENGTH = 56
const LABEL_RADIUS = 70

// Zones qualitatives de la jauge, de la pire (à gauche) à la meilleure
// (à droite), comme sur un cadran de score.
const ZONES = [
  { label: 'Aïe', color: '#e07856' },
  { label: 'OK', color: '#d9a542' },
  { label: 'Pas mal.', color: '#e3a6ab' },
  { label: 'Bien', color: '#f0c9ce' },
  { label: 'Super', color: '#cfe3c0' },
  { label: 'Waouh !', color: '#b5d9a8' },
]

function zonePath(fromAngle, toAngle, r) {
  const outer = pointOnArc(CX, CY, r, toAngle)
  const inner = pointOnArc(CX, CY, r, fromAngle)
  return `M ${CX} ${CY} L ${outer.x} ${outer.y} A ${r} ${r} 0 0 1 ${inner.x} ${inner.y} Z`
}

// Jauge du score final : l'aiguille va de 0 point (extrême gauche)
// à maxScore points (extrême droite).
export function ScoreGauge({ score, maxScore }) {
  const ratio = maxScore > 0 ? Math.max(0, Math.min(1, score / maxScore)) : 0
  const needleAngle = 180 - ratio * 180
  const activeIndex = Math.min(ZONES.length - 1, Math.floor(ratio * ZONES.length))
  const needle = pointOnArc(CX, CY, NEEDLE_LENGTH, needleAngle)
  const step = 180 / ZONES.length

  return (
    <svg viewBox="0 0 200 112" className="score-gauge">
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
      <circle cx={CX} cy={CY} r="11" className="score-gauge__pivot" />

      <text x="10" y="109" className="score-gauge__bound" textAnchor="start">
        0
      </text>
      <text x="190" y="109" className="score-gauge__bound" textAnchor="end">
        {maxScore}
      </text>
    </svg>
  )
}
