import { useRef, useState } from 'react'
import { Semicircle } from '../components/Semicircle'
import { AppHeader } from '../components/SettingsMenu'
import { submitClue, setRoundReady, tryAdvanceToGuessing, rerollSpectrum } from '../game/roomApi'
import { savePhoto } from '../game/photoApi'
import { userMessage } from '../game/errors'
import { compressImage } from '../utils/photo'
import { MAX_REROLLS } from '../game/logic'

export function ClueWriting({ roomCode, room, playerId }) {
  const myRounds = room.rounds[playerId]
  const startIndex = myRounds.findIndex((r) => !r.ready)
  const [index, setIndex] = useState(startIndex === -1 ? 0 : startIndex)
  const [draft, setDraft] = useState(myRounds[startIndex === -1 ? 0 : startIndex]?.clue || '')
  const [busy, setBusy] = useState(false)
  // Photo choisie pour la manche en cours (déjà compressée, pas encore
  // envoyée : l'envoi a lieu à la validation, avec le reste de l'indice).
  const [photo, setPhoto] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef(null)
  const photoAllowed = Boolean(room.photoClues)

  const allReady = myRounds.every((r) => r.ready)

  if (allReady) {
    const readyCount = room.order.filter((id) => room.rounds[id].every((r) => r.ready)).length
    return (
      <div className="app">
        <AppHeader>
          <h1 className="app__title">Indices envoyés !</h1>
        </AppHeader>
        <div className="card">
          <p className="text-muted">
            En attente des autres joueurs ({readyCount}/{room.order.length})...
          </p>
          <ul className="player-list">
            {room.order.map((id) => {
              const rounds = room.rounds[id]
              const done = rounds.filter((r) => r.ready).length
              const finished = done === rounds.length
              return (
                <li key={id} className="score-row">
                  <span className="score-row__name">{room.players[id].name}</span>
                  <span>{finished ? '✅' : `${done}/${rounds.length}`}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  const round = myRounds[index]
  const spectrum = room.pack.spectra[round.spectrumIndex]
  const isLast = index === myRounds.length - 1
  const rerollsLeft = MAX_REROLLS - (round.rerolls || 0)

  const handleReroll = async () => {
    setBusy(true)
    try {
      await rerollSpectrum(roomCode, playerId, index, room.pack.spectra.length)
    } finally {
      setBusy(false)
    }
  }

  // La photo est redimensionnée et recompressée sur le téléphone avant tout
  // envoi (une photo brute pèse plusieurs Mo, cf. utils/photo).
  const handlePickPhoto = async (event) => {
    const file = event.target.files?.[0]
    // Réinitialise l'input pour pouvoir re-choisir le même fichier ensuite.
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    setBusy(true)
    try {
      setPhoto(await compressImage(file))
    } catch (err) {
      setPhotoError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleNext = async () => {
    const clue = draft.trim()
    setBusy(true)
    setPhotoError('')
    try {
      if (photo) await savePhoto(roomCode, playerId, index, photo)
      await submitClue(roomCode, playerId, index, clue, Boolean(photo))
      await setRoundReady(roomCode, playerId, index, true)
      if (!isLast) {
        const next = index + 1
        setIndex(next)
        setDraft(myRounds[next]?.clue || '')
        setPhoto(null)
      } else {
        await tryAdvanceToGuessing(roomCode)
      }
    } catch (err) {
      setPhotoError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <AppHeader>
        <h1 className="app__title">Écris ton indice</h1>
        <span className="progress-pill">
          {index + 1} / {myRounds.length}
        </span>
      </AppHeader>

      <div className="card">
        <Semicircle spectrum={spectrum} mode="display" angle={round.needleAngle} />
        <button
          className="btn btn--ghost btn--small reroll-btn"
          onClick={handleReroll}
          disabled={busy || rerollsLeft === 0}
        >
          🎲 Changer de spectre ({rerollsLeft})
        </button>
      </div>

      <div className="card field">
        <label htmlFor="clue">
          {photoAllowed ? 'Ton indice (texte, photo, ou les deux)' : 'Ton indice'}
        </label>
        <input
          id="clue"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          autoFocus
        />

        {photoAllowed && (
          <>
            {photo && (
              <div className="clue-photo-preview">
                <img src={photo} alt="Aperçu de la photo choisie" />
              </div>
            )}
            {/* Sans attribut `capture` : le téléphone laisse le choix entre
                l'appareil photo et la galerie. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={handlePickPhoto}
            />
            <div className="clue-photo-actions">
              <button
                className="btn btn--ghost btn--small"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {photo ? '🔄 Changer la photo' : '📷 Ajouter une photo'}
              </button>
              {photo && (
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() => setPhoto(null)}
                  disabled={busy}
                >
                  Retirer
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {photoError && <p className="error">{photoError}</p>}

      <button className="btn" onClick={handleNext} disabled={busy || (!draft.trim() && !photo)}>
        {isLast ? 'Valider mes indices' : 'Suivant'}
      </button>
    </div>
  )
}
