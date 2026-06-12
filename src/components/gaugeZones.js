// Zones qualitatives de la jauge de score, de la pire (à gauche) à la
// meilleure (à droite), comme sur un cadran de score.
export const GAUGE_ZONES = [
  { label: 'Aïe', color: '#e07856' },
  { label: 'OK', color: '#d9a542' },
  { label: 'Pas mal.', color: '#e3a6ab' },
  { label: 'Bien', color: '#f0c9ce' },
  { label: 'Super', color: '#cfe3c0' },
  { label: 'Waouh !', color: '#b5d9a8' },
]

// Verdict qualitatif (libellé + couleur de zone) pour un score donné,
// utilisé en grand sur l'écran de finale.
export function getGaugeVerdict(score, maxScore) {
  const ratio = maxScore > 0 ? Math.max(0, Math.min(1, score / maxScore)) : 0
  const index = Math.min(
    GAUGE_ZONES.length - 1,
    Math.max(0, Math.floor(ratio * GAUGE_ZONES.length))
  )
  return { label: GAUGE_ZONES[index].label, color: GAUGE_ZONES[index].color }
}
