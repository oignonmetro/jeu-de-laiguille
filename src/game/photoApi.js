import { ref, set, get, remove } from 'firebase/database'
import { db } from '../firebase'
import { AppError } from './errors'

// Les photos d'indice sont stockées hors du nœud de la salle, sous
// `photos/{roomCode}/{playerId}/{roundIndex}`. C'est volontaire : la salle est
// écoutée en continu (onValue sur tout le nœud) par tous les joueurs, alors
// qu'une photo n'intéresse qu'au moment où son indice est joué. On la charge
// donc à la demande, une seule fois par appareil (cache mémoire ci-dessous).
const cache = new Map()

const photoKey = (roomCode, playerId, roundIndex) => `${roomCode}/${playerId}/${roundIndex}`

export async function savePhoto(roomCode, playerId, roundIndex, dataUrl) {
  const key = photoKey(roomCode, playerId, roundIndex)
  await set(ref(db, `photos/${key}`), dataUrl)
  cache.set(key, dataUrl)
}

export async function loadPhoto(roomCode, playerId, roundIndex) {
  const key = photoKey(roomCode, playerId, roundIndex)
  if (cache.has(key)) return cache.get(key)
  const snapshot = await get(ref(db, `photos/${key}`))
  const dataUrl = snapshot.val()
  if (!dataUrl) throw new AppError('Cette photo est introuvable.')
  cache.set(key, dataUrl)
  return dataUrl
}

// Supprime toutes les photos d'une salle : appelée en même temps que la
// suppression de la salle (inactivité, dernier joueur parti) et au lancement
// d'une nouvelle partie, pour ne pas laisser d'images orphelines dans la base.
export async function deleteRoomPhotos(roomCode) {
  const prefix = `${roomCode}/`
  cache.forEach((_, key) => {
    if (key.startsWith(prefix)) cache.delete(key)
  })
  await remove(ref(db, `photos/${roomCode}`))
}
