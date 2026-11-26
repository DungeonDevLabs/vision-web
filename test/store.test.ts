import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { clearAll, getMission, listMissions, members, expenses, putExpenses, putMembers, saveMission, getLastFetch, setLastFetch } from '../src/store'

const m = { id: '11111111-1111-4111-8111-111111111111', name: 'Praia', start: '2026-12-20', key: 'k', meId: 'me' }
beforeEach(clearAll)

describe('store', () => {
  test('guarda e lista missões', async () => {
    await saveMission(m)
    expect(await getMission(m.id)).toEqual(m)
    expect(await listMissions()).toEqual([m])
    expect(await getMission('nada')).toBeUndefined()
  })
  test('membros e gastos por missão, upsert por id', async () => {
    await putMembers(m.id, [{ id: 'a', name: 'A', updatedAt: 1, avatar: 0 }])
    await putMembers(m.id, [{ id: 'a', name: 'A2', updatedAt: 2, avatar: 0 }, { id: 'b', name: 'B', updatedAt: 1, avatar: 0 }])
    expect((await members(m.id)).map((x) => x.name).sort()).toEqual(['A2', 'B'])
    expect(await members('outra')).toEqual([])
    const x = { id: 'e1', authorId: 'a', payerId: 'a', description: 'd', date: '2026-12-21', amountCents: 1, split: { a: 1 }, kind: 'GASTO' as const, deleted: false, updatedAt: 1 }
    await putExpenses(m.id, [x])
    expect(await expenses(m.id)).toEqual([x])
  })
  test('última leitura por missão', async () => {
    expect(await getLastFetch(m.id)).toBe(0)
    await setLastFetch(m.id, 5)
    expect(await getLastFetch(m.id)).toBe(5)
  })
})
