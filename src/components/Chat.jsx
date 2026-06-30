import { useEffect, useMemo, useRef, useState } from 'react'
import { playerColor } from '../game/colors'
import { sendChatMessage } from '../game/roomApi'
import { useChatVisible } from '../hooks/useChatVisible'
import './Chat.css'

// Chat de salle : bouton flottant (avec pastille de messages non lus) qui
// ouvre un panneau coulissant. Les messages vivent dans `room.chat` et sont
// donc synchronisés en temps réel comme le reste de la partie. Disponible dans
// tous les écrans tant qu'on est dans une salle (monté au niveau de App).
export function Chat({ roomCode, room, playerId }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const [unread, setUnread] = useState(0)
  const visible = useChatVisible()

  // Les clés push() sont chronologiques : un tri lexicographique suffit et
  // reste stable même quand le serverTimestamp n'est pas encore résolu.
  const messages = useMemo(() => {
    return Object.entries(room.chat || {})
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }, [room.chat])

  // Compteur de non-lus : on part du nombre de messages déjà présents au
  // montage (l'historique n'est pas « non lu »), puis on additionne ceux qui
  // arrivent pendant que le panneau est fermé. La remise à zéro se fait à
  // l'ouverture (dans le gestionnaire de clic).
  const prevCountRef = useRef(messages.length)
  useEffect(() => {
    const prev = prevCountRef.current
    if (messages.length === prev) return
    prevCountRef.current = messages.length
    if (!open && messages.length > prev) {
      setUnread((u) => u + (messages.length - prev))
    }
  }, [messages.length, open])

  // Panneau ouvert : on colle la vue au dernier message (à l'ouverture comme à
  // chaque nouveau message).
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [open, messages.length])

  const openChat = () => {
    setUnread(0)
    setOpen(true)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    setText('')
    try {
      await sendChatMessage(roomCode, playerId, room.players[playerId]?.name || '?', value)
    } catch {
      setText(value) // échec d'envoi : on restaure le texte saisi
    } finally {
      setSending(false)
    }
  }

  // Bouton masqué via les paramètres : on n'affiche rien (les hooks ci-dessus
  // continuent de tourner, donc les non-lus restent comptés si on le réaffiche).
  if (!visible) return null

  return (
    <>
      <button className="chat-fab" aria-label="Ouvrir le chat" onClick={openChat}>
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {unread > 0 && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="chat-overlay" onClick={() => setOpen(false)}>
          <div
            className="chat-panel"
            role="dialog"
            aria-label="Chat"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="chat-panel__header">
              <h2>Chat</h2>
              <button className="chat-panel__close" aria-label="Fermer" onClick={() => setOpen(false)}>
                ✕
              </button>
            </header>

            <div className="chat-messages" ref={listRef}>
              {messages.length === 0 ? (
                <p className="text-muted text-center chat-empty">
                  Aucun message. Lancez la conversation !
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.playerId === playerId
                  return (
                    <div key={m.id} className={`chat-msg${mine ? ' chat-msg--mine' : ''}`}>
                      {!mine && (
                        <span
                          className="chat-msg__name"
                          style={{ color: playerColor(room.order, m.playerId) }}
                        >
                          {m.name}
                        </span>
                      )}
                      <span className="chat-msg__bubble">{m.text}</span>
                    </div>
                  )
                })
              )}
            </div>

            <form className="chat-input" onSubmit={handleSend}>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Votre message…"
                maxLength={500}
                autoFocus
              />
              <button type="submit" className="btn btn--small" disabled={!text.trim() || sending}>
                Envoyer
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
