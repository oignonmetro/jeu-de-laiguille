import { ref, set, update, get, onValue, runTransaction, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import { generateRoomCode } from './codes'
import { AppError } from './errors'
import {
  assignRounds,
  buildConsensusTurns,
  buildTurns,
  computeScore,
  mergeSpectra,
  pickDifferentSpectrum,
  randomAngle,
  MAX_REROLLS,
} from './logic'

// Une salle sans aucune action de jeu (cf. lastActivityAt, mis à jour par
// toutes les fonctions ci-dessous qui font progresser la partie) pendant ce
// délai est considérée abandonnée et peut être supprimée.
const ROOM_INACTIVITY_MS = 15 * 60 * 1000

export async function createRoom(playerId, playerName) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode()
    const roomRef = ref(db, `rooms/${roomCode}`)
    const snapshot = await get(roomRef)
    // Un code déjà pris mais dont la salle est inactive est libéré et réutilisé.
    if (snapshot.exists() && !(await cleanupIfInactive(roomCode))) continue

    await set(roomRef, {
      createdAt: serverTimestamp(),
      lastActivityAt: Date.now(),
      hostId: playerId,
      status: 'lobby',
      players: {
        [playerId]: { name: playerName },
      },
      order: [playerId],
      score: 0,
    })
    return roomCode
  }
  throw new AppError("Impossible de générer un code de salle, réessayez.")
}

export async function joinRoom(roomCode, playerId, playerName) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new AppError("Cette salle n'existe pas.")
  }
  if (await cleanupIfInactive(roomCode)) {
    throw new AppError("Cette salle n'existe pas.")
  }
  const room = snapshot.val()
  if (room.players?.[playerId]) {
    return
  }
  if (room.status !== 'lobby') {
    throw new AppError('La partie a déjà commencé.')
  }
  const order = [...(room.order || []), playerId]
  await update(roomRef, {
    [`players/${playerId}`]: { name: playerName },
    order,
    lastActivityAt: Date.now(),
  })
}

// Supprime la salle si elle est inactive depuis plus de ROOM_INACTIVITY_MS.
// Transaction : sans danger en cas d'appel concurrent (relit l'état le plus
// récent avant de décider), et sert aussi bien à libérer un code de salle
// abandonné (createRoom) qu'à nettoyer la base (joinRoom, vérification
// périodique côté client dans App).
export async function cleanupIfInactive(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  let deleted = false
  let firstAttempt = true
  await runTransaction(roomRef, (room) => {
    // Sans listener déjà actif sur ce chemin, le SDK appelle cette fonction
    // une première fois avec `room === null` (valeur locale inconnue) avant
    // de retenter avec la vraie valeur du serveur : on renvoie `null` pour
    // déclencher cette nouvelle tentative plutôt que d'abandonner à tort en
    // pensant que la salle n'existe pas.
    if (room === null && firstAttempt) {
      firstAttempt = false
      return null
    }
    if (!room) return undefined
    const lastActivity = room.lastActivityAt ?? room.createdAt ?? 0
    if (Date.now() - lastActivity < ROOM_INACTIVITY_MS) return undefined
    deleted = true
    return null
  })
  return deleted
}

export function subscribeRoom(roomCode, callback) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  return onValue(roomRef, (snapshot) => callback(snapshot.val()))
}

// Quitte la salle depuis le lobby : retire le joueur, transmet l'hôte au
// joueur suivant si besoin, supprime la salle si elle se vide. En cours de
// partie on ne touche pas à la salle (le joueur peut revenir avec le code).
export async function leaveRoom(roomCode, playerId) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  await runTransaction(roomRef, (room) => {
    if (!room || room.status !== 'lobby' || !room.players?.[playerId]) return room
    delete room.players[playerId]
    room.order = (room.order || []).filter((id) => id !== playerId)
    if (room.order.length === 0) return null
    if (room.hostId === playerId) room.hostId = room.order[0]
    room.lastActivityAt = Date.now()
    return room
  })
}

// Ajoute / retire un pack de la sélection de la partie. Plusieurs packs
// peuvent être sélectionnés : leurs spectres seront fusionnés au démarrage.
export async function addPack(roomCode, pack) {
  await update(ref(db, `rooms/${roomCode}`), {
    [`packs/${pack.id}`]: { name: pack.name, spectra: pack.spectra },
    lastActivityAt: Date.now(),
  })
}

