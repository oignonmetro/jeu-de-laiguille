// Logique pure du jeu : tirage des aiguilles, calcul des scores,
// répartition des spectres et rotation des devinettes.

const ROUNDS_PER_PLAYER = 3

// Nombre de changements de spectre autorisés par indice à écrire.
export const MAX_REROLLS = 3

// Mélange Fisher-Yates (ne modifie pas le tableau d'origine)
function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Demi-largeur de la palette de score (zones 2|3|4|3|2, 9° chacune).
export const PALETTE_HALF_WIDTH = 22.5
export const PALETTE_ZONES = [
  { from: -22.5, to: -13.5, points: 2 },
  { from: -13.5, to: -4.5, points: 3 },
  { from: -4.5, to: 4.5, points: 4 },
  { from: 4.5, to: 13.5, points: 3 },
  { from: 13.5, to: 22.5, points: 2 },
]

// Centre de palette entre 22,5° et 157,5° pour que les 45° de la palette
// restent entièrement sur le demi-cercle.
export function randomAngle() {
  return Math.random() * 135 + 22.5
}

// Points (0 à 4) selon la zone de la palette où tombe l'aiguille devinée.
// En dehors de la palette : 0 point.
export function computeScore(targetAngle, guessedAngle) {
  const diff = Math.abs(targetAngle - guessedAngle)
  if (diff <= 4.5) return 4
  if (diff <= 13.5) return 3
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

// Attribue 3 spectres + une position d'aiguille à chaque joueur, sans
// jamais donner deux fois le même spectre à un même joueur.
export function assignRounds(spectra, playerIds) {
  const baseIndices = spectra.map((_, i) => i)
  let pool = shuffle(baseIndices)

  const assignments = {}
  playerIds.forEach((playerId) => {
    const mine = []
    while (mine.length < ROUNDS_PER_PLAYER) {
      let idx = pool.findIndex((s) => !mine.includes(s))
      if (idx === -1) {
        pool = shuffle(baseIndices)
        idx = pool.findIndex((s) => !mine.includes(s))
        if (idx === -1) idx = 0 // moins de spectres que de manches : doublon inévitable
      }
      mine.push(pool.splice(idx, 1)[0])
    }
    assignments[playerId] = mine.map((spectrumIndex) => ({
      spectrumIndex,
      needleAngle: randomAngle(),
      clue: '',
      ready: false,
      rerolls: 0,
    }))
  })
  return assignments
}

// Tire un nouveau spectre, différent du spectre actuel et de ceux à exclure
// (les spectres déjà attribués au joueur dans cette partie).
export function pickDifferentSpectrum(spectraCount, currentIndex, excluded = []) {
  const taken = new Set([currentIndex, ...excluded])
  const candidates = []
  for (let i = 0; i < spectraCount; i++) {
    if (!taken.has(i)) candidates.push(i)
  }
  if (candidates.length === 0) return currentIndex
  return candidates[Math.floor(Math.random() * candidates.length)]
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

// Mode "Consensus" : un tour par indice écrit (3 par joueur). Pas de
// devineur unique désigné — tous les joueurs sauf l'auteur de l'indice
// doivent se mettre d'accord sur une position avant validation.
export function buildConsensusTurns(order) {
  const turns = []
  for (let roundIndex = 0; roundIndex < ROUNDS_PER_PLAYER; roundIndex++) {
    order.forEach((sourceId) => {
      turns.push({ sourceId, roundIndex })
    })
  }
  return turns
}
