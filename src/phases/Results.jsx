import { useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { ScoreGauge } from '../components/ScoreGauge'
import { getGuessSourceId } from '../game/logic'
import { playAgain } from '../game/roomApi'

export function Results({ roomCode, room, playerId }) {
  const [busy, setBusy] = useState(false)
  const isHost = room.hostId === playerId
  const maxScore = room.turns.length * 4

  const handlePlayAgain = async () => {
    setBusy(true)
    try {
      await playAgain(roomCode)
    } finally {
      setBusy(false)
    }
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
