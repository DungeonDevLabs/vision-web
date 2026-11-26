// Os gastos que EU escrevo: criar, editar, apagar (lápide) e registrar "Paguei". Só o autor escreve o próprio gasto.
import { equalSplit } from './core/settle'
import type { ExpenseDto, ExpenseKind } from './core/pack'
import { expenses, members, putExpenses, type Mission } from './store'

export interface ExpenseInput { id?: string; description: string; amountCents: number; payerId: string; splitAmong: string[]; date: string; kind?: ExpenseKind }

const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s)
const bump = (old: number) => Math.max(Date.now(), old + 1)

export async function saveExpense(m: Mission, i: ExpenseInput): Promise<ExpenseDto> {
  const ids = new Set((await members(m.id)).map((x) => x.id))
  const description = i.description.trim()
  if (!description || description.length > 200) throw new Error('description')
  if (!Number.isSafeInteger(i.amountCents) || i.amountCents <= 0) throw new Error('amount')
  if (!ids.has(i.payerId)) throw new Error('payer')
  if (!i.splitAmong.length || !i.splitAmong.every((x) => ids.has(x))) throw new Error('split')
  if (!validDate(i.date)) throw new Error('date')
  const old = i.id ? (await expenses(m.id)).find((x) => x.id === i.id) : undefined
  if (old && old.authorId !== m.meId) throw new Error('not yours')
  const e: ExpenseDto = {
    id: old?.id ?? crypto.randomUUID(), authorId: m.meId, payerId: i.payerId, description, date: i.date, amountCents: i.amountCents,
    split: equalSplit(i.amountCents, i.splitAmong), kind: i.kind ?? 'GASTO', deleted: false, updatedAt: bump(old?.updatedAt ?? 0),
  }
  await putExpenses(m.id, [e])
  return e
}

export async function deleteExpense(m: Mission, id: string): Promise<void> {
  const old = (await expenses(m.id)).find((x) => x.id === id)
  if (!old || old.authorId !== m.meId) throw new Error('not yours')
  await putExpenses(m.id, [{ ...old, deleted: true, updatedAt: bump(old.updatedAt) }])
}

/** "Paguei": só o devedor registra; é um ACERTO pago por mim com a parte toda em quem recebeu. */
export async function settleUp(m: Mission, toId: string, cents: number): Promise<ExpenseDto> {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('amount')
  if (!(await members(m.id)).some((x) => x.id === toId)) throw new Error('payer')
  const e: ExpenseDto = { id: crypto.randomUUID(), authorId: m.meId, payerId: m.meId, description: 'Acerto', date: isoToday(), amountCents: cents, split: { [toId]: cents }, kind: 'ACERTO', deleted: false, updatedAt: Date.now() }
  await putExpenses(m.id, [e])
  return e
}
