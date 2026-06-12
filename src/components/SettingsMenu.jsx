import { useState } from 'react'
import { isHapticsEnabled, setHapticsEnabled } from '../utils/haptics'
import './SettingsMenu.css'

// Engrenage discret en haut à droite, ouvrant une petite fenêtre de
// paramètres accessible à tout moment de la partie.
export function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const [haptics, setHaptics] = useState(isHapticsEnabled)

  const toggleHaptics = () => {
    const next = !haptics
    setHaptics(next)
    setHapticsEnabled(next)
    // Petite vibration de confirmation quand on (ré)active l'option.
    if (next) navigator.vibrate?.(50)
  }

  return (
    <>
      <button
        className="settings-gear"
        aria-label="Paramètres"
        onClick={() => setOpen(true)}
      >
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

            <button className="btn btn--secondary" onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  )
}
