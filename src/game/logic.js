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

// Centre de palette entre 4,5° et 175,5° : la zone à 4 points (large de ±4,5°)
// reste ainsi entièrement au-dessus du diamètre quelle que soit la position de
// l'aiguille, sans jamais être rognée. Les zones 3 et 2 points peuvent encore
// déborder un peu sous la base, où elles sont masquées par le rognage.
export function randomAngle() {
  return Math.random() * 171 + 4.5
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

// Construit la liste des tours, un par indice écrit (3 par joueur), joués un
// par un devant tout le monde : manche 0 de chaque joueur (dans l'ordre), puis
// manche 1, puis manche 2. Chaque tour est identifié par l'auteur de l'indice
// (sourceId) et l'index de sa manche ; les joueurs qui devinent (tous sauf
// l'auteur) sont déterminés au moment du tour, quel que soit le mode.
export function buildClueTurns(order) {
  const turns = []
  for (let roundIndex = 0; roundIndex < ROUNDS_PER_PLAYER; roundIndex++) {
    order.forEach((sourceId) => {
      turns.push({ sourceId, roundIndex })
    })
  }
  return turns
}

// Mode de jeu effectivement appliqué. Le mode « Chacun pour soi » (scores
// individuels) n'est disponible qu'à partir de 3 joueurs ; en dessous, la
// partie se joue toujours en coopératif (Consensus), où l'unique autre joueur
// devine. Renvoie 'individual' ou 'consensus'.
export function effectiveGuessMode(room) {
  if ((room.order?.length ?? 0) < 3) return 'consensus'
  return room.guessMode === 'consensus' ? 'consensus' : 'individual'
}
