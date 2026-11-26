// Sprites em texto, iguais aos do app Android (assets/pixel): uma letra = um pixel, "." = transparente.
import palettetxt from '../sprites/palette.txt?raw'

export interface Sprite { width: number; height: number; fps: number; loop: boolean; frames: string[][] }

export function parsePalette(text: string): Map<string, string> {
  return new Map(text.split('\n').filter((l) => l.trim()).map((l) => { const [c, hex] = l.trim().split(/\s+/); return [c, hex] as [string, string] }))
}

export function parseSprite(text: string, palette: Map<string, string>): Sprite {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''))
  const at = lines.findIndex((l) => l.startsWith('---'))
  const header = new Map(lines.slice(0, at).filter((l) => l.includes(':')).map((l) => [l.split(':')[0].trim(), l.slice(l.indexOf(':') + 1).trim()] as [string, string]))
  const [width, height] = header.get('size')!.split('x').map(Number)
  const frames: string[][] = []
  for (const l of lines.slice(at)) {
    if (l.startsWith('---')) frames.push([])
    else if (l) frames[frames.length - 1].push(l)
  }
  if (frames.length !== Number(header.get('frames'))) throw new Error('frames')
  for (const f of frames) {
    if (f.length !== height || f.some((l) => l.length !== width)) throw new Error('size')
    if (f.some((l) => [...l].some((c) => c !== '.' && !palette.has(c)))) throw new Error('palette')
  }
  return { width, height, fps: Number(header.get('fps')), loop: header.get('loop') === 'yes', frames }
}

const palette = parsePalette(palettetxt)
const raw = import.meta.glob('../sprites/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const cache = new Map<string, Sprite>()
export function loadSprite(name: string): Sprite {
  let s = cache.get(name)
  if (!s) {
    const text = raw[`../sprites/${name}.txt`]
    if (!text) throw new Error(`sprite ${name}`)
    cache.set(name, (s = parseSprite(text, palette)))
  }
  return s
}

/** O personagem do membro: o que ele escolheu (1..24) ou, no automático, a posição entre os ids ordenados (igual em todo aparelho). */
export const AVATARS = 24
export function avatarName(memberIds: string[], id: string, picked: number): string {
  if (picked >= 1 && picked <= AVATARS) return `avatar_${picked}`
  return `avatar_${Math.max(0, [...memberIds].sort().indexOf(id)) % AVATARS + 1}`
}

/**
 * Sprite desenhado e animado num <canvas>. [width] em px de tela. [frame] fixa um quadro; sem loop toca uma vez.
 * A animação para sozinha quando o elemento sai da página.
 */
export function sprite(name: string, width: number, opts: { frame?: number; label?: string } = {}): HTMLCanvasElement {
  const s = loadSprite(name)
  const c = document.createElement('canvas')
  c.width = s.width; c.height = s.height
  c.style.width = `${width}px`; c.style.height = `${(width * s.height) / s.width}px`
  c.className = 'sprite'
  if (opts.label) { c.setAttribute('role', 'img'); c.setAttribute('aria-label', opts.label) } else c.setAttribute('aria-hidden', 'true')
  const ctx = c.getContext('2d')
  if (!ctx) return c // sem canvas (testes): fica o elemento vazio
  const draw = (i: number) => {
    ctx.clearRect(0, 0, s.width, s.height)
    s.frames[i].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { ctx.fillStyle = palette.get(ch)!; ctx.fillRect(x, y, 1, 1) } }))
  }
  draw(Math.min(opts.frame ?? 0, s.frames.length - 1))
  if (opts.frame === undefined && s.fps > 0 && s.frames.length > 1) {
    let i = 0, seen = false
    const timer = setInterval(() => {
      if (c.isConnected) seen = true
      else if (seen) return clearInterval(timer)
      i++
      if (i >= s.frames.length) { if (!s.loop) return clearInterval(timer); i = 0 }
      draw(i)
    }, 1000 / s.fps)
  }
  return c
}
