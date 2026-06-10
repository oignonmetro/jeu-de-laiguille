import { useCallback, useRef } from 'react'
import { angleFromPointer, pointOnArc } from '../utils/angle'
import { PALETTE_ZONES } from '../game/logic'
import './Semicircle.css'

const CX = 100
const CY = 100
const R = 92
const NEEDLE_LENGTH = 78
const ZONE_LABEL_RADIUS = 82

function zonePath(fromAngle, toAngle) {
  const outer = pointOnArc(CX, CY, R, toAngle)
  const inner = pointOnArc(CX, CY, R, fromAngle)
  return `M ${CX} ${CY} L ${outer.x} ${outer.y} A ${R} ${R} 0 0 1 ${inner.x} ${inner.y} Z`
}

export function Semicircle({
  spectrum,
  mode = 'display',
  angle = 90,
  onChange,
  targetAngle,
  score,
}) {
  const svgRef = useRef(null)
  const draggingRef = useRef(false)

  const updateFromEvent = useCallback(
    (event) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / rect.width) * 200
      const py = ((event.clientY - rect.top) / rect.height) * 110
      const newAngle = angleFromPointer(CX, CY, px, py)
      onChange?.(Math.round(newAngle))
    },
    [onChange]
  )

  const handlePointerDown = (event) => {
    if (mode !== 'drag') return
    draggingRef.current = true
    event.target.setPointerCapture(event.pointerId)
    updateFromEvent(event)
  }

  const handlePointerMove = (event) => {
    if (mode !== 'drag' || !draggingRef.current) return
    updateFromEvent(event)
  }

  const handlePointerUp = () => {
    draggingRef.current = false
  }

  // La palette remplace l'aiguille "position réelle" : pas d'aiguille en
  // affichage simple quand on montre la palette (phase d'écriture d'indice).
  const showNeedle = !(mode === 'display' && targetAngle != null)
  const needle = pointOnArc(CX, CY, NEEDLE_LENGTH, angle)

  return (
    <div className="semicircle">
      <svg
        ref={svgRef}
        viewBox="0 0 200 110"
        className={`semicircle__svg semicircle__svg--${mode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <path d="M 8 100 A 92 92 0 0 1 192 100" className="semicircle__arc" />
        <line x1="8" y1="100" x2="192" y2="100" className="semicircle__base" />

        {targetAngle != null &&
          PALETTE_ZONES.map((zone) => {
            const labelAngle = targetAngle + (zone.from + zone.to) / 2
            const labelPos = pointOnArc(CX, CY, ZONE_LABEL_RADIUS, labelAngle)
            return (
              <g key={zone.from}>
                <path
                  d={zonePath(targetAngle + zone.from, targetAngle + zone.to)}
                  className={`semicircle__zone semicircle__zone--${zone.points}`}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  className="semicircle__zone-label"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${90 - labelAngle} ${labelPos.x} ${labelPos.y})`}
                >
                  {zone.points}
                </text>
              </g>
            )
          })}

        {showNeedle && (
          <line
            x1={CX}
            y1={CY}
            x2={needle.x}
            y2={needle.y}
            className={`semicircle__needle semicircle__needle--${
              mode === 'result' ? 'guess' : 'main'
            }`}
          />
        )}
        {mode === 'drag' && (
          <circle cx={needle.x} cy={needle.y} r="9" className="semicircle__handle" />
        )}
        <circle cx={CX} cy={CY} r="4" className="semicircle__pivot" />
      </svg>

      <div className="semicircle__labels">
        <span className="semicircle__label semicircle__label--left">{spectrum.left}</span>
        <span className="semicircle__label semicircle__label--right">{spectrum.right}</span>
      </div>

      {mode === 'result' && score != null && (
        <div className={`semicircle__score${score === 0 ? ' semicircle__score--zero' : ''}`}>
          {score === 0 ? "Aucun point pour l'équipe" : `+${score} points pour l'équipe`}
        </div>
      )}
    </div>
  )
}
