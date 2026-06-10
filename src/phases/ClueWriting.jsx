import { useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { submitClue, setRoundReady, tryAdvanceToGuessing } from '../game/roomApi'

export function ClueWriting({ roomCode, room, playerId }) {
  const myRounds = room.rounds[playerId]
  const startIndex = myRounds.findIndex((r) => !r.ready)
  const [index, setIndex] = useState(startIndex === -1 ? 0 : startIndex)
  const [draft, setDraft] = useState(myRounds[startIndex === -1 ? 0 : startIndex]?.clue || '')
  const [busy, setBusy] = useState(false)

  const allReady = myRounds.every((r) => r.ready)

  if (allReady) {
    const readyCount = room.order.filter((id) => room.rounds[id].every((r) => r.ready)).length
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Indices envoyés !</h1>
        </header>
        <div className="card">
          <p className="text-muted">
            En attente des autres joueurs ({readyCount}/{room.order.length})...
          </p>
          <ul className="player-list">
            {room.order.map((id) => (
              <li key={id}>
                {room.players[id].name} {room.rounds[id].every((r) => r.ready) ? '✅' : '⏳'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const round = myRounds[index]
  const spectrum = room.pack.spectra[round.spectrumIndex]
  const isLast = index === myRounds.length - 1

  const handleNext = async () => {
    const clue = draft.trim()
    setBusy(true)
    try {
      await submitClue(roomCode, playerId, index, clue)
      await setRoundReady(roomCode, playerId, index, true)
      if (!isLast) {
        const next = index + 1
        setIndex(next)
        setDraft(myRounds[next]?.clue || '')
      } else {
        await tryAdvanceToGuessing(roomCode)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Écris ton indice</h1>
        <span className="progress-pill">
          {index + 1} / {myRounds.length}
        </span>
      </header>

      <div className="card">
        <Semicircle spectrum={spectrum} mode="display" angle={round.needleAngle} />
      </div>

      <div className="card field">
        <label htmlFor="clue">Ton indice</label>
        <input
          id="clue"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex. Un plat italien classique"
          maxLength={120}
          autoFocus
        />
      </div>

      <button className="btn" onClick={handleNext} disabled={busy || !draft.trim()}>
        {isLast ? 'Valider mes indices' : 'Suivant'}
      </button>
    </div>
  )
}
