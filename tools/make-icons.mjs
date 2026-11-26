// Gera public/icons/*.png (moeda do Vision sobre roxo) sem dependências: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
const COIN = ['................', '.....kkkkkk.....', '...kkooooookk...', '..koooggggoook..', '..koobgggggook..', '.kooggggggggook.', '.koggggggggggok.', '.koggggggggggok.',
  '.koggggggggggok.', '.koggggggggggok.', '.kooggggggggook.', '..kooggggggook..', '..koooggggoook..', '...kkooooookk...', '.....kkkkkk.....', '................']
const C = { k: [58, 42, 0], o: [200, 134, 10], g: [255, 210, 63], b: [255, 243, 160] }
const BG = [20, 18, 31]
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]) }
function png(size) {
  const px = Math.floor(size / 20) // moeda ocupa 16 células com margem
  const off = Math.floor((size - px * 16) / 2)
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const cx = Math.floor((x - off) / px), cy = Math.floor((y - off) / px)
      const ch = cx >= 0 && cx < 16 && cy >= 0 && cy < 16 ? COIN[cy][cx] : '.'
      const [r, g, b] = C[ch] ?? BG
      raw.set([r, g, b], y * (size * 3 + 1) + 1 + x * 3)
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
for (const s of [180, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s))
