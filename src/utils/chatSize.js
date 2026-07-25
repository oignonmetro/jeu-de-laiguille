// Préférence locale (par appareil) : taille du panneau de chat. Petite par
// défaut (4/10 de l'écran) ; peut être agrandie (7/10) depuis les paramètres.
// Même mécanisme de pub/sub que chatVisibility.js (localStorage seul ne
// déclenche pas de rendu dans le même onglet).
const STORAGE_KEY = 'demi-cercle:chat-large'
const listeners = new Set()

export function isChatLarge() {
  return localStorage.getItem(STORAGE_KEY) === 'large'
}

export function setChatLarge(large) {
  localStorage.setItem(STORAGE_KEY, large ? 'large' : 'small')
  listeners.forEach((listener) => listener())
}

export function subscribeChatSize(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