export async function removePack(roomCode, packId) {
  await update(ref(db, `rooms/${roomCode}`), {
    [`packs/${packId}`]: null,
    lastActivityAt: Date.now(),
  })
}

// Choisit le mode de devinette pour les parties à 3 joueurs ou plus :
// 'solo' (un joueur devine à chaque tour) ou 'consensus' (tous les joueurs
// sauf l'auteur de l'indice doivent se mettre d'accord).
export async function setGuessMode(roomCode, mode) {
  await update(ref(db, `rooms/${roomCode}`), {
    guessMode: mode,
    lastActivityAt: Date.now(),
  })
}

export async function startGame(roomCode, room) {
  const order = room.order
  const packs = Object.values(room.packs || {})
  const spectra = mergeSpectra(packs)
  const rounds = assignRounds(spectra, order)

  await update(ref(db, `rooms/${roomCode}`), {
    status: 'clue-writing',
    pack: {
      name: packs.map((p) => p.name).join(' + '),
      spectra,
    },
    rounds,
    results: null,
    lastActivityAt: Date.now(),
  })
}

export async function submitClue(roomCode, playerId, roundIndex, clue) {
  await update(ref(db, `rooms/${roomCode}`), {
    [`rounds/${playerId}/${roundIndex}/clue`]: clue,
    lastActivityAt: Date.now(),
  })
}

export async function setRoundReady(roomCode, playerId, roundIndex, ready) {
  await update(ref(db, `rooms/${roomCode}`), {
    [`rounds/${playerId}/${roundIndex}/ready`]: ready,
    lastActivityAt: Date.now(),
  })
}

// Change le spectre d'un indice à écrire (au plus MAX_REROLLS fois par
// indice), ainsi que la position de la palette. Le nouveau spectre évite
// tous ceux déjà attribués au joueur dans cette partie, y compris ceux
// écartés par ses rerolls précédents (pastSpectra). Transaction sur les
// manches du joueur pour que le compteur reste fiable même en cas de
// double clic.
export async function rerollSpectrum(roomCode, playerId, roundIndex, spectraCount) {
  const roundsRef = ref(db, `rooms/${roomCode}/rounds/${playerId}`)
  await runTransaction(roundsRef, (rounds) => {
    const round = rounds?.[roundIndex]
    if (!round || round.ready) return rounds
    if ((round.rerolls || 0) >= MAX_REROLLS) return rounds
    const used = rounds.flatMap((r) => [r.spectrumIndex, ...(r.pastSpectra || [])])
    round.pastSpectra = [...(round.pastSpectra || []), round.spectrumIndex]
    round.spectrumIndex = pickDifferentSpectrum(spectraCount, round.spectrumIndex, used)
    round.needleAngle = randomAngle()
    round.rerolls = (round.rerolls || 0) + 1
    return rounds
  })
}

// Position de l'aiguille du devineur, diffusée en direct aux autres joueurs
// pendant qu'il hésite. Écriture légère, throttlée côté client.
export async function setLiveAngle(roomCode, angle) {
  await update(ref(db, `rooms/${roomCode}`), {
    liveAngle: angle,
    lastActivityAt: Date.now(),
  })
}

// Mode "Consensus" : position proposée, diffusée en direct comme setLiveAngle.
// Tout déplacement remet à zéro les accords déjà donnés, puisqu'ils portaient
// sur l'ancienne position.
export async function setConsensusAngle(roomCode, angle) {
  await update(ref(db, `rooms/${roomCode}`), {
    liveAngle: angle,
    consensusAgreements: null,
    lastActivityAt: Date.now(),
  })
}

// Mode "Consensus" : enregistre l'accord d'un joueur sur la position actuelle
// de l'aiguille, sur sa propre clé (jamais de conflit entre joueurs, donc pas
// besoin de transaction). La validation finale est déclenchée séparément par
// finalizeConsensus dès que tout le monde a donné son accord.
export async function agreeOnConsensus(roomCode, playerId) {
  await update(ref(db, `rooms/${roomCode}`), {
    [`consensusAgreements/${playerId}`]: true,
    lastActivityAt: Date.now(),
  })
}

