// Fundo: parede de tijolos de pedra com a luz da tocha vindo de cima (Modifier.stoneWall do app Android).
const HIGH = 24, WIDE = 48, JOINT = 3

function tile(stone: string, mortar: string): string {
  const c = document.createElement('canvas')
  c.width = WIDE * 2; c.height = HIGH * 2
  const g = c.getContext('2d')
  if (!g) return ''
  g.fillStyle = mortar; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = stone
  for (let line = 0; line < 2; line++) {
    for (let x = line % 2 === 0 ? 0 : -WIDE / 2; x < c.width; x += WIDE) g.fillRect(x + JOINT, line * HIGH + JOINT, WIDE - JOINT, HIGH - JOINT)
  }
  return c.toDataURL()
}

export function applyWall(el: HTMLElement): void {
  const paint = () => {
    const css = getComputedStyle(document.documentElement)
    const url = tile(css.getPropertyValue('--c-low').trim(), css.getPropertyValue('--bg').trim())
    const light = `linear-gradient(to bottom, color-mix(in srgb, ${css.getPropertyValue('--primary').trim()} 18%, transparent), transparent 45%)`
    el.style.backgroundImage = url ? `${light}, url(${url})` : light
    el.style.backgroundSize = `100% 100%, ${WIDE * 2}px ${HIGH * 2}px`
    el.style.backgroundRepeat = 'no-repeat, repeat'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', css.getPropertyValue('--bg').trim())
  }
  paint()
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', paint)
}
