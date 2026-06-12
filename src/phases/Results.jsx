import { useEffect, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { ScoreGauge } from '../components/ScoreGauge'
import { getGuessSourceId } from '../game/logic'
import { playAgain } from '../game/roomApi'

// Durée d'affichage de chaque manche pendant la cinématique de révélation.
const TURN_DURATION_MS = 3000

export function Results({ roomCode, room, playerId }) {
  const [busy, setBusy] = useState(false)
  const [turnIndex, setTurnIndex] = useState(0)
  const isHost = room.hostId === playerId
  const maxScore = room.turns.length * 4

  // Score cumulé après chaque tour, dans l'ordre de révélation de la cinématique.
  const cumulativeScores = [0]
  room.turns.forEach((turn) => {
    const score = room.results[turn.guesserId][turn.roundIndex].score
    cumulativeScores.push(cumulativeScores[cumulativeScores.length - 1] + score)
  })

  // Avance automatiquement d'une manche à la fois pendant la cinématique.
  useEffect(() => {
    if (turnIndex >= room.turns.length) return undefined
    const timer = setTimeout(() => setTurnIndex((i) => i + 1), TURN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [turnIndex, room.turns.length])

  const handlePlayAgain = async () => {
    setBusy(true)
    try {
      await playAgain(roomCode)
    } finally {
      setBusy(false)
    }
  }

  if (turnIndex < room.turns.length) {
    const turn = room.turns[turnIndex]
    const entry = room.results[turn.guesserId][turn.roundIndex]
    const spectrum = room.pack.spectra[entry.spectrumIndex]
    const sourceName = room.players[turn.sourceId].name
    const guesserName = room.players[turn.guesserId].name
    const progress = `Manche ${turnIndex + 1} / ${room.turns.length}`

    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Résultats</h1>
          <span className="progress-pill">{progress}</span>
        </header>

        <div className="card text-center">
          <h2>Score de l&apos;équipe</h2>
          <p className="score-total">
            {cumulativeScores[turnIndex + 1]} <span className="text-muted">/ {maxScore}</span>
          </p>
          <ScoreGauge score={cumulativeScores[turnIndex + 1]} maxScore={maxScore} />
        </div>

        <div className="card">
          <p className="text-muted">
            {sourceName} ➜ {guesserName}
          </p>
          <p className="clue-text">« {entry.clue} »</p>
          <Semicircle
            spectrum={spectrum}
            mode="result"
            angle={entry.guessedAngle}
            targetAngle={entry.actualAngle}
            score={entry.score}
          />
        </div>

        <button className="btn btn--ghost" onClick={() => setTurnIndex(room.turns.length)}>
          Passer
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Résultats</h1>
      </header>

      <div className="card text-center">
        <h2>Score de l&apos;équipe</h2>
        <p className="score-total">
          {room.score} <span className="text-muted">/ {maxScore}</span>
        </p>
        <ScoreGauge score={room.score} maxScore={maxScore} />
      </div>

      {room.order.map((guesserId) => {
        const sourceId = getGuessSourceId(room.order, guesserId)
        const entries = room.results[guesserId]
        return (
          <div className="card" key={guesserId}>
            <h2>
              {room.players[sourceId].name} ➜ {room.players[guesserId].name}
            </h2>
            {entries.map((entry, i) => {
              const spectrum = room.pack.spectra[entry.spectrumIndex]
              return (
                <div className="result-round" key={i}>
                  <p className="clue-text">« {entry.clue} »</p>
                  <Semicircle
                    spectrum={spectrum}
                    mode="result"
                    angle={entry.guessedAngle}
                    targetAngle={entry.actualAngle}
                    score={entry.score}
                  />
                </div>
              )
            })}
          </div>
        )
      })}

      {isHost ? (
        <button className="btn" onClick={handlePlayAgain} disabled={busy}>
          Nouvelle partie
        </button>
      ) : (
        <p className="text-muted">En attente que l&apos;hôte relance une partie...</p>
      )}
    </div>
  )
}
