import { AppError } from '../game/errors'

// Les photos vivent dans la base temps réel (pas de Firebase Storage), donc on
// les recompresse fortement côté téléphone avant l'envoi : une photo brute fait
// 2 à 5 Mo, on vise quelques dizaines de Ko. Le résultat est une data URL JPEG.
const MAX_DIMENSION = 1000
const START_QUALITY = 0.7
const MIN_QUALITY = 0.35
const QUALITY_STEP = 0.15
// Plafond de la data URL envoyée (en caractères ≈ octets pour de l'ASCII).
export const MAX_PHOTO_BYTES = 300 * 1024

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new AppError("Cette image n'a pas pu être lue."))
    }
    // Les navigateurs actuels appliquent l'orientation EXIF par défaut, y
    // compris pour drawImage : une photo prise à la verticale reste droite.
    img.src = url
  })
}

export async function compressImage(file) {
  if (!file.type?.startsWith('image/')) {
    throw new AppError('Choisis une image.')
  }
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

  // On baisse la qualité par paliers tant que l'image dépasse le plafond.
  let quality = START_QUALITY
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > MAX_PHOTO_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  if (dataUrl.length > MAX_PHOTO_BYTES) {
    throw new AppError('Cette photo est trop lourde, essaies-en une autre.')
  }
  return dataUrl
}
