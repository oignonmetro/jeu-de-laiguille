import './Confetti.css'

const PIECE_COUNT = 16
const COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-needle)',
]

// Particules tirées une fois au chargement du module (le rendu doit rester
// pur) : positions, délais et rotations aléatoires.
const PIECES = Array.from({ length: PIECE_COUNT }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  color: COLORS[i % COLORS.length],
  delay: `${Math.random() * 0.6}s`,
  duration: `${1.4 + Math.random() * 1.2}s`,
  spin: `${(Math.random() * 2 - 1) * 540}deg`,
}))

// Petite salve de confettis en CSS pur, jouée une seule fois.
// Le conteneur est absolu : le parent doit être en position: relative.
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti__piece"
          style={{
            left: p.left,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            '--confetti-spin': p.spin,
          }}
        />
      ))}
    </div>
  )
}
