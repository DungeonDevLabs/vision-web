import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { deleteExpense, saveExpense, settleUp } from '../src/ledger'
import { clearAll, expenses, putExpenses, putMembers, saveMission, type Mission } from '../src/store'

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', BIA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', CAI = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const m: Mission = { id: '11111111-1111-4111-8111-111111111111', name: 'Praia', start: '2026-12-20', key: 'k', meId: ME }
const base = { description: 'Jantar', amountCents: 1000, payerId: ME, splitAmong: [ME, BIA, CAI], date: '2026-12-21' }

beforeEach(async () => {
  await clearAll(); await saveMission(m)
  await putMembers(m.id, [ME, BIA, CAI].map((id, i) => ({ id, name: `N${i}`, updatedAt: 1, avatar: 0 })))
})

describe('saveExpense', () => {
  test('cria meu gasto com divisão igual que soma o valor', async () => {
    const e = await saveExpense(m, base)
    expect(e.authorId).toBe(ME)
    expect(e.split).toEqual({ [ME]: 334, [BIA]: 333, [CAI]: 333 })
    expect(e.kind).toBe('GASTO')
    expect(await expenses(m.id)).toEqual([e])
  })
  test('editar sobe updatedAt, mantém o id e o autor', async () => {
    const a = await saveExpense(m, base)
    const b = await saveExpense(m, { ...base, id: a.id, description: 'Jantar 2', amountCents: 2000 })
    expect(b.id).toBe(a.id)
    expect(b.updatedAt).toBeGreaterThan(a.updatedAt)
    expect((await expenses(m.id))).toHaveLength(1)
  })
  test('não edita gasto de outra pessoa', async () => {
    await putExpenses(m.id, [{ id: 'eeeeeeee-0000-4000-8000-000000000001', authorId: BIA, payerId: BIA, description: 'x', date: '2026-12-21', amountCents: 5, split: { [BIA]: 5 }, kind: 'GASTO', deleted: false, updatedAt: 1 }])
    await expect(saveExpense(m, { ...base, id: 'eeeeeeee-0000-4000-8000-000000000001' })).rejects.toThrow('not yours')
  })
  test.each([
    ['descrição vazia', { description: '  ' }, 'description'],
    ['descrição grande', { description: 'x'.repeat(201) }, 'description'],
    ['valor zero', { amountCents: 0 }, 'amount'],
    ['sem ninguém na divisão', { splitAmong: [] }, 'split'],
    ['pagador desconhecido', { payerId: 'zzz' }, 'payer'],
    ['divide com desconhecido', { splitAmong: [ME, 'zzz'] }, 'split'],
    ['data inválida', { date: '2026-02-30' }, 'date'],
  ])('recusa %s', async (_n, over, msg) => { await expect(saveExpense(m, { ...base, ...over })).rejects.toThrow(msg) })
})

describe('deleteExpense', () => {
  test('vira lápide mais nova', async () => {
    const a = await saveExpense(m, base)
    await deleteExpense(m, a.id)
    const [x] = await expenses(m.id)
    expect(x.deleted).toBe(true)
    expect(x.updatedAt).toBeGreaterThan(a.updatedAt)
  })
})

describe('settleUp', () => {
  test('Paguei: ACERTO pago por mim com a parte toda em quem recebeu', async () => {
    const e = await settleUp(m, BIA, 700)
    expect(e.kind).toBe('ACERTO')
    expect(e.payerId).toBe(ME)
    expect(e.split).toEqual({ [BIA]: 700 })
    expect(e.amountCents).toBe(700)
  })
  test('recusa valor zero e quem não é do grupo', async () => {
    await expect(settleUp(m, BIA, 0)).rejects.toThrow('amount')
    await expect(settleUp(m, 'zzz', 5)).rejects.toThrow('payer')
  })
})
