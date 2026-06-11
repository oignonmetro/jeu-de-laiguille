import { useState } from 'react'
import { DEFAULT_PACKS } from '../data/defaultPacks'
import { getCustomPackRefs } from '../game/customPacks'
import { loadPack } from '../game/packApi'
import { addPack, removePack, startGame } from '../game/roomApi'
import { mergeSpectra } from '../game/logic'

export function Lobby({ roomCode, room, playerId }) {
  const isHost = room.hostId === playerId
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const customRefs = getCustomPackRefs()

  const players = room.order.map((id) => ({ id, ...room.players[id] }))
  const selectedPacks = room.packs || {}
  const selectedNames = Object.values(selectedPacks).map((p) => p.name)
  const totalSpectra = mergeSpectra(Object.values(selectedPacks)).length
  const canStart = selectedNames.length > 0 && players.length >= 2

  const handleToggleDefault = async (pack) => {
    setBusy(true)
    setError('')
    try {
      if (selectedPacks[pack.id]) {
        await removePack(roomCode, pack.id)
      } else {
        await addPack(roomCode, pack)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleToggleCustom = async (ref) => {
    setBusy(true)
    setError('')
    try {
      if (selectedPacks[ref.id]) {
        await removePack(roomCode, ref.id)
      } else {
        const pack = await loadPack(ref.id)
        await addPack(roomCode, pack)
      }
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
          <h2>Choisir les packs de spectres</h2>
          <ul className="pack-list pack-list--selectable">
            {DEFAULT_PACKS.map((pack) => (
              <li key={pack.id}>
                <button
                  className={`pack-option ${selectedPacks[pack.id] ? 'pack-option--selected' : ''}`}
                  onClick={() => handleToggleDefault(pack)}
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
                  className={`pack-option ${selectedPacks[ref.id] ? 'pack-option--selected' : ''}`}
                  onClick={() => handleToggleCustom(ref)}
                  disabled={busy}
                >
                  {ref.name}
                  <span className="text-muted"> · perso</span>
                </button>
              </li>
            ))}
          </ul>
          {selectedNames.length > 0 && (
            <p className="text-muted">
              {selectedNames.length > 1
                ? `${selectedNames.length} packs · ${totalSpectra} spectres au total`
                : `${totalSpectra} spectres`}
            </p>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="text-muted">
            {selectedNames.length > 1 ? 'Packs sélectionnés' : 'Pack sélectionné'}
          </p>
          <p>
            {selectedNames.length > 0
              ? selectedNames.join(' + ')
              : "En attente que l'hôte choisisse un pack..."}
          </p>
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
