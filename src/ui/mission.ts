import { balances, groupTotal, settle } from '../core/settle'
import { formatBrl } from '../core/money'
import type { ExpenseDto, MemberDto } from '../core/pack'
import { deleteExpense, settleUp } from '../ledger'
import { exportPackFile, fetchOthers } from '../sync'
import { expenses, members, type Mission } from '../store'
import { login } from '../drive/auth'
import { onStatus, schedulePublish, status, transport } from '../live'
import { expenseForm } from './expense'
import { copy, h, t, toast } from './dom'
import { avatarName, sprite } from './sprite'

type Tab = 'gastos' | 'acertos'

/** Tela da missão: gastos e acertos. Redesenha sozinha quando algo muda. */
export async function missionScreen(m: Mission, back: () => void): Promise<HTMLElement> {
  const root = h('section', {})
  let tab: Tab = 'gastos'
  let form: HTMLElement | null = null

  const draw = async () => {
    const [ms, es] = [await members(m.id), await expenses(m.id)]
    const name = (id: string) => ms.find((x) => x.id === id)?.name ?? '?'
    const ids = ms.map((x) => x.id)
    const face = (id: string, px = 36) => sprite(avatarName(ids, id, ms.find((x) => x.id === id)?.avatar ?? 0), px)
    const parts = [
      h('header', { class: 'bar' },
        h('button', { class: 'icon', onclick: back, 'aria-label': t('Voltar', 'Back') }, sprite('icon_back', 24)),
        sprite('torch', 14), h('h1', {}, m.name)),
      status.needLogin ? h('div', { class: 'banner' }, t('Seus gastos estão salvos aqui. Entre com o Google para enviá-los ao grupo.', 'Your expenses are saved here. Sign in with Google to send them to the group.'),
        h('div', {}, h('button', { class: 'primary', onclick: () => login() }, t('Entrar com Google', 'Sign in with Google')))) : null,
      status.error ? h('div', { class: 'banner err' }, status.error) : null,
      form ?? h('div', {},
        h('div', { class: 'pills', role: 'tablist' },
          h('button', { class: tab === 'gastos' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'gastos'), onclick: () => { tab = 'gastos'; void draw() } }, sprite('icon_bills', 22), t('Gastos', 'Expenses')),
          h('button', { class: tab === 'acertos' ? 'on' : '', role: 'tab', 'aria-selected': String(tab === 'acertos'), onclick: () => { tab = 'acertos'; void draw() } }, sprite('icon_split', 22), t('Acertos', 'Settle up'))),
        tab === 'gastos' ? gastos(ms, es, name, face) : acertos(ms, es, name, face)),
    ]
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x))
  }

  const refresh = async (force: boolean) => {
    const n = await fetchOthers(m.id, transport, force)
    if (force) toast(n ? t(`${n} gasto(s) novo(s)`, `${n} new expense(s)`) : t('Tudo em dia', 'Up to date'))
    await draw()
  }
  const changed = async () => { schedulePublish(m.id); await draw() }
  const openForm = async (id: string | null) => {
    form = await expenseForm(m, id, async (saved) => { form = null; if (saved) await changed(); else await draw() })
    await draw()
  }

  type Face = (id: string, px?: number) => HTMLElement
  const gastos = (ms: MemberDto[], es: ExpenseDto[], name: (id: string) => string, face: Face) => {
    const live = es.filter((e) => !e.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt))
    return h('div', {},
      h('div', { class: 'card' }, h('div', { class: 'muted' }, t('Total do grupo', 'Group total')), h('strong', {}, formatBrl(groupTotal(es))), h('span', { class: 'muted' }, ` · ${ms.length} ${t('pessoas', 'people')}`)),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => void openForm(null) }, sprite('icon_add', 20), t('Gasto', 'Expense')),
        h('button', { onclick: () => void refresh(true) }, sprite('icon_history', 20), t('Atualizar', 'Refresh')),
        h('button', { onclick: () => void sharePack() }, sprite('icon_flag', 20), t('Enviar meu pacote ao grupo', 'Send my pack to the group'))),
      live.length ? null : h('div', { class: 'empty' }, sprite('dragon_idle', 96), h('p', { class: 'muted' }, t('Nenhum gasto ainda. Lance o primeiro!', 'No expenses yet. Add the first one!'))),
      ...live.map((e) => h('div', { class: 'item' },
        h('div', { class: 'who' }, face(e.payerId),
          h('div', { class: 'what' },
            h('strong', {}, e.kind === 'ACERTO' ? t(`${name(e.payerId)} pagou ${name(Object.keys(e.split)[0])}`, `${name(e.payerId)} paid ${name(Object.keys(e.split)[0])}`) : e.description),
            h('div', { class: 'muted' }, `${e.date} · ${t('pago por', 'paid by')} ${name(e.payerId)}${e.kind === 'GASTO' ? ` · ${t('dividido entre', 'split between')} ${Object.keys(e.split).length}` : ''}`))),
        h('div', { class: 'amt' }, formatBrl(e.amountCents),
          e.authorId === m.meId && e.kind === 'GASTO' ? h('div', {},
            h('button', { class: 'icon', 'aria-label': t('Editar', 'Edit'), onclick: () => void openForm(e.id) }, sprite('icon_edit', 22)),
            h('button', { class: 'icon', 'aria-label': t('Apagar', 'Delete'), onclick: async () => { if (confirm(t('Apagar este gasto?', 'Delete this expense?'))) { await deleteExpense(m, e.id); await changed() } } }, sprite('icon_delete', 22))) : null))))
  }

  const acertos = (ms: MemberDto[], es: ExpenseDto[], name: (id: string) => string, face: Face) => {
    const bal = balances(es), transfers = settle(bal)
    return h('div', {},
      h('h2', {}, t('Saldos', 'Balances')),
      ...ms.map((x) => { const b = bal[x.id] ?? 0; return h('div', { class: 'item' }, h('div', { class: 'who' }, face(x.id), h('span', {}, name(x.id) + (x.id === m.meId ? t(' (eu)', ' (me)') : ''))), h('strong', { class: b < 0 ? 'neg' : b > 0 ? 'pos' : '' }, formatBrl(b))) }),
      h('h2', {}, t('Quem paga quem', 'Who pays whom')),
      transfers.length ? null : h('div', { class: 'empty' }, sprite('dragon_happy', 96), h('p', { class: 'muted' }, t('Tudo certo, ninguém deve nada.', 'All square, nobody owes anything.'))),
      ...transfers.map((p) => {
        const credor = ms.find((x) => x.id === p.to)
        return h('div', { class: 'item' },
          h('div', { class: 'who' }, face(p.from, 28), sprite('icon_up', 16), face(p.to, 28),
            h('div', { class: 'what' }, h('strong', {}, t(`${name(p.from)} paga ${name(p.to)}`, `${name(p.from)} pays ${name(p.to)}`)), h('div', {}, formatBrl(p.cents)))),
          p.from === m.meId ? h('div', { class: 'amt' },
            credor?.pixKey ? h('button', { onclick: () => void copy(credor.pixKey!, t('Chave Pix copiada', 'Pix key copied')) }, sprite('coin', 18), t('Copiar Pix', 'Copy Pix')) : null,
            h('button', { class: 'primary', onclick: async () => { if (confirm(t(`Registrar que você pagou ${formatBrl(p.cents)} a ${name(p.to)}?`, `Record that you paid ${name(p.to)} ${formatBrl(p.cents)}?`))) { await settleUp(m, p.to, p.cents); await changed() } } }, sprite('icon_paid', 20), t('Paguei', 'I paid'))) :
            h('span', { class: 'muted' }, p.to === m.meId ? t('aguardando', 'waiting') : ''))
      }))
  }

  const sharePack = async () => {
    const f = await exportPackFile(m.id)
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: m.name }) } catch { /* cancelado */ } return }
    const a = h('a', { href: URL.createObjectURL(f), download: f.name }); document.body.append(a); a.click(); a.remove()
  }

  onStatus(() => void draw())
  await draw()
  void refresh(false)
  return root
}
