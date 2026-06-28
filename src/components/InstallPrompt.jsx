import { useEffect, useState } from 'react'
import './InstallPrompt.css'

// Mémorise le rejet pour ne plus proposer l'ajout à l'écran d'accueil.
const DISMISS_KEY = 'aiguille:install-dismissed'

// L'app est-elle déjà lancée comme une app installée (donc rien à proposer) ?
function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// Appareil iOS : iPhone/iPod, ou iPad récent qui se présente comme un Mac mais
// possède un écran tactile.
function isIos() {
  const ua = window.navigator.userAgent
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  )
}

// Bannière invitant à ajouter le jeu à l'écran d'accueil. Sur Android/Chrome on
// déclenche l'invite native ; sur iOS (pas d'invite possible) on explique le
// geste à faire dans Safari. Masquée si déjà installée ou déjà rejetée.
export function InstallPrompt() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  // Évènement beforeinstallprompt mis de côté pour le déclencher au clic (Android/Chrome).
  const [deferred, setDeferred] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const close = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  if (dismissed || isStandalone()) return null

  // Android / Chrome : invite native déclenchable par un bouton.
  if (deferred) {
    const install = async () => {
      deferred.prompt()
      await deferred.userChoice
      close()
    }
    return (
      <div className="install-hint">
        <button className="install-hint__close" aria-label="Fermer" onClick={close}>
          ×
        </button>
        <p className="install-hint__title">Installe le jeu sur ton téléphone</p>
        <button className="btn btn--small" onClick={install}>
          Ajouter à l&apos;écran d&apos;accueil
        </button>
      </div>
    )
  }

  // iOS : on explique le geste (Safari → Partager → « Sur l'écran d'accueil »).
  if (isIos()) {
    return (
      <div className="install-hint">
        <button className="install-hint__close" aria-label="Fermer" onClick={close}>
          ×
        </button>
        <p className="install-hint__title">Ajoute le jeu à ton écran d&apos;accueil</p>
        <p className="install-hint__steps">
          Appuie sur <ShareGlyph /> puis «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»
        </p>
      </div>
    )
  }

  return null
}

// Glyphe « Partager » d'iOS (carré avec flèche vers le haut).
function ShareGlyph() {
  return (
    <svg
      className="install-hint__share"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}
