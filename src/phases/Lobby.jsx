import { useState } from 'react'
import { DEFAULT_PACKS } from '../data/defaultPacks'
import { getCustomPackRefs } from '../game/customPacks'
import { loadPack } from '../game/packApi'
import { selectPack, startGame } from '../game/roomApi'

export function Lobby({ roomCode, room, playerId }) {
  const isHost = room.hostId === playerId
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const customRefs = getCustomPackRefs()

  const players = room.order.map((id) => ({ id, ...room.players[id] }))
  const canStart = Boolean(room.pack) && players.length >= 2

  const handleSelectDefault = async (pack) => {
    setBusy(true)
    setError('')
    try {
      await selectPack(roomCode, pack)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSelectCustom = async (ref) => {
    setBusy(true)
    setError('')
    try {
      const pack = await loadPack(ref.id)
      await selectPack(roomCode, pack)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleStart = async () => {
    setBusy(true)
    setError('')
    try {
      await startGame(roomCode, room)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Demi-Cercle</h1>
      </header>

      <div className="card">
        <p className="text-muted">Code de la salle</p>
        <p className="code-display">{roomCode}</p>
      </div>

      <div className="card">
        <h2>Joueurs ({players.length})</h2>
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id}>
              {p.name}
              {p.id === room.hostId ? ' · hôte' : ''}
              {p.id === playerId ? ' (toi)' : ''}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="card">
          <h2>Choisir un pack de spectres</h2>
          <ul className="pack-list pack-list--selectable">
            {DEFAULT_PACKS.map((pack) => (
              <li key={pack.id}>
                <button
                  className={`pack-option ${room.pack?.name === pack.name ? 'pack-option--selected' : ''}`}
                  onClick={() => handleSelectDefault(pack)}
                  disabled={busy}
                >
                  {pack.name}
                  <span className="text-muted"> · {pack.spectra.length} spectres</span>
                </button>
              </li>
            ))}
            {customRefs.map((ref) => (
              <li key={ref.id}>
                <button
                  className={`pack-option ${room.pack?.name === ref.name ? 'pack-option--selected' : ''}`}
                  onClick={() => handleSelectCustom(ref)}
                  disabled={busy}
                >
                  {ref.name}
                  <span className="text-muted"> · perso</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card">
          <p className="text-muted">Pack sélectionné</p>
          <p>{room.pack ? room.pack.name : "En attente que l'hôte choisisse un pack..."}</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {isHost ? (
        <button className="btn" onClick={handleStart} disabled={busy || !canStart}>
          Démarrer la partie
        </button>
      ) : (
        <p className="text-muted">En attente que l&apos;hôte démarre la partie...</p>
      )}
    </div>
  )
}
