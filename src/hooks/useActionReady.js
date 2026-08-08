import { useEffect, useState } from 'react'

// Délai de grâce avant qu'un bouton d'action décisive (valider un indice,
// donner son accord, passer au tour suivant...) ne devienne cliquable, à
// chaque fois que les dépendances passées changent (typiquement l'arrivée
// sur un nouvel écran). Évite qu'un clic resté « en vol » au moment où
// Firebase pousse un nouvel état chez un joueur — parce qu'un autre vient
// de faire avancer la partie — n'atterrisse par accident sur le nouveau
// bouton, qui occupe souvent la même position à l'écran que l'ancien.
const GRACE_MS = 400

export function useActionReady(deps) {
  // L'état ne porte que la clé pour laquelle le délai est écoulé : pas
  // besoin de le remettre à `false` explicitement au changement de
  // dépendances (setState synchrone dans un effet, à éviter), la valeur
  // retournée est simplement "pas prêt" tant que la clé ne correspond pas.
  const key = JSON.stringify(deps)
  const [readyKey, setReadyKey] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setReadyKey(key), GRACE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return readyKey === key
}