// Mode "Consensus" : calcule le score et passe le tour en "reveal" une fois
// que tous les joueurs concernés ont donné leur accord. Appelée côté client
// par tous les joueurs concernés dès que la condition est remplie : le
// résultat étant déterministe, des écritures concurrentes convergent vers le
// même état (pas besoin de transaction).
export async function finalizeConsensus(roomCode, params) {
  const { sourceId, roundIndex, needleAngle, guessedAngle, spectrumIndex, clue, currentScore } = params
  const score = computeScore(needleAngle, guessedAngle)
  await update(ref(db, `rooms/${roomCode}`), {
    [`results/${sourceId}/${roundIndex}`]: {
      spectrumIndex,
      clue,
      actualAngle: needleAngle,
      guessedAngle,
      score,
    },
    score: (currentScore || 0) + score,
    turnPhase: 'reveal',
    lastActivityAt: Date.now(),
  })
}

// Fait avancer la salle de "clue-writing" à "guessing" si tous les indices
// sont prêts, et construit la liste des tours de devinette. Utilise une
// transaction pour qu'un seul client effectue le changement même si
// plusieurs joueurs le détectent en même temps.
export async function tryAdvanceToGuessing(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  await runTransaction(roomRef, (room) => {
    if (!room || room.status !== 'clue-writing') return room
    const allReady = room.order.every((playerId) =>
      (room.rounds?.[playerId] || []).every((round) => round.ready)
    )
    if (!allReady) return room
    room.status = 'guessing'
    room.turns = room.guessMode === 'consensus' ? buildConsensusTurns(room.order) : buildTurns(room.order)
    room.currentTurn = 0
    room.turnPhase = 'guessing'
    room.liveAngle = 90
    room.consensusAgreements = null
    room.lastActivityAt = Date.now()
    return room
  })
}

// Valide la réponse du devineur pour le tour courant : calcule le score,
// l'ajoute au score commun de l'équipe et passe le tour en phase "reveal"
// (tout le monde voit la position réelle et les points gagnés).
export async function submitTurnGuess(roomCode, turnIndex, guessedAngle) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  await runTransaction(roomRef, (room) => {
    if (!room || room.status !== 'guessing') return room
    if (room.turnPhase !== 'guessing' || room.currentTurn !== turnIndex) return room

    const turn = room.turns[turnIndex]
    const round = room.rounds[turn.sourceId][turn.roundIndex]
    const score = computeScore(round.needleAngle, guessedAngle)

    if (!room.results) room.results = {}
    if (!room.results[turn.guesserId]) room.results[turn.guesserId] = []
    room.results[turn.guesserId][turn.roundIndex] = {
      sourceId: turn.sourceId,
      spectrumIndex: round.spectrumIndex,
      clue: round.clue,
      actualAngle: round.needleAngle,
      guessedAngle,
      score,
    }
    room.score = (room.score || 0) + score
    room.liveAngle = guessedAngle
    room.turnPhase = 'reveal'
    room.lastActivityAt = Date.now()
    return room
  })
}

// Passe au tour suivant après le "reveal", ou termine la partie après le
// dernier tour. Protégé par transaction.
export async function advanceTurn(roomCode, turnIndex) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  await runTransaction(roomRef, (room) => {
    if (!room || room.status !== 'guessing') return room
    if (room.turnPhase !== 'reveal' || room.currentTurn !== turnIndex) return room
    if (turnIndex + 1 >= room.turns.length) {
      room.status = 'results'
      room.turnPhase = null
      room.liveAngle = null
    } else {
      room.currentTurn = turnIndex + 1
      room.turnPhase = 'guessing'
      room.liveAngle = 90
    }
    room.consensusAgreements = null
    room.lastActivityAt = Date.now()
    return room
  })
}

// Relance une nouvelle partie dans la même salle (mêmes joueurs, score remis à zéro).
export async function playAgain(roomCode) {
  await update(ref(db, `rooms/${roomCode}`), {
    status: 'lobby',
    rounds: null,
    results: null,
    turns: null,
    currentTurn: null,
    turnPhase: null,
    liveAngle: null,
    consensusAgreements: null,
    score: 0,
    lastActivityAt: Date.now(),
  })
}
