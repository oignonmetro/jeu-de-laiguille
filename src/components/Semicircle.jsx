import { useCallback, useRef } from 'react'
import { angleFromPointer, pointOnArc } from '../utils/angle'
import './Semicircle.css'

const CX = 100
const CY = 100
const NEEDLE_LENGTH = 78

export function Semicircle({
  spectrum,
  mode = 'display',
  angle = 90,
  onChange,
  resultAngle,
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

  const needle = pointOnArc(CX, CY, NEEDLE_LENGTH, angle)
  const resultNeedle =
    resultAngle != null ? pointOnArc(CX, CY, NEEDLE_LENGTH, resultAngle) : null

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

        {resultNeedle && (
          <line
            x1={CX}
            y1={CY}
            x2={resultNeedle.x}
            y2={resultNeedle.y}
            className="semicircle__needle semicircle__needle--actual"
          />
        )}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          className={`semicircle__needle semicircle__needle--${
            mode === 'result' ? 'guess' : 'main'
          }`}
        />
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
        <div className="semicircle__score">+{score} points pour l&apos;équipe</div>
      )}
    </div>
  )
}
