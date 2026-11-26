import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildPack, merge, openPack, sealPack, validate, type ExpenseDto, type MemberDto, type MissionPack } from '../src/core/pack'

const M = '11111111-1111-4111-8111-111111111111'
const ana = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const bia = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const cai = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const e = (n: number, over: Partial<ExpenseDto> = {}): ExpenseDto => ({
  id: `eeeeeeee-0000-4000-8000-00000000000${n}`, authorId: ana, payerId: ana, description: 'Hotel', date: '2026-12-21',
  amountCents: 10_000, split: { [ana]: 5_000, [bia]: 5_000 }, kind: 'GASTO', deleted: false, updatedAt: 10, ...over,
})
const mem = (id: string, name: string, updatedAt = 1): MemberDto => ({ id, name, updatedAt, avatar: 0 })
const pack = (over: Partial<MissionPack> = {}): MissionPack => ({
  v: 1, missionId: M, missionName: 'Praia', start: '2026-12-20', end: '2026-12-30', from: ana,
  members: [mem(ana, 'Ana'), mem(bia, 'Bia')], expenses: [e(1)], sentAt: 99, ...over,
})
const key = readFileSync(new URL('./fixtures/key.txt', import.meta.url), 'utf8').trim()

describe('validate', () => {
  test('aceita um pacote bom', () => expect(validate(pack(), M)).toEqual(pack()))
  test('rejeita versão diferente de 1', () => expect(() => validate(pack({ v: 2 }), M)).toThrow('version'))
  test('rejeita outra missão', () => expect(() => validate(pack(), cai)).toThrow('another mission'))
  test('rejeita remetente fora dos membros', () => expect(() => validate(pack({ from: cai }), M)).toThrow('sender'))
  test('rejeita UUID inválido de membro', () => expect(() => validate(pack({ members: [mem('x', 'Ana'), mem(ana, 'A')], from: ana }), M)).toThrow('member'))
  test('rejeita split que não soma o valor', () => expect(() => validate(pack({ expenses: [e(1, { split: { [ana]: 1 } })] }), M)).toThrow('split'))
  test('rejeita split com membro desconhecido', () => expect(() => validate(pack({ expenses: [e(1, { split: { [cai]: 10_000 } })] }), M)).toThrow('split members'))
  test('rejeita valor negativo', () => expect(() => validate(pack({ expenses: [e(1, { amountCents: -5, split: { [ana]: -5 } })] }), M)).toThrow('split'))
  test('rejeita descrição maior que 200', () => expect(() => validate(pack({ expenses: [e(1, { description: 'x'.repeat(201) })] }), M)).toThrow('kind'))
  test('rejeita tipo desconhecido e data inválida', () => {
    expect(() => validate(pack({ expenses: [e(1, { kind: 'X' as never })] }), M)).toThrow('kind')
    expect(() => validate(pack({ expenses: [e(1, { date: '2026-13-40' })] }), M)).toThrow()
  })
  test('rejeita mais de 100 membros', () => {
    const many = Array.from({ length: 101 }, (_, i) => mem(`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`, 'N'))
    expect(() => validate(pack({ members: [mem(ana, 'Ana'), ...many] }), M)).toThrow('too many')
  })
  test('rejeita membro repetido e gasto repetido', () => {
    expect(() => validate(pack({ members: [mem(ana, 'A'), mem(ana, 'B')] }), M)).toThrow('repeated member')
    expect(() => validate(pack({ expenses: [e(1), e(1)] }), M)).toThrow('repeated expense')
  })
})

describe('arquivo do Android', () => {
  test('abre, valida e traz lápide e arquivo do Drive', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('./fixtures/pack-android.vision', import.meta.url)))
    const p = validate(await openPack(bytes, key), M)
    expect(p.members.find((m) => m.id === ana)?.driveFileId).toBe('drive-file-ana')
    expect(p.expenses.filter((x) => x.deleted)).toHaveLength(1)
    expect(p.expenses[1].split).toEqual({ [ana]: 1501, [bia]: 1500 })
  })
  test('seal e open do pacote voltam iguais', async () => {
    expect(await openPack(await sealPack(pack(), key), key)).toEqual(pack())
  })
})

describe('merge', () => {
  test('aplica gasto novo e conta como novo', () => {
    const r = merge(bia, [], [], pack())
    expect(r.expenses).toHaveLength(1)
    expect(r.newExpenses).toBe(1)
  })
  test('ignora gasto mais velho ou igual e o mesmo pacote duas vezes não muda nada', () => {
    const r = merge(bia, [mem(ana, 'Ana'), mem(bia, 'Bia')], [e(1, { updatedAt: 10 })], pack())
    expect(r.expenses).toEqual([])
    expect(r.members).toEqual([])
  })
  test('gasto mais novo substitui e não conta como novo', () => {
    const r = merge(bia, [], [e(1, { updatedAt: 5 })], pack())
    expect(r.expenses[0].updatedAt).toBe(10)
    expect(r.newExpenses).toBe(0)
  })
  test('lápide mais nova vence e não conta como novo', () => {
    const r = merge(bia, [], [], pack({ expenses: [e(1, { deleted: true })] }))
    expect(r.expenses[0].deleted).toBe(true)
    expect(r.newExpenses).toBe(0)
  })
  test('nunca escreve o meu membro', () => {
    const r = merge(bia, [mem(bia, 'Eu', 0)], [], pack({ members: [mem(ana, 'Ana'), mem(bia, 'Outro nome', 999)] }))
    expect(r.members.map((m) => m.id)).toEqual([ana])
  })
  test('ignora gasto cujo autor não é o remetente', () => {
    expect(merge(bia, [], [], pack({ expenses: [e(1, { authorId: cai })] })).expenses).toEqual([])
  })
  test('pacote do próprio aparelho só traz membros', () => {
    const r = merge(ana, [], [], pack())
    expect(r.expenses).toEqual([])
    expect(r.members.map((m) => m.id)).toEqual([bia])
  })
  test('ordem de dois pacotes não importa', () => {
    const p1 = pack({ expenses: [e(1, { updatedAt: 5 })] })
    const p2 = pack({ expenses: [e(1, { updatedAt: 9, description: 'Novo' })] })
    const apply = (a: MissionPack, b: MissionPack) => {
      const r1 = merge(bia, [], [], a)
      const r2 = merge(bia, r1.members, r1.expenses, b)
      return [...r1.expenses.filter((x) => !r2.expenses.some((y) => y.id === x.id)), ...r2.expenses]
    }
    expect(apply(p1, p2)).toEqual(apply(p2, p1))
  })
})

describe('buildPack', () => {
  test('leva só os meus gastos e todos os membros', () => {
    const p = buildPack({ id: M, name: 'Praia', start: '2026-12-20', meId: bia }, [mem(ana, 'Ana'), mem(bia, 'Bia')], [e(1), e(2, { authorId: bia, payerId: bia })], 7)
    expect(p.from).toBe(bia)
    expect(p.expenses.map((x) => x.authorId)).toEqual([bia])
    expect(p.members).toHaveLength(2)
    expect(p.sentAt).toBe(7)
  })
})
