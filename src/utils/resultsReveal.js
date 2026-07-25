// Préférence locale (par appareil) : sauter la cinématique de révélation
// manche par manche des résultats (mode Consensus) pour aller directement à
// l'écran de score final — le même effet que le bouton « Passer », mais
// appliqué automatiquement dès l'arrivée sur l'écran de résultats.
const STORAGE_KEY = 'demi-cercle:skip-reveal'

export function isRevealSkipped() {
  return localStorage.getItem(STORAGE_KEY) === 'on'
}

export function setRevealSkipped(skip) {
  localStorage.setItem(STORAGE_KEY, skip ? 'on' : 'off')
}
