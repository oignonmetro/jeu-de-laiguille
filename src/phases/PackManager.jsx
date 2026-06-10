import { useState } from 'react'
import { savePack, loadPack } from '../game/packApi'
import { addCustomPackRef, getCustomPackRefs, removeCustomPackRef } from '../game/customPacks'

const EMPTY_ROW = () => ({ left: '', right: '' })

export function PackManager({ onBack }) {
  const [packs, setPacks] = useState(getCustomPackRefs())
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [spectra, setSpectra] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
  const [joinCode, setJoinCode] = useState('')
  const [savedCode, setSavedCode] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const updateSpectrum = (index, side, value) => {
    setSpectra((prev) => prev.map((s, i) => (i === index ? { ...s, [side]: value } : s)))
  }

  const addSpectrumRow = () => setSpectra((prev) => [...prev, EMPTY_ROW()])
  const removeSpectrumRow = (index) => setSpectra((prev) => prev.filter((_, i) => i !== index))

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
      const code = await savePack(name.trim(), valid)
      addCustomPackRef(code, name.trim())
      setPacks(getCustomPackRefs())
      setSavedCode(code)
      setCreating(false)
      setName('')
      setSpectra([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
    } catch (err) {
      setError(err.message)
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
      setError(err.message)
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
      <header className="app__header">
        <button className="btn btn--ghost btn--small" onClick={onBack}>
          ← Retour
        </button>
        <h1 className="app__title">Mes packs</h1>
      </header>

      {savedCode && (
        <div className="card">
          <p>Pack créé ! Partage ce code à tes amis pour qu&apos;ils le rejoignent :</p>
          <p className="code-display">{savedCode}</p>
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
                <span>{p.name}</span>
                <span className="code-pill">{p.id}</span>
                <button className="btn btn--ghost btn--small" onClick={() => handleRemove(p.id)}>
                  Retirer
                </button>
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
        <button className="btn" onClick={() => setCreating(true)}>
          + Créer un pack
        </button>
      )}

      {creating && (
        <div className="card field">
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
            Enregistrer le pack
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
