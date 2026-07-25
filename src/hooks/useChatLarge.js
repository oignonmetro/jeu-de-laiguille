import { useSyncExternalStore } from 'react'
import { isChatLarge, subscribeChatSize } from '../utils/chatSize'

// Suit la préférence de taille du panneau de chat et redéclenche un rendu
// quand elle change (par exemple depuis les paramètres).
export function useChatLarge() {
  return useSyncExternalStore(subscribeChatSize, isChatLarge)
}
