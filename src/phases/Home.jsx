import { useState } from 'react'
import { createRoom, joinRoom } from '../game/roomApi'
import { userMessage } from '../game/errors'

const NAME_STORAGE_KEY = 'demi-cercle:player-name'

export function Home({ playerId, onEnterRoom, onOpenPacks, notice }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) || '')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const updateName = (value) => {
    setName(value)
    localStorage.setItem(NAME_STORAGE_KEY, value)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Choisis un prénom.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const roomCode = await createRoom(playerId, name.trim())
      onEnterRoom(roomCode)
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Choisis un prénom.')
      return
    }
    if (!joinCode.trim()) {
      setError('Entre le code de la salle.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const roomCode = joinCode.trim().toUpperCase()
      await joinRoom(roomCode, playerId, name.trim())
      onEnterRoom(roomCode)
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Le jeu de l'aiguille</h1>
      </header>

      {notice && (
        <div className="card">
          <p className="text-muted">{notice}</p>
        </div>
      )}

      <div className="card field">
        <label htmlFor="player-name">Ton prénom</label>
        <input
          id="player-name"
          value={name}
          onChange={(e) => updateName(e.target.value)}
          placeholder="Ton prénom"
          maxLength={20}
        />
      </div>

      <div className="card">
        <button className="btn" onClick={handleCreate} disabled={busy}>
          Créer une partie
        </button>
      </div>

      <div className="card field">
        <label htmlFor="join-code">Rejoindre avec un code</label>
        <input
          id="join-code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Ex. AB3X"
          maxLength={4}
        />
        <button className="btn btn--secondary" onClick={handleJoin} disabled={busy}>
          Rejoindre
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn--ghost" onClick={onOpenPacks}>
        Gérer mes packs de spectres
      </button>
    </div>
  )
}
