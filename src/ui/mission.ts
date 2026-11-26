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

type Tab = 'gastos' | 'acertos'

/** Tela da missão: gastos e acertos. Redesenha sozinha quando algo muda. */
export async function missionScreen(m: Mission, back: () => void): Promise<HTMLElement> {
  const root = h('section', {})
  let tab: Tab = 'gastos'
  let form: HTMLElement | null = null

  const draw = async () => {
    const [ms, es] = [await members(m.id), await expenses(m.id)]
    const name = (id: string) => ms.find((x) => x.id === id)?.name ?? '?'
    const parts = [
      h('header', { class: 'bar' }, h('button', { onclick: back, 'aria-label': t('Voltar', 'Back') }, '←'), h('h1', {}, m.name)),
      status.needLogin ? h('div', { class: 'banner' }, t('Seus gastos estão salvos aqui. Entre com o Google para enviá-los ao grupo.', 'Your expenses are saved here. Sign in with Google to send them to the group.'),
        h('button', { class: 'primary', onclick: () => login() }, t('Entrar com Google', 'Sign in with Google'))) : null,
      status.error ? h('div', { class: 'banner err' }, status.error) : null,
      form ?? h('div', {},
        h('div', { class: 'tabs' },
          h('button', { class: tab === 'gastos' ? 'on' : '', onclick: () => { tab = 'gastos'; void draw() } }, t('Gastos', 'Expenses')),
          h('button', { class: tab === 'acertos' ? 'on' : '', onclick: () => { tab = 'acertos'; void draw() } }, t('Acertos', 'Settle up'))),
        tab === 'gastos' ? gastos(ms, es, name) : acertos(ms, es, name)),
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

  const gastos = (ms: MemberDto[], es: ExpenseDto[], name: (id: string) => string) => {
    const live = es.filter((e) => !e.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt))
    return h('div', {},
      h('p', { class: 'muted' }, t(`Total do grupo: ${formatBrl(groupTotal(es))} · ${ms.length} pessoas`, `Group total: ${formatBrl(groupTotal(es))} · ${ms.length} people`)),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => void openForm(null) }, t('+ Gasto', '+ Expense')),
        h('button', { onclick: () => void refresh(true) }, t('Atualizar', 'Refresh')),
        h('button', { onclick: () => void sharePack() }, t('Enviar meu pacote ao grupo', 'Send my pack to the group'))),
      live.length ? null : h('p', { class: 'muted' }, t('Nenhum gasto ainda.', 'No expenses yet.')),
      ...live.map((e) => h('div', { class: 'item' },
        h('div', {},
          h('strong', {}, e.kind === 'ACERTO' ? t(`${name(e.payerId)} pagou ${name(Object.keys(e.split)[0])}`, `${name(e.payerId)} paid ${name(Object.keys(e.split)[0])}`) : e.description),
          h('div', { class: 'muted' }, `${e.date} · ${t('pago por', 'paid by')} ${name(e.payerId)}${e.kind === 'GASTO' ? ` · ${t('dividido entre', 'split between')} ${Object.keys(e.split).length}` : ''}`)),
        h('div', { class: 'amt' }, formatBrl(e.amountCents),
          e.authorId === m.meId && e.kind === 'GASTO' ? h('span', {},
            h('button', { onclick: () => void openForm(e.id) }, t('Editar', 'Edit')),
            h('button', { onclick: async () => { if (confirm(t('Apagar este gasto?', 'Delete this expense?'))) { await deleteExpense(m, e.id); await changed() } } }, t('Apagar', 'Delete'))) : null))))
  }

  const acertos = (ms: MemberDto[], es: ExpenseDto[], name: (id: string) => string) => {
    const bal = balances(es), transfers = settle(bal)
    return h('div', {},
      h('h2', {}, t('Saldos', 'Balances')),
      ...ms.map((x) => { const b = bal[x.id] ?? 0; return h('div', { class: 'item' }, h('span', {}, name(x.id) + (x.id === m.meId ? t(' (eu)', ' (me)') : '')), h('span', { class: b < 0 ? 'neg' : 'pos' }, formatBrl(b))) }),
      h('h2', {}, t('Quem paga quem', 'Who pays whom')),
      transfers.length ? null : h('p', { class: 'muted' }, t('Tudo certo, ninguém deve nada.', 'All square, nobody owes anything.')),
      ...transfers.map((p) => {
        const credor = ms.find((x) => x.id === p.to)
        return h('div', { class: 'item' },
          h('div', {}, h('strong', {}, t(`${name(p.from)} paga ${name(p.to)}`, `${name(p.from)} pays ${name(p.to)}`)), h('div', {}, formatBrl(p.cents))),
          p.from === m.meId ? h('div', {},
            credor?.pixKey ? h('button', { onclick: () => void copy(credor.pixKey!, t('Chave Pix copiada', 'Pix key copied')) }, t('Copiar Pix', 'Copy Pix')) : null,
            h('button', { class: 'primary', onclick: async () => { if (confirm(t(`Registrar que você pagou ${formatBrl(p.cents)} a ${name(p.to)}?`, `Record that you paid ${name(p.to)} ${formatBrl(p.cents)}?`))) { await settleUp(m, p.to, p.cents); await changed() } } }, t('Paguei', 'I paid'))) :
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
