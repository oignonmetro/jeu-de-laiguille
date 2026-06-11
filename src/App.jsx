import { useEffect, useState } from 'react'
import { Home } from './phases/Home'
import { PackManager } from './phases/PackManager'
import { Lobby } from './phases/Lobby'
import { ClueWriting } from './phases/ClueWriting'
import { Guessing } from './phases/Guessing'
import { Results } from './phases/Results'
import { useRoom } from './hooks/useRoom'
import { getOrCreatePlayerId } from './game/playerId'
import { firebaseConfigured } from './firebase'
import './App.css'

const ROOM_STORAGE_KEY = 'demi-cercle:room-code'

function App() {
  const [playerId] = useState(getOrCreatePlayerId)
  const [roomCode, setRoomCode] = useState(() => sessionStorage.getItem(ROOM_STORAGE_KEY) || '')
  const [view, setView] = useState('home')
  const { room, loading } = useRoom(roomCode)

  const enterRoom = (code) => {
    sessionStorage.setItem(ROOM_STORAGE_KEY, code)
    setRoomCode(code)
  }

  // Si la salle stockée n'existe plus ou ne nous contient pas, on oublie ce
  // code et on revient à l'accueil au prochain chargement.
  const isMember = !roomCode || loading || !room || Boolean(room.players?.[playerId])

  useEffect(() => {
    if (roomCode && !loading && room && !room.players?.[playerId]) {
      sessionStorage.removeItem(ROOM_STORAGE_KEY)
    }
  }, [roomCode, loading, room, playerId])

  if (!firebaseConfigured) {
    return (
      <div className="app">
        <div className="card">
          <h1 className="app__title">Configuration requise</h1>
          <p>
            Le projet Firebase n&apos;est pas configuré. Copie <code>.env.example</code> en{' '}
            <code>.env</code> et renseigne tes identifiants Firebase (voir le README).
          </p>
        </div>
      </div>
    )
  }

  if (!roomCode || !isMember) {
    if (view === 'packs') {
      return <PackManager onBack={() => setView('home')} />
    }
    return <Home playerId={playerId} onEnterRoom={enterRoom} onOpenPacks={() => setView('packs')} />
  }

  if (loading || !room) {
    return (
      <div className="app">
        <div className="card">
          <p>Connexion à la salle {roomCode}...</p>
        </div>
      </div>
    )
  }

  switch (room.status) {
    case 'clue-writing':
      return withRoomCode(<ClueWriting roomCode={roomCode} room={room} playerId={playerId} />)
    case 'guessing':
      return withRoomCode(<Guessing roomCode={roomCode} room={room} playerId={playerId} />)
    case 'results':
      return withRoomCode(<Results roomCode={roomCode} room={room} playerId={playerId} />)
    case 'lobby':
    default:
      return <Lobby roomCode={roomCode} room={room} playerId={playerId} />
  }

  // Rappel discret du code de la salle pendant la partie, pour qu'un joueur
  // déconnecté puisse redonner le code aux autres (le lobby l'affiche déjà
  // en grand).
  function withRoomCode(screen) {
    return (
      <>
        {screen}
        <footer className="room-code-tag">
          Salle <span className="room-code-tag__code">{roomCode}</span>
        </footer>
      </>
    )
  }
}

export default App
