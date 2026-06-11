// Logique pure du jeu : tirage des aiguilles, calcul des scores,
// répartition des spectres et rotation des devinettes.

const ROUNDS_PER_PLAYER = 3

// Nombre de changements de spectre autorisés par indice à écrire.
export const MAX_REROLLS = 2

// Mélange Fisher-Yates (ne modifie pas le tableau d'origine)
function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Demi-largeur de la palette de score (zones 2|3|4|3|2, 7° chacune).
export const PALETTE_HALF_WIDTH = 17.5
export const PALETTE_ZONES = [
  { from: -17.5, to: -10.5, points: 2 },
  { from: -10.5, to: -3.5, points: 3 },
  { from: -3.5, to: 3.5, points: 4 },
  { from: 3.5, to: 10.5, points: 3 },
  { from: 10.5, to: 17.5, points: 2 },
]

// Centre de palette entre 18° et 162° pour que les 35° de la palette
// restent entièrement sur le demi-cercle.
export function randomAngle() {
  return Math.floor(Math.random() * 145) + 18
}

// Points (0 à 4) selon la zone de la palette où tombe l'aiguille devinée.
// En dehors de la palette : 0 point.
export function computeScore(targetAngle, guessedAngle) {
  const diff = Math.abs(targetAngle - guessedAngle)
  if (diff <= 3.5) return 4
  if (diff <= 10.5) return 3
  if (diff <= PALETTE_HALF_WIDTH) return 2
  return 0
}

// Fusionne les spectres de plusieurs packs en évitant les doublons exacts
// (un même spectre peut apparaître dans deux packs).
export function mergeSpectra(packs) {
  const seen = new Set()
  const spectra = []
  packs.forEach((pack) => {
    pack.spectra.forEach((s) => {
      const key = `${s.left}|${s.right}`
      if (seen.has(key)) return
      seen.add(key)
      spectra.push(s)
    })
  })
  return spectra
}

// Attribue 3 spectres + une position d'aiguille à chaque joueur.
export function assignRounds(spectra, playerIds) {
  const needed = playerIds.length * ROUNDS_PER_PLAYER
  const baseIndices = spectra.map((_, i) => i)

  let pool = shuffle(baseIndices)
  while (pool.length < needed) {
    pool = pool.concat(shuffle(baseIndices))
  }
  pool = pool.slice(0, needed)

  const assignments = {}
  playerIds.forEach((playerId, i) => {
    assignments[playerId] = pool
      .slice(i * ROUNDS_PER_PLAYER, (i + 1) * ROUNDS_PER_PLAYER)
      .map((spectrumIndex) => ({
        spectrumIndex,
        needleAngle: randomAngle(),
        clue: '',
        ready: false,
        rerolls: 0,
      }))
  })
  return assignments
}

// Tire un nouveau spectre, différent du spectre actuel.
export function pickDifferentSpectrum(spectraCount, currentIndex) {
  if (spectraCount < 2) return currentIndex
  const offset = Math.floor(Math.random() * (spectraCount - 1)) + 1
  return (currentIndex + offset) % spectraCount
}

// Le joueur `playerId` devine les indices écrits par le joueur précédent dans l'ordre.
export function getGuessSourceId(order, playerId) {
  const n = order.length
  const idx = order.indexOf(playerId)
  return order[(idx - 1 + n) % n]
}

// Construit la liste des tours de devinette, joués un par un devant tout le
// monde : manche 0 de chaque joueur (A devine B, B devine C, ...), puis
// manche 1, puis manche 2.
export function buildTurns(order) {
  const turns = []
  for (let roundIndex = 0; roundIndex < ROUNDS_PER_PLAYER; roundIndex++) {
    order.forEach((guesserId) => {
      turns.push({
        guesserId,
        sourceId: getGuessSourceId(order, guesserId),
        roundIndex,
      })
    })
  }
  return turns
}
