import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { exportPackFile, fetchOthers, joinFromInvite, publishMine, resetPublished } from '../src/sync'
import { clearAll, expenses, getMission, members, putExpenses, putMembers } from '../src/store'
import { openPack, sealPack, type ExpenseDto, type MissionPack } from '../src/core/pack'
import { parseInvite } from '../src/core/invite'
import type { MissionTransport } from '../src/drive/transport'

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url))
const invite = parseInvite(fx('invite.txt').toString())!
const key = fx('key.txt').toString().trim()
const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CAI = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function memoryTransport(files: Record<string, Uint8Array | null> = {}) {
  const log: string[] = []
  const t: MissionTransport = {
    async publish(_m, memberId, bytes, fileId) { const id = fileId ?? `file-${memberId.slice(0, 4)}`; files[id] = bytes; log.push(`publish:${id}`); return id },
    async fetch(id) { if (!(id in files)) return null; return files[id] },
    async remove(id) { delete files[id] },
  }
  return { t, files, log }
}
const exp = (id: string, authorId: string, updatedAt = 1): ExpenseDto => ({
  id, authorId, payerId: authorId, description: 'x', date: '2026-12-21', amountCents: 100, split: { [authorId]: 100 }, kind: 'GASTO', deleted: false, updatedAt,
})

beforeEach(async () => { await clearAll(); resetPublished() })

describe('joinFromInvite', () => {
  test('cria eu e o convidante, guarda a chave', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    expect(m.key).toBe(key)
    expect((await getMission(m.id))?.meId).toBe(m.meId)
    const ms = await members(m.id)
    expect(ms.map((x) => x.name).sort()).toEqual(['Ana', 'Zé'])
    expect(ms.find((x) => x.id === ANA)?.driveFileId).toBe('drive-file-ana')
  })
  test('entrar de novo no mesmo convite não duplica nem troca o meu id', async () => {
    const a = await joinFromInvite(invite, 'Zé')
    const b = await joinFromInvite(invite, 'Outro')
    expect(b.meId).toBe(a.meId)
    expect(await members(a.id)).toHaveLength(2)
  })
  test('nome vazio é recusado', async () => {
    await expect(joinFromInvite(invite, '  ')).rejects.toThrow('name')
  })
})

describe('fetchOthers', () => {
  test('importa o arquivo do Android e conta só os gastos vivos', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const { t } = memoryTransport({ 'drive-file-ana': new Uint8Array(fx('pack-android.vision')) })
    expect(await fetchOthers(m.id, t, true)).toBe(2)
    expect(await expenses(m.id)).toHaveLength(3)
  })
  test('um 404 não impede os outros', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    await putMembers(m.id, [{ id: CAI, name: 'Cai', driveFileId: 'file-cai', updatedAt: 1, avatar: 0 }])
    const pack: MissionPack = { v: 1, missionId: m.id, missionName: 'Praia', start: '2026-12-20', from: CAI, members: [{ id: CAI, name: 'Cai', updatedAt: 1, avatar: 0 }], expenses: [exp('eeeeeeee-0000-4000-8000-0000000000aa', CAI)], sentAt: 1 }
    const { t } = memoryTransport({ 'file-cai': await sealPack(pack, key) }) // o da Ana sumiu
    expect(await fetchOthers(m.id, t, true)).toBe(1)
  })
  test('pacote adulterado ou de outra chave é ignorado', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const bad = new Uint8Array(fx('pack-android.vision')); bad[bad.length - 1] ^= 1
    expect(await fetchOthers(m.id, memoryTransport({ 'drive-file-ana': bad }).t, true)).toBe(0)
    expect(await expenses(m.id)).toEqual([])
  })
  test('menos de 2 minutos sem force devolve null', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const { t } = memoryTransport({ 'drive-file-ana': new Uint8Array(fx('pack-android.vision')) })
    expect(await fetchOthers(m.id, t, false, 1_000_000)).toBe(2)
    expect(await fetchOthers(m.id, t, false, 1_000_000 + 119_000)).toBeNull()
    expect(await fetchOthers(m.id, t, false, 1_000_000 + 121_000)).toBe(0)
    expect(await fetchOthers(m.id, t, true, 1_000_000 + 122_000)).toBe(0)
  })
  test('erro de rede em um membro não derruba a leitura', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const t: MissionTransport = { publish: async () => 'x', fetch: async () => { throw new Error('rede') }, remove: async () => {} }
    expect(await fetchOthers(m.id, t, true)).toBe(0)
  })
})

describe('publishMine', () => {
  test('primeira vez publica duas vezes e grava o driveFileId no meu membro', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const { t, log, files } = memoryTransport()
    const id = await publishMine(m.id, t)
    expect(log).toHaveLength(2)
    const me = (await members(m.id)).find((x) => x.id === m.meId)!
    expect(me.driveFileId).toBe(id)
    const pack = await openPack(files[id]!, key)
    expect(pack.from).toBe(m.meId)
    expect(pack.members.find((x) => x.id === m.meId)?.driveFileId).toBe(id) // o segundo envio já leva o id
  })
  test('pacote igual não reenvia; gasto novo reenvia', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const { t, log } = memoryTransport()
    await publishMine(m.id, t)
    await publishMine(m.id, t)
    expect(log).toHaveLength(2)
    await putExpenses(m.id, [exp('eeeeeeee-0000-4000-8000-0000000000bb', m.meId, 5)])
    await publishMine(m.id, t)
    expect(log).toHaveLength(3)
  })
  test('sem token a publicação falha mas os dados locais ficam', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    await putExpenses(m.id, [exp('eeeeeeee-0000-4000-8000-0000000000cc', m.meId)])
    const t: MissionTransport = { publish: async () => { throw new Error('Drive: authorization needed') }, fetch: async () => null, remove: async () => {} }
    await expect(publishMine(m.id, t)).rejects.toThrow('authorization')
    expect(await expenses(m.id)).toHaveLength(1)
  })
})

describe('exportPackFile', () => {
  test('gera arquivo que o grupo abre e que leva o meu driveFileId', async () => {
    const m = await joinFromInvite(invite, 'Zé')
    const { t } = memoryTransport()
    const id = await publishMine(m.id, t)
    const f = await exportPackFile(m.id)
    expect(f.name).toBe('missao-Praia.vision')
    const pack = await openPack(new Uint8Array(await f.arrayBuffer()), key)
    expect(pack.members.find((x) => x.id === m.meId)?.driveFileId).toBe(id)
  })
})
