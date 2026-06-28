import { useEffect, useMemo, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { AppHeader } from '../components/SettingsMenu'
import { ScoreGauge } from '../components/ScoreGauge'
import { getGaugeVerdict } from '../components/gaugeZones'
import { Confetti } from '../components/Confetti'
import { useCountUp } from '../hooks/useCountUp'
import { playerColor } from '../game/colors'
import { playAgain } from '../game/roomApi'
import { vibrate } from '../utils/haptics'

// Cinématique de révélation : chaque manche se déroule en deux étapes —
// 1) présentation du résultat (palette, aiguille, score de la manche)
// 2) la jauge du score total avance vers le nouveau cumul (ou reste en
// place si la manche n'a rapporté aucun point).
const RESULT_MS = 2800
const GAUGE_MS = 1300
// Balayage lent de la jauge sur l'écran de score final.
const FINALE_SWEEP_MS = 2400
// Part du score max à partir de laquelle on fête le résultat aux confettis
// (zones « Super » et « Waouh ! » de la jauge).
const CELEBRATION_RATIO = 2 / 3

export function Results({ roomCode, room, playerId }) {
  if (room.guessMode !== 'consensus') {
    return <IndividualResults roomCode={roomCode} room={room} playerId={playerId} />
  }
  return <CooperativeResults roomCode={roomCode} room={room} playerId={playerId} />
}

// Mode "Consensus" : score d'équipe coopératif, cinématique de révélation tour
// par tour puis jauge finale.
function CooperativeResults({ roomCode, room, playerId }) {
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

  // Retour haptique au moment où la jauge réagit : franc pour une manche à
  // 4 points, petit soubresaut « raté » quand la manche ne rapporte rien
  // (en écho au tremblement de la jauge).
  useEffect(() => {
    if (phase !== 'turns' || !revealed) return
    const gain = cumulativeScores[turnIndex + 1] - cumulativeScores[turnIndex]
    if (gain === 4) vibrate(200)
    else if (gain === 0) vibrate([30, 40, 30])
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
        <AppHeader>
          <h1 className="app__title">Résultats</h1>
          <span className="progress-pill">{progress}</span>
        </AppHeader>

        <div className="card text-center">
          <h2>Score de l&apos;équipe</h2>
          {/* key : relance l'animation de pulse à chaque révélation */}
          <p
            key={`${turnIndex}-${stage}`}
            className={`score-total${pulse ? ' score-total--pulse' : ''}`}
          >
            {countedScore} <span className="text-muted">/ {maxScore}</span>
          </p>
          <ScoreGauge
            score={displayedScore}
            maxScore={maxScore}
            shake={revealed && entry.score === 0}
          />
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
    return (
      <Finale
        score={room.score}
        maxScore={maxScore}
        onDone={() => setPhase('recap')}
        isHost={isHost}
        onPlayAgain={handlePlayAgain}
        busy={busy}
      />
    )
  }

  return (
    <div className="app">
      <AppHeader>
        <h1 className="app__title">Résultats</h1>
      </AppHeader>

      <div className="card text-center">
        <h2>Score de l&apos;équipe</h2>
        <p className="score-total">
          {room.score} <span className="text-muted">/ {maxScore}</span>
        </p>
        <ScoreGauge score={room.score} maxScore={maxScore} />
      </div>

      {room.order.map((id) => {
        const sourceId = id
        const guesserLabel = 'Tout le monde'
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
function Finale({ score, maxScore, onDone, isHost, onPlayAgain, busy }) {
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
      <AppHeader>
        <h1 className="app__title">Score final</h1>
      </AppHeader>

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
      {isHost ? (
        <button className="btn btn--ghost" onClick={onPlayAgain} disabled={busy}>
          Nouvelle partie
        </button>
      ) : (
        <p className="text-muted">En attente que l&apos;hôte relance une partie…</p>
      )}
    </div>
  )
}

// Mode « Chacun pour soi » : classement individuel puis récap de chaque indice
// (position réelle, aiguilles des devineurs et points). Pas de cinématique.
function IndividualResults({ roomCode, room, playerId }) {
  const [busy, setBusy] = useState(false)
  const isHost = room.hostId === playerId

  // Classement décroissant, avec rangs partagés en cas d'égalité.
  const sorted = room.order
    .map((id) => ({ id, name: room.players[id].name, score: room.scores?.[id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
  const ranked = sorted.reduce((acc, entry, i) => {
    const prev = acc[i - 1]
    const rank = prev && entry.score === prev.score ? prev.rank : i + 1
    acc.push({ ...entry, rank })
    return acc
  }, [])
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' }

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
      <AppHeader>
        <h1 className="app__title">Classement</h1>
      </AppHeader>

      <div className="card">
        <ul className="player-list">
          {ranked.map((entry) => (
            <li key={entry.id} className={`rank-row${entry.id === playerId ? ' rank-row--me' : ''}`}>
              <span className="rank-row__pos">{medals[entry.rank] || `${entry.rank}.`}</span>
              <span className="rank-row__name">
                {entry.name}
                {entry.id === playerId ? ' (toi)' : ''}
              </span>
              <span className="rank-row__score">{entry.score} pts</span>
            </li>
          ))}
        </ul>
      </div>

      {room.order.map((authorId) => {
        const entries = room.results?.[authorId] || []
        const guessers = room.order.filter((id) => id !== authorId)
        return (
          <div className="card" key={authorId}>
            <h2>Indices de {room.players[authorId].name}</h2>
            {entries.map((entry, i) => {
              if (!entry) return null
              const spectrum = room.pack.spectra[entry.spectrumIndex]
              const needles = guessers
                .filter((id) => entry.guesses?.[id])
                .map((id) => ({
                  angle: entry.guesses[id].guessedAngle,
                  color: playerColor(room.order, id),
                }))
              return (
                <div className="result-round" key={i}>
                  <p className="clue-text">« {entry.clue} »</p>
                  <Semicircle
                    spectrum={spectrum}
                    mode="result"
                    targetAngle={entry.actualAngle}
                    needles={needles}
                  />
                  <ul className="player-list">
                    {guessers.map((id) => (
                      <li key={id} className="score-row">
                        <span className="score-row__name">
                          <span
                            className="score-dot"
                            style={{ background: playerColor(room.order, id) }}
                          />
                          {room.players[id].name}
                        </span>
                        <span>+{entry.guesses?.[id]?.score ?? 0}</span>
                      </li>
                    ))}
                    <li className="score-row score-row--author">
                      <span className="score-row__name">
                        {room.players[authorId].name} · indice
                      </span>
                      <span>+{entry.authorScore}</span>
                    </li>
                  </ul>
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
