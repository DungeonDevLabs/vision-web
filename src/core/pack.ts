// Pacote do grupo, validação e merge. Espelha MissionPack.kt (validate, merge, buildPack).
import { openBytes, sealBytes } from './crypto'

export type ExpenseKind = 'GASTO' | 'ACERTO'
export const AVATARS = 24
export const PACK_VERSION = 1

export interface MemberDto { id: string; name: string; pixKey?: string | null; driveFileId?: string | null; updatedAt: number; avatar: number }
export interface ExpenseDto {
  id: string; authorId: string; payerId: string; description: string; date: string; amountCents: number
  split: Record<string, number>; kind: ExpenseKind; deleted: boolean; updatedAt: number
}
export interface MissionPack {
  v: number; missionId: string; missionName: string; start: string; end?: string | null; from: string
  members: MemberDto[]; expenses: ExpenseDto[]; sentAt: number
}
/** O que buildPack precisa da missão. */
export interface PackMission { id: string; name: string; start: string; end?: string | null; meId: string }

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
export const isUuid = (s: string): boolean => UUID.test(s)

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

export async function openPack(bytes: Uint8Array, key: string): Promise<MissionPack> {
  return JSON.parse(new TextDecoder().decode(await openBytes(bytes, key))) as MissionPack
}
export const sealPack = (p: MissionPack, key: string): Promise<Uint8Array> => sealBytes(new TextEncoder().encode(JSON.stringify(p)), key)

/** Tudo checado antes de tocar no banco: inválido = nada dele é importado (lança Error). */
export function validate(pack: MissionPack, expectedMissionId: string): MissionPack {
  const ok = (c: boolean, msg: string) => { if (!c) throw new Error(msg) }
  ok(pack.v === PACK_VERSION, `version ${pack.v}`)
  ok(pack.missionId === expectedMissionId, 'another mission')
  ok(Array.isArray(pack.members) && Array.isArray(pack.expenses), 'shape')
  ok(pack.members.length <= 100 && pack.expenses.length <= 10_000, 'too many')
  ok(isUuid(pack.from) && pack.members.some((m) => m.id === pack.from), 'sender')
  ok(pack.members.every((m) => isUuid(m.id) && !!m.name?.trim() && m.name.length <= 40 && (m.pixKey?.length ?? 0) <= 100 &&
    (m.driveFileId?.length ?? 0) <= 200 && Number.isInteger(m.avatar) && m.avatar >= 0 && m.avatar <= AVATARS && Number.isSafeInteger(m.updatedAt)), 'member')
  ok(new Set(pack.members.map((m) => m.id)).size === pack.members.length, 'repeated member')
  const ids = new Set(pack.members.map((m) => m.id))
  ok(new Set(pack.expenses.map((x) => x.id)).size === pack.expenses.length, 'repeated expense')
  for (const x of pack.expenses) {
    ok(isUuid(x.id) && isUuid(x.authorId) && ids.has(x.payerId), 'expense ids')
    const parts = Object.values(x.split ?? {})
    ok(Number.isSafeInteger(x.amountCents) && x.amountCents >= 0 && parts.every((c) => Number.isSafeInteger(c) && c >= 0) &&
      parts.reduce((a, b) => a + b, 0) === x.amountCents, 'split')
    ok(parts.length > 0 && Object.keys(x.split).every((k) => ids.has(k)), 'split members')
    ok((x.kind === 'GASTO' || x.kind === 'ACERTO') && x.description.length <= 200 && Number.isSafeInteger(x.updatedAt), 'kind')
    ok(isIsoDate(x.date), 'date')
  }
  return pack
}

export interface MergeResult { members: MemberDto[]; expenses: ExpenseDto[]; newExpenses: number }

/**
 * Membro: o de maior updatedAt vence (nunca o meu). Gasto: só os escritos pelo remetente, e só se mais novo.
 * Idempotente e independe da ordem dos pacotes.
 */
export function merge(meId: string | null, localMembers: MemberDto[], localExpenses: ExpenseDto[], pack: MissionPack): MergeResult {
  const members = new Map(localMembers.map((m) => [m.id, m]))
  const memberUpserts = pack.members.filter((d) => d.id !== meId).filter((d) => {
    const old = members.get(d.id)
    return !old || old.updatedAt < d.updatedAt
  })
  if (pack.from === meId) return { members: memberUpserts, expenses: [], newExpenses: 0 }
  const expenses = new Map(localExpenses.map((x) => [x.id, x]))
  let fresh = 0
  const expenseUpserts = pack.expenses.filter((d) => d.authorId === pack.from).filter((d) => {
    const old = expenses.get(d.id)
    if (old && (old.authorId !== d.authorId || old.updatedAt >= d.updatedAt)) return false
    if (!old && !d.deleted) fresh++
    return true
  })
  return { members: memberUpserts, expenses: expenseUpserts, newExpenses: fresh }
}

/** O pacote deste aparelho: todos os membros que conheço e só os gastos que eu escrevi (lápides incluídas). */
export function buildPack(m: PackMission, members: MemberDto[], expenses: ExpenseDto[], now: number): MissionPack {
  return {
    v: PACK_VERSION, missionId: m.id, missionName: m.name, start: m.start, end: m.end ?? null, from: m.meId,
    members, expenses: expenses.filter((x) => x.authorId === m.meId), sentAt: now,
  }
}
