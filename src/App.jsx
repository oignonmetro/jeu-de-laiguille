import { useEffect, useState } from 'react'
import { Home } from './phases/Home'
import { PackManager } from './phases/PackManager'
import { Lobby } from './phases/Lobby'
import { ClueWriting } from './phases/ClueWriting'
import { Guessing } from './phases/Guessing'
import { Results } from './phases/Results'
import { SettingsMenu } from './components/SettingsMenu'
import { useRoom } from './hooks/useRoom'
import { leaveRoom, cleanupIfInactive } from './game/roomApi'
import { getOrCreatePlayerId } from './game/playerId'
import { firebaseConfigured } from './firebase'
import './App.css'

const ROOM_STORAGE_KEY = 'demi-cercle:room-code'
// Fréquence à laquelle un client connecté vérifie si la salle est restée
// inactive assez longtemps pour être nettoyée (cf. ROOM_INACTIVITY_MS côté
// roomApi) — utile pour les onglets laissés ouverts sans qu'une partie
// n'avance.
const ROOM_CHECK_INTERVAL_MS = 60 * 1000

function App() {
  const [playerId] = useState(getOrCreatePlayerId)
  const [roomCode, setRoomCode] = useState(() => sessionStorage.getItem(ROOM_STORAGE_KEY) || '')
  const [view, setView] = useState('home')
  const { room, loading } = useRoom(roomCode)

  const enterRoom = (code) => {
    sessionStorage.setItem(ROOM_STORAGE_KEY, code)
    setRoomCode(code)
  }

  // Si la salle stockée n'existe plus (supprimée pour inactivité, code
  // invalide) ou ne nous contient pas, on revient à l'accueil. `roomClosed`
  // permet de distinguer "la salle a bien existé puis disparu" pour afficher
  // un message, et on oublie le code stocké au prochain chargement.
  const isMember = !roomCode || loading || Boolean(room?.players?.[playerId])
  const roomClosed = Boolean(roomCode) && !loading && room === null

  useEffect(() => {
    if (roomCode && !loading && (!room || !room.players?.[playerId])) {
      sessionStorage.removeItem(ROOM_STORAGE_KEY)
    }
  }, [roomCode, loading, room, playerId])

  // Vérification périodique : si la salle est inactive depuis trop
  // longtemps, elle est supprimée (déclenchée par n'importe quel client
  // encore connecté, par exemple un onglet resté ouvert sans jouer).
  useEffect(() => {
    if (!roomCode || loading || !room) return undefined
    const interval = setInterval(() => {
      cleanupIfInactive(roomCode).catch(() => {})
    }, ROOM_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [roomCode, loading, room])

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
    return (
      <>
        <SettingsMenu />
        {view === 'packs' ? (
          <PackManager onBack={() => setView('home')} />
        ) : (
          <Home
            playerId={playerId}
            onEnterRoom={enterRoom}
            onOpenPacks={() => setView('packs')}
            notice={roomClosed ? "La salle a été fermée après une longue inactivité." : ''}
          />
        )}
      </>
    )
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
      <SettingsMenu />
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
