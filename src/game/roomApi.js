import { ref, set, update, get, onValue, runTransaction, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import { generateRoomCode } from './codes'
import {
  assignRounds,
  buildTurns,
  computeScore,
  mergeSpectra,
  pickDifferentSpectrum,
  MAX_REROLLS,
} from './logic'

export async function createRoom(playerId, playerName) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode()
    const roomRef = ref(db, `rooms/${roomCode}`)
    const snapshot = await get(roomRef)
    if (snapshot.exists()) continue

    await set(roomRef, {
      createdAt: serverTimestamp(),
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
  throw new Error("Impossible de générer un code de salle, réessayez.")
}

export async function joinRoom(roomCode, playerId, playerName) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) {
    throw new Error("Cette salle n'existe pas.")
  }
  const room = snapshot.val()
  if (room.players?.[playerId]) {
    return
  }
  if (room.status !== 'lobby') {
    throw new Error('La partie a déjà commencé.')
  }
  const order = [...(room.order || []), playerId]
  await update(roomRef, {
    [`players/${playerId}`]: { name: playerName },
    order,
  })
}

export function subscribeRoom(roomCode, callback) {
  const roomRef = ref(db, `rooms/${roomCode}`)
  return onValue(roomRef, (snapshot) => callback(snapshot.val()))
}

// Ajoute / retire un pack de la sélection de la partie. Plusieurs packs
// peuvent être sélectionnés : leurs spectres seront fusionnés au démarrage.
export async function addPack(roomCode, pack) {
  await set(ref(db, `rooms/${roomCode}/packs/${pack.id}`), {
    name: pack.name,
    spectra: pack.spectra,
  })
}

export async function removePack(roomCode, packId) {
  await set(ref(db, `rooms/${roomCode}/packs/${packId}`), null)
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
  })
}

export async function submitClue(roomCode, playerId, roundIndex, clue) {
  await update(ref(db, `rooms/${roomCode}/rounds/${playerId}/${roundIndex}`), { clue })
}

export async function setRoundReady(roomCode, playerId, roundIndex, ready) {
  await update(ref(db, `rooms/${roomCode}/rounds/${playerId}/${roundIndex}`), { ready })
}

// Change le spectre d'un indice à écrire (au plus MAX_REROLLS fois par
// indice). Transaction sur la manche pour que le compteur reste fiable
// même en cas de double clic.
export async function rerollSpectrum(roomCode, playerId, roundIndex, spectraCount) {
  const roundRef = ref(db, `rooms/${roomCode}/rounds/${playerId}/${roundIndex}`)
  await runTransaction(roundRef, (round) => {
    if (!round || round.ready) return round
    if ((round.rerolls || 0) >= MAX_REROLLS) return round
    round.spectrumIndex = pickDifferentSpectrum(spectraCount, round.spectrumIndex)
    round.rerolls = (round.rerolls || 0) + 1
    return round
  })
}

// Position de l'aiguille du devineur, diffusée en direct aux autres joueurs
// pendant qu'il hésite. Écriture légère (un seul nombre), throttlée côté client.
export async function setLiveAngle(roomCode, angle) {
  await set(ref(db, `rooms/${roomCode}/liveAngle`), angle)
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
    room.turns = buildTurns(room.order)
    room.currentTurn = 0
    room.turnPhase = 'guessing'
    room.liveAngle = 90
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
    score: 0,
  })
}
