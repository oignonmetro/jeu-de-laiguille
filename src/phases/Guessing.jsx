import { useEffect, useRef, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { useSmoothAngle } from '../hooks/useSmoothAngle'
import {
  setLiveAngle,
  submitTurnGuess,
  advanceTurn,
  setConsensusAngle,
  agreeOnConsensus,
  finalizeConsensus,
} from '../game/roomApi'

const LIVE_THROTTLE_MS = 100

export function Guessing({ roomCode, room, playerId }) {
  const turnIndex = room.currentTurn ?? 0
  const turn = room.turns?.[turnIndex]
  if (!turn) return null

  const Turn = room.guessMode === 'consensus' ? ConsensusGuessingTurn : GuessingTurn

  // key={turnIndex} : remet l'état local (angle, etc.) à zéro à chaque tour.
  return (
    <Turn
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
            targetAngle={entry.actualAngle}
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
        <LiveSemicircle spectrum={spectrum} liveAngle={room.liveAngle ?? 90} />
      </div>
    </div>
  )
}

// Aiguille suivie en direct par les spectateurs : on lisse l'angle reçu du
// réseau pour une rotation continue plutôt que des sauts saccadés.
function LiveSemicircle({ spectrum, liveAngle }) {
  const smoothAngle = useSmoothAngle(liveAngle)
  return <Semicircle spectrum={spectrum} mode="display" angle={smoothAngle} />
}

// Mode "Consensus" : tous les joueurs sauf l'auteur de l'indice partagent la
// même aiguille et doivent tous donner leur accord avant validation.
function ConsensusGuessingTurn({ roomCode, room, playerId, turnIndex, turn }) {
  const round = room.rounds[turn.sourceId][turn.roundIndex]
  const spectrum = room.pack.spectra[round.spectrumIndex]
  const sourceName = room.players[turn.sourceId].name
  const isSource = playerId === turn.sourceId
  const isReveal = room.turnPhase === 'reveal'
  const isLastTurn = turnIndex === room.turns.length - 1
  const progress = `Tour ${turnIndex + 1} / ${room.turns.length}`
  const others = room.order.filter((id) => id !== turn.sourceId)
  const agreements = room.consensusAgreements || {}
  const agreedCount = others.filter((id) => agreements[id]).length
  const allAgreed = others.length > 0 && others.every((id) => agreements[id])

  const [busy, setBusy] = useState(false)

  // Dès que tout le monde a donné son accord, n'importe quel client valide
  // le tour : le résultat est déterministe, donc des appels concurrents
  // convergent vers le même état.
  useEffect(() => {
    if (room.turnPhase !== 'guessing' || !allAgreed) return
    finalizeConsensus(roomCode, {
      sourceId: turn.sourceId,
      roundIndex: turn.roundIndex,
      needleAngle: round.needleAngle,
      guessedAngle: room.liveAngle ?? 90,
      spectrumIndex: round.spectrumIndex,
      clue: round.clue,
      currentScore: room.score,
    }).catch(() => {})
  }, [
    roomCode,
    turn.sourceId,
    turn.roundIndex,
    round.needleAngle,
    round.spectrumIndex,
    round.clue,
    room.turnPhase,
    room.liveAngle,
    room.score,
    allAgreed,
  ])

  const handleNextTurn = async () => {
    setBusy(true)
    try {
      await advanceTurn(roomCode, turnIndex)
    } finally {
      setBusy(false)
    }
  }

  if (isReveal) {
    const entry = room.results?.[turn.sourceId]?.[turn.roundIndex]
    if (!entry) return null
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Résultat</h1>
          <span className="progress-pill">{progress}</span>
        </header>

        <div className="card">
          <p className="text-muted">Indice de {sourceName} :</p>
          <p className="clue-text">{entry.clue}</p>
          <Semicircle
            spectrum={spectrum}
            mode="result"
            angle={entry.guessedAngle}
            targetAngle={entry.actualAngle}
            score={entry.score}
          />
        </div>

        <button className="btn" onClick={handleNextTurn} disabled={busy}>
          {isLastTurn ? 'Voir les résultats' : 'Tour suivant'}
        </button>
      </div>
    )
  }

  if (isSource) {
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Les autres devinent ton indice</h1>
          <span className="progress-pill">{progress}</span>
        </header>

        <div className="card">
          <p className="text-muted">Ton indice :</p>
          <p className="clue-text">{round.clue}</p>
          <LiveSemicircle spectrum={spectrum} liveAngle={room.liveAngle ?? 90} />
        </div>

        <div className="card">
          <p className="text-muted">
            {agreedCount} / {others.length} joueurs d&apos;accord
          </p>
          <ul className="player-list">
            {others.map((id) => (
              <li key={id}>
                {room.players[id].name} {agreements[id] ? '✅' : '⏳'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <ConsensusGuesser
      roomCode={roomCode}
      room={room}
      playerId={playerId}
      round={round}
      spectrum={spectrum}
      sourceName={sourceName}
      others={others}
      agreements={agreements}
      agreedCount={agreedCount}
      progress={progress}
    />
  )
}

// Aiguille partagée, déplaçable par n'importe quel joueur autre que l'auteur
// de l'indice : suit la position locale pendant qu'on la fait glisser, et la
// position diffusée par le réseau le reste du temps.
function ConsensusGuesser({
  roomCode,
  room,
  playerId,
  round,
  spectrum,
  sourceName,
  others,
  agreements,
  agreedCount,
  progress,
}) {
  const [angle, setAngle] = useState(room.liveAngle ?? 90)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const lastSentRef = useRef(0)
  const pendingRef = useRef(null)
  const latestAngleRef = useRef(angle)
  const smoothAngle = useSmoothAngle(room.liveAngle ?? 90)

  useEffect(() => () => clearTimeout(pendingRef.current), [])

  const displayAngle = dragging ? angle : smoothAngle
  const iAgreed = Boolean(agreements[playerId])

  // Envoie immédiatement une écriture de position encore en attente. Comme
  // setConsensusAngle réinitialise les accords, on l'appelle dès la fin du
  // glissement et avant de donner son accord, pour éviter qu'une remise à
  // zéro différée n'efface l'accord d'un autre joueur donné juste après.
  const flushPending = () => {
    if (!pendingRef.current) return Promise.resolve()
    clearTimeout(pendingRef.current)
    pendingRef.current = null
    lastSentRef.current = Date.now()
    return setConsensusAngle(roomCode, latestAngleRef.current).catch(() => {})
  }

  const handleDrag = (newAngle) => {
    setAngle(newAngle)
    latestAngleRef.current = newAngle
    const now = Date.now()
    if (now - lastSentRef.current >= LIVE_THROTTLE_MS) {
      lastSentRef.current = now
      setConsensusAngle(roomCode, newAngle).catch(() => {})
    } else {
      clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null
        lastSentRef.current = Date.now()
        setConsensusAngle(roomCode, newAngle).catch(() => {})
      }, LIVE_THROTTLE_MS)
    }
  }

  const handlePointerEnd = () => {
    setDragging(false)
    flushPending()
  }

  const handleAgree = async () => {
    setBusy(true)
    try {
      await flushPending()
      await agreeOnConsensus(roomCode, playerId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Mettez-vous d&apos;accord !</h1>
        <span className="progress-pill">{progress}</span>
      </header>

      <div className="card">
        <p className="text-muted">Indice de {sourceName} :</p>
        <p className="clue-text">{round.clue}</p>
        <div
          onPointerDown={() => setDragging(true)}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <Semicircle spectrum={spectrum} mode="drag" angle={displayAngle} onChange={handleDrag} />
        </div>
      </div>

      <div className="card">
        <p className="text-muted">
          {agreedCount} / {others.length} joueurs d&apos;accord
        </p>
        <ul className="player-list">
          {others.map((id) => (
            <li key={id}>
              {room.players[id].name}
              {id === playerId ? ' (toi)' : ''} {agreements[id] ? '✅' : '⏳'}
            </li>
          ))}
        </ul>
      </div>

      <button className="btn" onClick={handleAgree} disabled={busy || iAgreed}>
        {iAgreed ? 'En attente des autres...' : "Je suis d'accord"}
      </button>
    </div>
  )
}
