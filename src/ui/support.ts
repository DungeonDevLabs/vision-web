// Moedinha "Apoie o Vision" (igual à do app Android): aba na borda direita que abre a gaveta com o Pix do autor.
import { copy, h, t } from './dom'
import { sprite } from './sprite'

const PIX_KEY = 'luidy.moura.dev@gmail.com' // a mesma de res/values/support.xml do Android

export function supportDrawer(): HTMLElement {
  const panel = h('div', { class: 'support-panel', hidden: true })
  const scrim = h('div', { class: 'scrim', hidden: true, onclick: () => close() })
  const tab = h('button', { class: 'coin-tab', 'aria-label': t('Abrir apoio ao Vision', 'Open Vision support'), onclick: () => open() }, sprite('coin', 22))
  const open = () => {
    // O dragão é recriado a cada abertura para a animação recomeçar.
    panel.replaceChildren(
      sprite('dragon_support', 112),
      h('h3', {}, t('Apoie o Vision com um Pix', 'Support Vision with a Pix')),
      h('p', { class: 'muted' }, t('Qualquer valor mantém o app no ar e traz dragões novos.', 'Any amount keeps the app running and brings new dragons.')),
      h('button', { class: 'primary', onclick: () => void copy(PIX_KEY, t('Chave Pix copiada. Obrigado! 💜', 'Pix key copied. Thank you! 💜')) }, sprite('coin', 18), t('Copiar chave Pix', 'Copy Pix key')),
      h('code', {}, PIX_KEY),
      h('button', { class: 'ghost', onclick: () => close() }, t('Agora não', 'Not now')),
    )
    panel.hidden = false; scrim.hidden = false; tab.hidden = true
  }
  const close = () => { panel.hidden = true; scrim.hidden = true; tab.hidden = false; panel.replaceChildren() }
  return h('div', { class: 'support' }, tab, scrim, panel)
}
