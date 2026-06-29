import { useEffect, useRef, useState } from 'react'

// Variante de useSmoothAngle pour plusieurs aiguilles suivies en même temps
// (mode « Chacun pour soi » : l'auteur de l'indice voit bouger en direct
// l'aiguille de chaque devineur). `targets` est un objet { id: angle } ; on
// lisse chaque angle vers sa cible avec le même lissage exponentiel,
// indépendant du framerate, que pour une aiguille unique.
export function useSmoothAngles(targets, tauMs = 80) {
  const [angles, setAngles] = useState(() => ({ ...targets }))
  const anglesRef = useRef(angles)
  const targetsRef = useRef(targets)
  const frameRef = useRef(0)

  // Toujours animer vers les cibles les plus récentes, sans relancer la boucle
  // à chaque rendu.
  useEffect(() => {
    targetsRef.current = targets
  })

  // Clé stable : ne relance l'animation que lorsqu'une cible change vraiment.
  const key = Object.keys(targets)
    .sort()
    .map((id) => `${id}:${targets[id]}`)
    .join('|')

  useEffect(() => {
    let last = 0

    const tick = (now) => {
      if (!last) last = now
      const dt = now - last
      last = now

      const k = 1 - Math.exp(-dt / tauMs)
      const current = anglesRef.current
      const t = targetsRef.current
      const next = {}
      let moving = false
      // On ne conserve que les aiguilles encore présentes dans les cibles.
      for (const id of Object.keys(t)) {
        const prev = current[id] ?? t[id]
        const diff = t[id] - prev
        if (Math.abs(diff) < 0.1) {
          next[id] = t[id]
        } else {
          next[id] = prev + diff * k
          moving = true
        }
      }

      anglesRef.current = next
      setAngles(next)
      if (moving) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [key, tauMs])

  return angles
}
