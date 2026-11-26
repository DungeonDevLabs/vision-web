import { parseInvite, type Invite } from '../core/invite'
import { joinFromInvite } from '../sync'
import { listMissions, type Mission } from '../store'
import { h, t } from './dom'

/** Tela inicial: missões que já tenho + entrar por convite (colar o código ou abrir o link). */
export async function joinScreen(go: (m: Mission) => void, invite: Invite | null = null): Promise<HTMLElement> {
  const err = h('p', { class: 'err', role: 'alert' })
  const code = h('textarea', { rows: 3, placeholder: t('Cole aqui o convite (vision-mission:…)', 'Paste the invite here (vision-mission:…)') })
  const name = h('input', { type: 'text', maxLength: 40, autocomplete: 'nickname', placeholder: t('Seu nome no grupo', 'Your name in the group') })
  const info = h('p', { class: 'muted' })
  let inv = invite
  const show = () => { info.textContent = inv ? t(`Missão: ${inv.name} · convidado por ${inv.from.name}`, `Mission: ${inv.name} · invited by ${inv.from.name}`) : '' }
  show()
  code.addEventListener('input', () => { inv = parseInvite(code.value); err.textContent = code.value.trim() && !inv ? t('Convite inválido', 'Invalid invite') : ''; show() })
  const enter = h('button', {
    class: 'primary',
    onclick: async () => {
      if (!inv) { err.textContent = t('Cole um convite válido', 'Paste a valid invite'); return }
      if (!name.value.trim()) { err.textContent = t('Diga seu nome', 'Enter your name'); return }
      try { go(await joinFromInvite(inv, name.value)) } catch { err.textContent = t('Não deu para entrar', "Couldn't join") }
    },
  }, t('Entrar na missão', 'Join mission'))
  const mine = await listMissions()
  return h('section', {},
    h('h1', {}, 'Vision'),
    mine.length ? h('div', {}, h('h2', {}, t('Suas missões', 'Your missions')),
      ...mine.map((m) => h('button', { class: 'row', onclick: () => go(m) }, m.name))) : null,
    h('h2', {}, t('Entrar com convite', 'Join with an invite')),
    inv ? null : code, info, name, enter, err,
  )
}
