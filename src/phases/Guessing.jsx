import { useEffect, useRef, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { AppHeader } from '../components/SettingsMenu'
import { useSmoothAngle } from '../hooks/useSmoothAngle'
import { useSmoothAngles } from '../hooks/useSmoothAngles'
import { playerColor } from '../game/colors'
import { effectiveGuessMode } from '../game/logic'
import {
  submitIndividualGuess,
  setIndividualLiveAngle,
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

  const Turn =
    effectiveGuessMode(room) === 'individual' ? IndividualGuessingTurn : ConsensusGuessingTurn

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

// Mode « Chacun pour soi » : tous les joueurs sauf l'auteur de l'indice placent
// leur propre aiguille, chacun sur son écran et en même temps. Quand tout le
// monde a répondu, on révèle toutes les aiguilles et les points (chaque
// devineur marque les siens, l'auteur récupère la somme).
function IndividualGuessingTurn({ roomCode, room, playerId, turnIndex, turn }) {
  const round = room.rounds[turn.sourceId][turn.roundIndex]
  const spectrum = room.pack.spectra[round.spectrumIndex]
  const sourceName = room.players[turn.sourceId].name
  const isAuthor = playerId === turn.sourceId
  const isReveal = room.turnPhase === 'reveal'
  const isLastTurn = turnIndex === room.turns.length - 1
  const progress = `Tour ${turnIndex + 1} / ${room.turns.length}`
  const guessers = room.order.filter((id) => id !== turn.sourceId)
  const guesses = room.guesses || {}
  const answered = guessers.filter((id) => guesses[id] != null).length

  const [busy, setBusy] = useState(false)

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
    const needles = guessers
      .filter((id) => entry.guesses?.[id])
      .map((id) => ({ angle: entry.guesses[id].guessedAngle, color: playerColor(room.order, id) }))
    return (
      <div className="app">
        <AppHeader>
          <h1 className="app__title">Résultat</h1>
          <span className="progress-pill">{progress}</span>
        </AppHeader>

        <div className="card">
          <p className="text-muted">Indice de {sourceName} :</p>
          <p className="clue-text">{entry.clue}</p>
          <Semicircle
            spectrum={spectrum}
            mode="result"
            targetAngle={entry.actualAngle}
            needles={needles}
          />
        </div>

        <div className="card">
          <ul className="player-list">
            {guessers.map((id) => (
              <li key={id} className="score-row">
                <span className="score-row__name">
                  <span className="score-dot" style={{ background: playerColor(room.order, id) }} />
                  {room.players[id].name}
                  {id === playerId ? ' (toi)' : ''}
                </span>
                <span>+{entry.guesses?.[id]?.score ?? 0}</span>
              </li>
            ))}
            <li className="score-row score-row--author">
              <span className="score-row__name">{sourceName} · indice</span>
              <span>+{entry.authorScore}</span>
            </li>
          </ul>
        </div>

        <button className="btn" onClick={handleNextTurn} disabled={busy}>
          {isLastTurn ? 'Voir le classement' : 'Tour suivant'}
        </button>
      </div>
    )
  }

  // L'auteur de l'indice patiente, mais voit les aiguilles des devineurs bouger
  // en direct (chacune à sa couleur).
  if (isAuthor) {
    return (
      <IndividualAuthorWaiting
        room={room}
        round={round}
        spectrum={spectrum}
        progress={progress}
        guessers={guessers}
        guesses={guesses}
        answered={answered}
      />
    )
  }

  // Devineur : place son aiguille (diffusée en direct), puis attend les autres.
  return (
    <IndividualGuesser
      roomCode={roomCode}
      playerId={playerId}
      turnIndex={turnIndex}
      round={round}
      spectrum={spectrum}
      sourceName={sourceName}
      progress={progress}
      guessers={guessers}
      guesses={guesses}
      answered={answered}
    />
  )
}

// Vue de l'auteur pendant que les autres devinent : ses aiguilles bougent en
// temps réel, lissées, et figées sur la position validée dès qu'un joueur a
// répondu. La palette (position réelle) est affichée — l'auteur connaît déjà
// la réponse puisque c'est son indice.
function IndividualAuthorWaiting({ room, round, spectrum, progress, guessers, guesses, answered }) {
  const targets = {}
  guessers.forEach((id) => {
    targets[id] = guesses[id] != null ? guesses[id] : (room.liveAngles?.[id] ?? 90)
  })
  const smoothed = useSmoothAngles(targets)
  const needles = guessers.map((id) => ({
    angle: smoothed[id] ?? 90,
    color: playerColor(room.order, id),
  }))

  return (
    <div className="app">
      <AppHeader>
        <h1 className="app__title">Les autres devinent ton indice</h1>
        <span className="progress-pill">{progress}</span>
      </AppHeader>

      <div className="card">
        <p className="text-muted">Ton indice :</p>
        <p className="clue-text">{round.clue}</p>
        <Semicircle
          spectrum={spectrum}
          mode="display"
          targetAngle={round.needleAngle}
          needles={needles}
        />
      </div>

      <div className="card">
        <p className="text-muted">
          {answered} / {guessers.length} joueurs ont répondu
        </p>
        <ul className="player-list">
          {guessers.map((id) => (
            <li key={id} className="score-row">
              <span className="score-row__name">
                <span className="score-dot" style={{ background: playerColor(room.order, id) }} />
                {room.players[id].name}
              </span>
              <span>{guesses[id] != null ? '✅' : '⏳'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Vue du devineur : place son aiguille et diffuse sa position en direct (throttle
// identique au mode Consensus) pour que l'auteur la voie bouger. Une fois validé,
// l'aiguille se fige et le joueur attend les autres.
function IndividualGuesser({
  roomCode,
  playerId,
  turnIndex,
  round,
  spectrum,
  sourceName,
  progress,
  guessers,
  guesses,
  answered,
}) {
  const iAnswered = guesses[playerId] != null
  const [angle, setAngle] = useState(90)
  const [busy, setBusy] = useState(false)
  const lastSentRef = useRef(0)
  const pendingRef = useRef(null)
  const latestAngleRef = useRef(90)

  useEffect(() => () => clearTimeout(pendingRef.current), [])

  // Envoie immédiatement une position de diffusion encore en attente (fin de
  // glissement, avant validation) pour que l'auteur voie la position finale.
  const flushPending = () => {
    if (!pendingRef.current) return Promise.resolve()
    clearTimeout(pendingRef.current)
    pendingRef.current = null
    lastSentRef.current = Date.now()
    return setIndividualLiveAngle(roomCode, playerId, latestAngleRef.current).catch(() => {})
  }

  const handleDrag = (newAngle) => {
    setAngle(newAngle)
    latestAngleRef.current = newAngle
    const now = Date.now()
    if (now - lastSentRef.current >= LIVE_THROTTLE_MS) {
      lastSentRef.current = now
      setIndividualLiveAngle(roomCode, playerId, newAngle).catch(() => {})
    } else {
      clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null
        lastSentRef.current = Date.now()
        setIndividualLiveAngle(roomCode, playerId, latestAngleRef.current).catch(() => {})
      }, LIVE_THROTTLE_MS)
    }
  }

  const handleSubmit = async () => {
    setBusy(true)
    try {
      await flushPending()
      await submitIndividualGuess(roomCode, turnIndex, playerId, angle)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <AppHeader>
        <h1 className="app__title">À toi de deviner !</h1>
        <span className="progress-pill">{progress}</span>
      </AppHeader>

      <div className="card">
        <p className="text-muted">Indice de {sourceName} :</p>
        <p className="clue-text">{round.clue}</p>
        <div onPointerUp={flushPending} onPointerCancel={flushPending}>
          <Semicircle
            spectrum={spectrum}
            mode={iAnswered ? 'display' : 'drag'}
            angle={iAnswered ? guesses[playerId] : angle}
            onChange={iAnswered ? undefined : handleDrag}
          />
        </div>
      </div>

      {iAnswered ? (
        <p className="text-muted text-center">
          En attente des autres... ({answered}/{guessers.length})
        </p>
      ) : (
        <button className="btn" onClick={handleSubmit} disabled={busy}>
          Valider ma réponse
        </button>
      )}
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
        <AppHeader>
          <h1 className="app__title">Résultat</h1>
          <span className="progress-pill">{progress}</span>
        </AppHeader>

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
        <AppHeader>
          <h1 className="app__title">Les autres devinent ton indice</h1>
          <span className="progress-pill">{progress}</span>
        </AppHeader>

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
      <AppHeader>
        <h1 className="app__title">Mettez-vous d&apos;accord !</h1>
        <span className="progress-pill">{progress}</span>
      </AppHeader>

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
