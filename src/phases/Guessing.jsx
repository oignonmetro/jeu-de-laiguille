import { useEffect, useRef, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { setLiveAngle, submitTurnGuess, advanceTurn } from '../game/roomApi'

const LIVE_THROTTLE_MS = 100

export function Guessing({ roomCode, room, playerId }) {
  const turnIndex = room.currentTurn ?? 0
  const turn = room.turns?.[turnIndex]
  if (!turn) return null

  // key={turnIndex} : remet l'état local (angle, etc.) à zéro à chaque tour.
  return (
    <GuessingTurn
      key={turnIndex}
      roomCode={roomCode}
      room={room}
      playerId={playerId}
      turnIndex={turnIndex}
      turn={turn}
    />
  )
}

function GuessingTurn({ roomCode, room, playerId, turnIndex, turn }) {
  const round = room.rounds[turn.sourceId][turn.roundIndex]
  const spectrum = room.pack.spectra[round.spectrumIndex]
  const guesserName = room.players[turn.guesserId].name
  const sourceName = room.players[turn.sourceId].name
  const isGuesser = playerId === turn.guesserId
  const isSource = playerId === turn.sourceId
  const isReveal = room.turnPhase === 'reveal'
  const isLastTurn = turnIndex === room.turns.length - 1
  const progress = `Tour ${turnIndex + 1} / ${room.turns.length}`

  const [angle, setAngle] = useState(room.liveAngle ?? 90)
  const [busy, setBusy] = useState(false)
  const lastSentRef = useRef(0)
  const pendingRef = useRef(null)

  useEffect(() => () => clearTimeout(pendingRef.current), [])

  // Diffuse la position de l'aiguille en direct, au plus une écriture
  // toutes les LIVE_THROTTLE_MS (avec un envoi final différé pour que la
  // dernière position soit toujours transmise).
  const handleDrag = (newAngle) => {
    setAngle(newAngle)
    const now = Date.now()
    if (now - lastSentRef.current >= LIVE_THROTTLE_MS) {
      lastSentRef.current = now
      setLiveAngle(roomCode, newAngle).catch(() => {})
    } else {
      clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(() => {
        lastSentRef.current = Date.now()
        setLiveAngle(roomCode, newAngle).catch(() => {})
      }, LIVE_THROTTLE_MS)
    }
  }

  const handleValidate = async () => {
    setBusy(true)
    try {
      clearTimeout(pendingRef.current)
      await submitTurnGuess(roomCode, turnIndex, angle)
    } finally {
      setBusy(false)
    }
  }

  const handleNextTurn = async () => {
    setBusy(true)
    try {
      await advanceTurn(roomCode, turnIndex)
    } finally {
      setBusy(false)
    }
  }

  if (isReveal) {
    const entry = room.results?.[turn.guesserId]?.[turn.roundIndex]
    if (!entry) return null
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Résultat</h1>
          <span className="progress-pill">{progress}</span>
        </header>

        <div className="card">
          <p className="text-muted">
            {sourceName} ➜ {guesserName}
          </p>
          <p className="clue-text">{entry.clue}</p>
          <Semicircle
            spectrum={spectrum}
            mode="result"
            angle={entry.guessedAngle}
            resultAngle={entry.actualAngle}
            score={entry.score}
          />
        </div>

        {isGuesser ? (
          <button className="btn" onClick={handleNextTurn} disabled={busy}>
            {isLastTurn ? 'Voir les résultats' : 'Tour suivant'}
          </button>
        ) : (
          <p className="text-muted text-center">
            En attente que {guesserName} passe à la suite...
          </p>
        )}
      </div>
    )
  }

  if (isGuesser) {
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">À toi de deviner !</h1>
          <span className="progress-pill">{progress}</span>
        </header>

        <div className="card">
          <p className="text-muted">Indice de {sourceName} :</p>
          <p className="clue-text">{round.clue}</p>
          <Semicircle spectrum={spectrum} mode="drag" angle={angle} onChange={handleDrag} />
        </div>

        <button className="btn" onClick={handleValidate} disabled={busy}>
          Valider ma réponse
        </button>
      </div>
    )
  }

  // Spectateur (dont l'auteur de l'indice) : on suit l'aiguille en direct.
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          {isSource ? `${guesserName} devine ton indice` : `Au tour de ${guesserName}`}
        </h1>
        <span className="progress-pill">{progress}</span>
      </header>

      <div className="card">
        <p className="text-muted">Indice de {sourceName} :</p>
        <p className="clue-text">{round.clue}</p>
        <Semicircle spectrum={spectrum} mode="display" angle={room.liveAngle ?? 90} />
      </div>
    </div>
  )
}
