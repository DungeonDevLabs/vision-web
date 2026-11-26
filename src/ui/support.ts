// Moedinha "Apoie o Vision" (igual à do app Android): aba na borda direita que abre a gaveta com o Pix do autor.
import { copy, h, t } from './dom'

const PIX_KEY = 'luidy.moura.dev@gmail.com' // a mesma de res/values/support.xml do Android
// Frame 1 do sprite `coin` (16x16): k contorno, o ouro escuro, g ouro, b brilho.
const COIN = ['................', '.....kkkkkk.....', '...kkooooookk...', '..koooggggoook..', '..koobgggggook..', '.kooggggggggook.', '.koggggggggggok.', '.koggggggggggok.',
  '.koggggggggggok.', '.koggggggggggok.', '.kooggggggggook.', '..kooggggggook..', '..koooggggoook..', '...kkooooookk...', '.....kkkkkk.....', '................']
const COLORS: Record<string, string> = { k: '#3a2a00', o: '#c8860a', g: '#ffd23f', b: '#fff3a0' }

export function coinSvg(size: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size))
  svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true')
  COIN.forEach((row, y) => [...row].forEach((c, x) => {
    if (!COLORS[c]) return
    const r = document.createElementNS(ns, 'rect')
    r.setAttribute('x', String(x)); r.setAttribute('y', String(y)); r.setAttribute('width', '1'); r.setAttribute('height', '1'); r.setAttribute('fill', COLORS[c])
    svg.append(r)
  }))
  return svg
}

export function supportDrawer(): HTMLElement {
  const panel = h('div', { class: 'support-panel', hidden: true },
    h('h3', {}, t('Apoie o Vision com um Pix', 'Support Vision with a Pix')),
    h('p', {}, t('Qualquer valor mantém o app no ar e traz dragões novos.', 'Any amount keeps the app running and brings new dragons.')),
    h('button', { class: 'primary', onclick: () => void copy(PIX_KEY, t('Chave Pix copiada. Obrigado! 💜', 'Pix key copied. Thank you! 💜')) }, t('Copiar chave Pix', 'Copy Pix key')),
    h('code', {}, PIX_KEY),
    h('button', { onclick: () => close() }, t('Agora não', 'Not now')),
  )
  const scrim = h('div', { class: 'scrim', hidden: true, onclick: () => close() })
  const tab = h('button', { class: 'coin-tab', 'aria-label': t('Abrir apoio ao Vision', 'Open Vision support'), onclick: () => open() }, coinSvg(20))
  const open = () => { panel.hidden = false; scrim.hidden = false; tab.hidden = true }
  const close = () => { panel.hidden = true; scrim.hidden = true; tab.hidden = false }
  return h('div', { class: 'support' }, tab, scrim, panel)
}
