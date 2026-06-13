import { useEffect, useMemo, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { ScoreGauge } from '../components/ScoreGauge'
import { getGaugeVerdict } from '../components/gaugeZones'
import { Confetti } from '../components/Confetti'
import { useCountUp } from '../hooks/useCountUp'
import { getGuessSourceId } from '../game/logic'
import { playAgain } from '../game/roomApi'
import { vibrate } from '../utils/haptics'

// Cinématique de révélation : chaque manche se déroule en deux étapes —
// 1) présentation du résultat (palette, aiguille, score de la manche)
// 2) la jauge du score total avance vers le nouveau cumul (ou reste en
// place si la manche n'a rapporté aucun point).
const RESULT_MS = 4000
const GAUGE_MS = 1800
// Balayage lent de la jauge sur l'écran de score final.
const FINALE_SWEEP_MS = 2400
// Part du score max à partir de laquelle on fête le résultat aux confettis
// (zones « Super » et « Waouh ! » de la jauge).
const CELEBRATION_RATIO = 2 / 3

export function Results({ roomCode, room, playerId }) {
  const [busy, setBusy] = useState(false)
  // phase 'turns' : manches révélées une à une ; 'finale' : score total
  // dramatisé ; 'recap' : récapitulatif détaillé complet.
  const [phase, setPhase] = useState('turns')
  const [turnIndex, setTurnIndex] = useState(0)
  const [stage, setStage] = useState('result')
  const isHost = room.hostId === playerId
  const maxScore = room.turns.length * 4

  const isConsensus = room.guessMode === 'consensus'

  // Score cumulé après chaque tour, dans l'ordre de révélation de la cinématique.
  const cumulativeScores = useMemo(() => {
    const scores = [0]
    room.turns.forEach((turn) => {
      const resultsId = isConsensus ? turn.sourceId : turn.guesserId
      const score = room.results[resultsId][turn.roundIndex].score
      scores.push(scores[scores.length - 1] + score)
    })
    return scores
  }, [room.turns, room.results, isConsensus])

  const revealed = stage === 'gauge'
  const displayedScore = cumulativeScores[turnIndex + (revealed ? 1 : 0)]
  const countedScore = useCountUp(displayedScore)

  // Avancement automatique : présentation du résultat de la manche → la
  // jauge totale avance vers le nouveau cumul → manche suivante, puis écran
  // de finale après la dernière manche.
  useEffect(() => {
    if (phase !== 'turns') return undefined
    const timer = setTimeout(
      () => {
        if (!revealed) {
          setStage('gauge')
        } else if (turnIndex + 1 < room.turns.length) {
          setTurnIndex(turnIndex + 1)
          setStage('result')
        } else {
          setPhase('finale')
        }
      },
      revealed ? GAUGE_MS : RESULT_MS
    )
    return () => clearTimeout(timer)
  }, [phase, turnIndex, revealed, room.turns.length])

  // Petit retour haptique au moment où une manche à 4 points est révélée.
  useEffect(() => {
    if (phase !== 'turns' || !revealed) return
    if (cumulativeScores[turnIndex + 1] - cumulativeScores[turnIndex] === 4) {
      vibrate(200)
    }
  }, [phase, revealed, turnIndex, cumulativeScores])

  const handlePlayAgain = async () => {
    setBusy(true)
    try {
      await playAgain(roomCode)
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'turns' && room.turns.length > 0) {
    const turn = room.turns[turnIndex]
    const resultsId = isConsensus ? turn.sourceId : turn.guesserId
    const entry = room.results[resultsId][turn.roundIndex]
    const spectrum = room.pack.spectra[entry.spectrumIndex]
    const sourceName = room.players[turn.sourceId].name
    const guesserName = isConsensus ? 'Tout le monde' : room.players[turn.guesserId].name
    const progress = `Manche ${turnIndex + 1} / ${room.turns.length}`
    const pulse = revealed && entry.score === 4

    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Résultats</h1>
          <span className="progress-pill">{progress}</span>
        </header>

        <div className="card text-center">
          <h2>Score de l&apos;équipe</h2>
          {/* key : relance l'animation de pulse à chaque révélation */}
          <p
            key={`${turnIndex}-${stage}`}
            className={`score-total${pulse ? ' score-total--pulse' : ''}`}
          >
            {countedScore} <span className="text-muted">/ {maxScore}</span>
          </p>
          <ScoreGauge score={displayedScore} maxScore={maxScore} />
        </div>

        {/* key={turnIndex} : rejoue la transition d'entrée à chaque manche */}
        <div className="card card--enter" key={turnIndex}>
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

        <button className="btn btn--ghost" onClick={() => setPhase('finale')}>
          Passer
        </button>
      </div>
    )
  }

  if (phase === 'finale') {
    return <Finale score={room.score} maxScore={maxScore} onDone={() => setPhase('recap')} />
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

      {room.order.map((id) => {
        const sourceId = isConsensus ? id : getGuessSourceId(room.order, id)
        const guesserLabel = isConsensus ? 'Tout le monde' : room.players[id].name
        const entries = room.results[id]
        return (
          <div className="card" key={id}>
            <h2>
              {room.players[sourceId].name} ➜ {guesserLabel}
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

// Écran de score final : la jauge re-balaie lentement depuis zéro pendant
// que le compteur monte, puis le verdict apparaît en grand (avec confettis
// si l'équipe a brillé).
function Finale({ score, maxScore, onDone }) {
  const [showVerdict, setShowVerdict] = useState(false)
  const countedScore = useCountUp(score, FINALE_SWEEP_MS)
  const verdict = getGaugeVerdict(score, maxScore)
  const celebrate = maxScore > 0 && score >= maxScore * CELEBRATION_RATIO

  useEffect(() => {
    const timer = setTimeout(() => setShowVerdict(true), FINALE_SWEEP_MS + 150)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (showVerdict && celebrate) vibrate([100, 60, 100])
  }, [showVerdict, celebrate])

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Score final</h1>
      </header>

      <div className="card text-center finale">
        <h2>Score de l&apos;équipe</h2>
        <p className="score-total score-total--finale">
          {countedScore} <span className="text-muted">/ {maxScore}</span>
        </p>
        <ScoreGauge score={score} maxScore={maxScore} sweepDurationMs={FINALE_SWEEP_MS} />
        {showVerdict && (
          <p className="finale__verdict" style={{ color: verdict.color }}>
            {verdict.label}
          </p>
        )}
        {showVerdict && celebrate && <Confetti />}
      </div>

      <button className="btn" onClick={onDone}>
        Voir le détail
      </button>
    </div>
  )
}
