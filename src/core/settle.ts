// Divisão, saldos e acerto de contas. Espelha MissionRules.kt (equalSplit, balances, settle, groupTotal).
import type { ExpenseDto } from './pack'

/** [amountCents] dividido igualmente; os centavos que sobram vão para os primeiros, como parcelas. */
export function equalSplit(amountCents: number, members: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  const base = Math.floor(amountCents / members.length), rest = amountCents % members.length
  members.forEach((m, i) => { out[m] = base + (i < rest ? 1 : 0) })
  return out
}

/** Pago menos a parte, gastos vivos e acertos incluídos. Positivo = os outros devem a essa pessoa. Soma zero. */
export function balances(expenses: ExpenseDto[]): Record<string, number> {
  const b: Record<string, number> = {}
  for (const e of expenses.filter((x) => !x.deleted)) {
    b[e.payerId] = (b[e.payerId] ?? 0) + e.amountCents
    for (const [m, c] of Object.entries(e.split)) b[m] = (b[m] ?? 0) - c
  }
  return b
}

export interface Transfer { from: string; to: string; cents: number }

/** Quem paga quem (≤ n−1): o maior devedor paga o maior credor; empate por id, para todo aparelho sugerir o mesmo. */
export function settle(bal: Record<string, number>): Transfer[] {
  const debt = new Map(Object.entries(bal).filter(([, v]) => v < 0).map(([k, v]) => [k, -v]))
  const credit = new Map(Object.entries(bal).filter(([, v]) => v > 0))
  const biggest = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
  const out: Transfer[] = []
  while (debt.size && credit.size) {
    const [d, dv] = biggest(debt), [c, cv] = biggest(credit)
    const cents = Math.min(dv, cv)
    out.push({ from: d, to: c, cents })
    dv === cents ? debt.delete(d) : debt.set(d, dv - cents)
    cv === cents ? credit.delete(c) : credit.set(c, cv - cents)
  }
  return out
}

/** O que o grupo gastou: só gastos vivos (acerto só move dinheiro entre membros). */
export const groupTotal = (expenses: ExpenseDto[]): number => expenses.filter((e) => !e.deleted && e.kind === 'GASTO').reduce((a, e) => a + e.amountCents, 0)
