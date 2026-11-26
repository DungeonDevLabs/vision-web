import { describe, expect, test } from 'vitest'
import { balances, equalSplit, groupTotal, settle } from '../src/core/settle'
import type { ExpenseDto } from '../src/core/pack'

const x = (id: string, payerId: string, amountCents: number, split: Record<string, number>, over: Partial<ExpenseDto> = {}): ExpenseDto =>
  ({ id, authorId: payerId, payerId, description: id, date: '2026-12-21', amountCents, split, kind: 'GASTO', deleted: false, updatedAt: 1, ...over })

describe('equalSplit', () => {
  test('soma o total e o resto vai para os primeiros', () => {
    expect(equalSplit(1000, ['a', 'b', 'c'])).toEqual({ a: 334, b: 333, c: 333 })
    expect(equalSplit(1, ['a', 'b'])).toEqual({ a: 1, b: 0 })
    expect(equalSplit(5, [])).toEqual({})
  })
})
describe('balances', () => {
  test('pago menos a parte, lápide fora, acerto dentro', () => {
    const e = [x('1', 'a', 1000, { a: 500, b: 500 }), x('2', 'b', 300, { a: 300 }, { deleted: true }), x('3', 'b', 500, { a: 500 }, { kind: 'ACERTO' })]
    expect(balances(e)).toEqual({ a: 0, b: 0 })
  })
})
describe('settle', () => {
  test('zera todos com no máximo n−1 transferências', () => {
    const b = { a: 700, b: -400, c: -300 }
    const t = settle(b)
    expect(t.length).toBeLessThanOrEqual(2)
    const after = { ...b }
    t.forEach((p) => { after[p.from as 'a'] += p.cents; after[p.to as 'a'] -= p.cents })
    expect(Object.values(after).every((v) => v === 0)).toBe(true)
  })
  test('devedores iguais desempatam por id', () => {
    expect(settle({ a: 200, b: -100, c: -100 })).toEqual([{ from: 'b', to: 'a', cents: 100 }, { from: 'c', to: 'a', cents: 100 }])
  })
  test('sem dívida não tem transferência', () => expect(settle({ a: 0, b: 0 })).toEqual([]))
})
describe('groupTotal', () => {
  test('só gasto vivo, acerto não conta', () => {
    expect(groupTotal([x('1', 'a', 1000, { a: 1000 }), x('2', 'a', 500, { a: 500 }, { deleted: true }), x('3', 'a', 300, { b: 300 }, { kind: 'ACERTO' })])).toBe(1000)
  })
})
