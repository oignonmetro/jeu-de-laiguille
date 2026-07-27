import { useEffect, useState } from 'react'
import { loadPhoto } from '../game/photoApi'
import './CluePhoto.css'

// Photo jointe à un indice. Chargée à la demande (les photos ne transitent pas
// dans le nœud de la salle, cf. photoApi) et mise en cache par photoApi, donc
// réafficher la même photo d'un écran à l'autre ne recoûte rien.
export function CluePhoto({ roomCode, playerId, roundIndex, hasPhoto }) {
  // L'état porte la photo à laquelle il correspond : tant qu'il ne désigne pas
  // celle demandée, on affiche le chargement. Évite d'avoir à réinitialiser
  // l'état (et donc de déclencher un rendu) au moment où la photo change.
  const key = `${roomCode}/${playerId}/${roundIndex}`
  const [state, setState] = useState({ key: null, src: null, failed: false })
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!hasPhoto) return undefined
    let cancelled = false
    loadPhoto(roomCode, playerId, roundIndex)
      .then((src) => {
        if (!cancelled) setState({ key, src, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ key, src: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [roomCode, playerId, roundIndex, hasPhoto, key])

  if (!hasPhoto) return null

  const loaded = state.key === key
  if (loaded && state.failed) {
    return <p className="text-muted clue-photo__error">Photo indisponible.</p>
  }
  if (!loaded || !state.src) {
    return <div className="clue-photo clue-photo--loading" aria-label="Chargement de la photo" />
  }

  return (
    <>
      <button
        type="button"
        className="clue-photo"
        onClick={() => setZoomed(true)}
        aria-label="Agrandir la photo"
      >
        <img src={state.src} alt="Photo de l'indice" />
      </button>

      {zoomed && (
        <div className="clue-photo__overlay" onClick={() => setZoomed(false)} role="presentation">
          <img src={state.src} alt="Photo de l'indice" />
        </div>
      )}
    </>
  )
}
