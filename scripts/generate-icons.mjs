// Génère les icônes PNG (écran d'accueil iOS, manifeste Android) à partir du
// dessin de public/icon.svg, sans dépendance externe : rastérisation maison
// (suréchantillonnage pour l'anti-aliasing) puis encodage PNG via zlib intégré.
// Lancé automatiquement avant `vite build` (script npm `prebuild`).
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// Géométrie du dessin, dans le repère 100×100 de icon.svg.
const BG = [30, 27, 46] // #1e1b2e
const ARC = [167, 139, 250] // #a78bfa
const NEEDLE = [249, 115, 22] // #f97316
const C = { x: 50, y: 72 } // centre du cadran
const R = 35 // rayon de l'arc
const HALF = 3 // demi-épaisseur des traits (stroke-width 6)
const TIP = { x: 67, y: 42 } // pointe de l'aiguille
const HUB = 6 // rayon du point central
const SS = 4 // facteur de suréchantillonnage (anti-aliasing)

const hypot = (dx, dy) => Math.sqrt(dx * dx + dy * dy)

// Distance d'un point au segment [A,B] (pour le trait de l'aiguille, capuchons ronds).
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Distance d'un point à l'arc supérieur (centré sur C, rayon R, capuchons ronds
// aux extrémités gauche/droite situées au niveau du diamètre).
function distToArc(px, py) {
  const dx = px - C.x
  const dy = py - C.y
  if (dy <= 0) return Math.abs(hypot(dx, dy) - R)
  return Math.min(hypot(px - (C.x - R), py - C.y), hypot(px - (C.x + R), py - C.y))
}

// Couleur (opaque) du point (vx, vy) du dessin : fond, puis arc, puis aiguille.
function sample(vx, vy) {
  let color = BG
  if (distToArc(vx, vy) <= HALF) color = ARC
  if (distToSegment(vx, vy, C.x, C.y, TIP.x, TIP.y) <= HALF) color = NEEDLE
  if (hypot(vx - C.x, vy - C.y) <= HUB) color = NEEDLE
  return color
}

function renderRGBA(size) {
  const data = Buffer.alloc(size * size * 4)
  const scale = 100 / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) * scale, (py + (sy + 0.5) / SS) * scale)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = SS * SS
      const i = (py * size + px) * 4
      data[i] = Math.round(r / n)
      data[i + 1] = Math.round(g / n)
      data[i + 2] = Math.round(b / n)
      data[i + 3] = 255
    }
  }
  return data
}

// --- Encodage PNG (truecolor + alpha, 8 bits) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // octets 10-12 : compression / filtre / entrelacement = 0
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // type de filtre « None »
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const TARGETS = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

for (const [name, size] of TARGETS) {
  writeFileSync(join(PUBLIC_DIR, name), encodePNG(size, renderRGBA(size)))
  console.log(`icône générée : ${name} (${size}×${size})`)
}
