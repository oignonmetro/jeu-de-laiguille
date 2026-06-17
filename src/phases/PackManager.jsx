import { useState } from 'react'
import { savePack, loadPack, updatePack } from '../game/packApi'
import { AppHeader } from '../components/SettingsMenu'
import { addCustomPackRef, getCustomPackRefs, removeCustomPackRef } from '../game/customPacks'
import { userMessage } from '../game/errors'

const EMPTY_ROW = () => ({ left: '', right: '' })

export function PackManager({ onBack }) {
  const [packs, setPacks] = useState(getCustomPackRefs())
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [spectra, setSpectra] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
  const [joinCode, setJoinCode] = useState('')
  const [savedCode, setSavedCode] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const updateSpectrum = (index, side, value) => {
    setSpectra((prev) => prev.map((s, i) => (i === index ? { ...s, [side]: value } : s)))
  }

  const addSpectrumRow = () => setSpectra((prev) => [...prev, EMPTY_ROW()])
  const removeSpectrumRow = (index) => setSpectra((prev) => prev.filter((_, i) => i !== index))

  const handleStartCreate = () => {
    setEditingId(null)
    setName('')
    setSpectra([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
    setSavedCode(null)
    setNotice('')
    setError('')
    setCreating(true)
  }

  const handleEdit = async (id) => {
    setBusy(true)
    setError('')
    setSavedCode(null)
    setNotice('')
    try {
      const pack = await loadPack(id)
      setName(pack.name)
      setSpectra(pack.spectra.map((s) => ({ left: s.left, right: s.right })))
      setEditingId(id)
      setCreating(true)
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    setCreating(false)
    setEditingId(null)
    setName('')
    setSpectra([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
    setError('')
  }

  const handleSave = async () => {
    const valid = spectra
      .map((s) => ({ left: s.left.trim(), right: s.right.trim() }))
      .filter((s) => s.left && s.right)

    if (!name.trim()) {
      setError('Donne un nom à ton pack.')
      return
    }
    if (valid.length < 3) {
      setError('Ajoute au moins 3 spectres complets (gauche + droite).')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editingId) {
        await updatePack(editingId, name.trim(), valid)
        addCustomPackRef(editingId, name.trim())
        setPacks(getCustomPackRefs())
        setNotice('Pack mis à jour !')
      } else {
        const code = await savePack(name.trim(), valid)
        addCustomPackRef(code, name.trim())
        setPacks(getCustomPackRefs())
        setSavedCode(code)
      }
      setCreating(false)
      setEditingId(null)
      setName('')
      setSpectra([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setBusy(true)
    setError('')
    try {
      const pack = await loadPack(joinCode)
      addCustomPackRef(pack.id, pack.name)
      setPacks(getCustomPackRefs())
      setJoinCode('')
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = (id) => {
    removeCustomPackRef(id)
    setPacks(getCustomPackRefs())
  }

  return (
    <div className="app">
      <AppHeader>
        <button className="btn btn--ghost btn--small" onClick={onBack}>
          ← Retour
        </button>
        <h1 className="app__title">Mes packs</h1>
      </AppHeader>

      {savedCode && (
        <div className="card">
          <p>Pack créé ! Partage ce code à tes amis pour qu&apos;ils le rejoignent :</p>
          <p className="code-display">{savedCode}</p>
        </div>
      )}

      {notice && (
        <div className="card">
          <p>{notice}</p>
        </div>
      )}

      <div className="card">
        <h2>Packs personnalisés</h2>
        {packs.length === 0 && (
          <p className="text-muted">Aucun pack personnalisé pour l&apos;instant.</p>
        )}
        {packs.length > 0 && (
          <ul className="pack-list">
            {packs.map((p) => (
              <li key={p.id} className="pack-list__item">
                <div className="pack-list__item-info">
                  <span>{p.name}</span>
                  <span className="code-pill">{p.id}</span>
                </div>
                <div className="pack-list__item-actions">
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={() => handleEdit(p.id)}
                    disabled={busy}
                  >
                    Modifier
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={() => handleRemove(p.id)}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card field">
        <label htmlFor="pack-code">Rejoindre un pack avec un code</label>
        <input
          id="pack-code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Ex. AB12CD"
          maxLength={6}
        />
        <button className="btn btn--secondary" onClick={handleJoin} disabled={busy}>
          Ajouter ce pack
        </button>
      </div>

      {!creating && (
        <button className="btn" onClick={handleStartCreate}>
          + Créer un pack
        </button>
      )}

      {creating && (
        <div className="card field">
          <h2>{editingId ? 'Modifier le pack' : 'Créer un pack'}</h2>
          <label htmlFor="pack-name">Nom du pack</label>
          <input
            id="pack-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Soirée entre potes"
            maxLength={30}
          />

          {spectra.map((s, i) => (
            <div className="spectrum-row" key={i}>
              <input
                value={s.left}
                onChange={(e) => updateSpectrum(i, 'left', e.target.value)}
                placeholder="Gauche (X)"
                maxLength={40}
              />
              <input
                value={s.right}
                onChange={(e) => updateSpectrum(i, 'right', e.target.value)}
                placeholder="Droite (non-X)"
                maxLength={40}
              />
              {spectra.length > 3 && (
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() => removeSpectrumRow(i)}
                  aria-label="Supprimer ce spectre"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button className="btn btn--secondary" onClick={addSpectrumRow}>
            + Ajouter un spectre
          </button>
          <button className="btn" onClick={handleSave} disabled={busy}>
            {editingId ? 'Enregistrer les modifications' : 'Enregistrer le pack'}
          </button>
          <button className="btn btn--ghost" onClick={handleCancel} disabled={busy}>
            Annuler
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
