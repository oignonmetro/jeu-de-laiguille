import { createContext, useContext, useState } from 'react'
import { isHapticsEnabled, setHapticsEnabled } from '../utils/haptics'
import { isChatVisible, setChatVisible } from '../utils/chatVisibility'
import './SettingsMenu.css'

// Actions de partie réservées à l'hôte, exposées au menu Paramètres (présent
// dans l'en-tête de chaque écran) sans avoir à passer de props à travers tous
// les AppHeader. Vaut null hors d'une partie (accueil, gestion des packs).
const GameControlContext = createContext(null)

export function GameControlProvider({ value, children }) {
  return <GameControlContext.Provider value={value}>{children}</GameControlContext.Provider>
}

// En-tête de page intégrant l'engrenage de paramètres au même niveau que le
// titre : le bouton fait partie du flux normal et défile avec le contenu.
export function AppHeader({ children }) {
  const [open, setOpen] = useState(false)
  const [haptics, setHaptics] = useState(isHapticsEnabled)
  const [chatShown, setChatShown] = useState(isChatVisible)
  const [busy, setBusy] = useState(false)
  const gameControl = useContext(GameControlContext)

  const toggleHaptics = () => {
    const next = !haptics
    setHaptics(next)
    setHapticsEnabled(next)
    if (next) navigator.vibrate?.(50)
  }

  const toggleChat = () => {
    const next = !chatShown
    setChatShown(next)
    setChatVisible(next)
  }

  // Recommence la partie en cours : tout le monde repart du salon, score
  // remis à zéro. Confirmation car l'action affecte tous les joueurs.
  const handleRestart = async () => {
    if (!window.confirm('Recommencer la partie ? Tout le monde reviendra au salon et le score sera remis à zéro.')) {
      return
    }
    setBusy(true)
    try {
      await gameControl.onRestart()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="app__header">
        <div className="app__header-content">{children}</div>
        <button className="settings-gear" aria-label="Paramètres" onClick={() => setOpen(true)}>
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="settings-overlay" onClick={() => setOpen(false)}>
          <div
            className="card settings-panel"
            role="dialog"
            aria-label="Paramètres"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Paramètres</h2>

            <label className="settings-row">
              <span>
                Vibrations
                <span className="settings-row__hint">
                  Retour haptique sur les manches parfaites et le score final
                </span>
              </span>
              <span className="switch">
                <input type="checkbox" checked={haptics} onChange={toggleHaptics} />
                <span className="switch__slider" aria-hidden="true" />
              </span>
            </label>

            <label className="settings-row">
              <span>
                Bouton de chat
                <span className="settings-row__hint">
                  Affiche la bulle de discussion en bas de l&apos;écran
                </span>
              </span>
              <span className="switch">
                <input type="checkbox" checked={chatShown} onChange={toggleChat} />
                <span className="switch__slider" aria-hidden="true" />
              </span>
            </label>

            {gameControl?.canRestart && (
              <div className="settings-section">
                <button className="btn btn--danger" onClick={handleRestart} disabled={busy}>
                  Recommencer la partie
                </button>
                <p className="settings-row__hint">
                  Ramène tout le monde au salon et remet le score à zéro.
                </p>
              </div>
            )}

            <button className="btn btn--secondary" onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  )
}
