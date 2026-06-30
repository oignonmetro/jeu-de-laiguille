// Préférence locale (par appareil) : afficher ou masquer le bouton du chat.
// Affiché par défaut. Un petit système d'abonnés permet aux composants de
// réagir au changement dans le même onglet (localStorage seul ne déclenche pas
// de rendu).
const STORAGE_KEY = 'demi-cercle:chat-hidden'
const listeners = new Set()

export function isChatVisible() {
  return localStorage.getItem(STORAGE_KEY) !== 'hidden'
}

export function setChatVisible(visible) {
  localStorage.setItem(STORAGE_KEY, visible ? 'shown' : 'hidden')
  listeners.forEach((listener) => listener())
}

export function subscribeChatVisibility(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
