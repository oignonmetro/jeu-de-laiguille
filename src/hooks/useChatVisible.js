import { useSyncExternalStore } from 'react'
import { isChatVisible, subscribeChatVisibility } from '../utils/chatVisibility'

// Suit la préférence d'affichage du bouton de chat et redéclenche un rendu
// quand elle change (par exemple depuis les paramètres).
export function useChatVisible() {
  return useSyncExternalStore(subscribeChatVisibility, isChatVisible)
}
