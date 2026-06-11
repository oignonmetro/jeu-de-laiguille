import { useEffect, useState } from 'react'
import { Home } from './phases/Home'
import { PackManager } from './phases/PackManager'
import { Lobby } from './phases/Lobby'
import { ClueWriting } from './phases/ClueWriting'
import { Guessing } from './phases/Guessing'
import { Results } from './phases/Results'
import { useRoom } from './hooks/useRoom'
import { leaveRoom } from './game/roomApi'
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

  const screen = (() => {
    switch (room.status) {
      case 'clue-writing':
        return <ClueWriting roomCode={roomCode} room={room} playerId={playerId} />
      case 'guessing':
        return <Guessing roomCode={roomCode} room={room} playerId={playerId} />
      case 'results':
        return <Results roomCode={roomCode} room={room} playerId={playerId} />
      case 'lobby':
      default:
        return <Lobby roomCode={roomCode} room={room} playerId={playerId} />
    }
  })()

  const handleLeave = async () => {
    if (!window.confirm('Quitter la salle ?')) return
    // Depuis le lobby on se retire vraiment de la salle ; en cours de partie
    // on quitte seulement cet appareil (retour possible avec le code).
    if (room.status === 'lobby') {
      try {
        await leaveRoom(roomCode, playerId)
      } catch {
        // Au pire le joueur reste listé dans la salle, on quitte quand même.
      }
    }
    sessionStorage.removeItem(ROOM_STORAGE_KEY)
    setRoomCode('')
  }

  // Pied de page discret : rappel du code de la salle (utile pour un joueur
  // déconnecté ; le lobby l'affiche déjà en grand) et bouton pour quitter.
  return (
    <>
      {screen}
      <footer className="room-footer">
        {room.status !== 'lobby' && (
          <span>
            Salle <span className="room-footer__code">{roomCode}</span> ·{' '}
          </span>
        )}
        <button className="room-footer__leave" onClick={handleLeave}>
          Quitter la salle
        </button>
      </footer>
    </>
  )
}

export default App
