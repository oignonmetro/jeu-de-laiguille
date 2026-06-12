import { useEffect, useRef, useState } from 'react'

// Compteur animé : part de 0 au montage puis monte (ou descend) vers chaque
// nouvelle valeur cible avec le même easing que l'aiguille de la jauge,
// pour que le chiffre et l'aiguille bougent en synchro.
export function useCountUp(target, durationMs = 600) {
  const [value, setValue] = useState(0)
  const valueRef = useRef(0)

  useEffect(() => {
    const start = valueRef.current
    const delta = target - start
    if (delta === 0) return undefined

    const startTime = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = start + delta * eased
      valueRef.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return Math.round(value)
}
