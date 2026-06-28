// Couleurs distinctes attribuées aux joueurs (aiguilles des devineurs et
// pastilles en mode « Chacun pour soi »), indexées par leur position dans
// l'ordre de la salle pour rester stables d'un écran à l'autre.
const PALETTE = [
  '#f97316', // orange
  '#a78bfa', // violet
  '#4ade80', // vert
  '#f472b6', // rose
  '#38bdf8', // bleu ciel
  '#facc15', // jaune
  '#fb7185', // corail
  '#2dd4bf', // turquoise
]

export function playerColor(order, playerId) {
  const i = order.indexOf(playerId)
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]
}
