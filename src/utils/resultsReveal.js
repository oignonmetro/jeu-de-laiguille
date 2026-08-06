// Préférence locale (par appareil) : sauter la cinématique de révélation
// manche par manche des résultats (mode Consensus) pour aller directement à
// l'écran de score final — le même effet que le bouton « Passer », mais
// appliqué automatiquement dès l'arrivée sur l'écran de résultats. Activé
// par défaut : l'absence de préférence stockée vaut "on", il faut désactiver
// explicitement pour revoir la cinématique manche par manche.
const STORAGE_KEY = 'demi-cercle:skip-reveal'

export function isRevealSkipped() {
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setRevealSkipped(skip) {
  localStorage.setItem(STORAGE_KEY, skip ? 'on' : 'off')
}
