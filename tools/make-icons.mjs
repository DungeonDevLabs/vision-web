// Gera public/icons/*.png a partir do ícone do app Android (tools/icon/*.xml, cópia de res/drawable/ic_launcher_*.xml).
// Sem dependências: node tools/make-icons.mjs. Se o ícone do app mudar, copie os dois XML de novo e rode.
import { deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

const rects = (file) => {
  const xml = readFileSync(new URL(`./icon/${file}`, import.meta.url), 'utf8')
  const out = []
  for (const p of xml.matchAll(/<path[^>]*?fillColor="#FF([0-9A-F]{6})"[^>]*?pathData="([^"]+)"/g)) {
    const color = [0, 2, 4].map((i) => parseInt(p[1].slice(i, i + 2), 16))
    for (const r of p[2].matchAll(/M(\d+),(\d+)h(-?\d+)v(\d+)h(-?\d+)z/g)) out.push({ color, x: +r[1], y: +r[2], w: +r[3], h: +r[4] })
    for (const c of p[2].matchAll(/M(\d+),(\d+)a(\d+),(\d+) 0 1,0 (\d+),0/g)) out.push({ color, circle: { cx: +c[1] + +c[5] / 2, cy: +c[2], r: +c[3] } })
  }
  return out
}
const layers = [...rects('ic_launcher_background.xml'), ...rects('ic_launcher_foreground.xml')]

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]) }

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = ((x + 0.5) * 108) / size, gy = ((y + 0.5) * 108) / size
      let rgb = [28, 21, 48]
      for (const l of layers) {
        const hit = l.circle ? (gx - l.circle.cx) ** 2 + (gy - l.circle.cy) ** 2 <= l.circle.r ** 2 : gx >= l.x && gx < l.x + l.w && gy >= l.y && gy < l.y + l.h
        if (hit) rgb = l.color
      }
      raw.set(rgb, y * (size * 3 + 1) + 1 + x * 3)
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
for (const s of [180, 192, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s))
