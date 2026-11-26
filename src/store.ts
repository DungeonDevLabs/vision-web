// Armazenamento local (IndexedDB): missões, membros, gastos e última leitura do Drive.
import { clear, del, get, keys, set } from 'idb-keyval'
import type { ExpenseDto, MemberDto } from './core/pack'

export interface Mission { id: string; name: string; start: string; end?: string | null; key: string; meId: string }

const upsert = <T extends { id: string }>(old: T[], add: T[]): T[] => {
  const map = new Map(old.map((x) => [x.id, x]))
  add.forEach((x) => map.set(x.id, x))
  return [...map.values()]
}

export const clearAll = (): Promise<void> => clear()
export const saveMission = (m: Mission) => set(`m:${m.id}`, m)
export const getMission = (id: string): Promise<Mission | undefined> => get(`m:${id}`)
export const deleteMission = async (id: string) => { await Promise.all([`m:${id}`, `mem:${id}`, `exp:${id}`, `fetch:${id}`].map((k) => del(k))) }
export async function listMissions(): Promise<Mission[]> {
  const ks = (await keys()).filter((k) => typeof k === 'string' && k.startsWith('m:'))
  return (await Promise.all(ks.map((k) => get<Mission>(k)))).filter((m): m is Mission => !!m)
}
export const members = async (missionId: string): Promise<MemberDto[]> => (await get<MemberDto[]>(`mem:${missionId}`)) ?? []
export const expenses = async (missionId: string): Promise<ExpenseDto[]> => (await get<ExpenseDto[]>(`exp:${missionId}`)) ?? []
export const putMembers = async (missionId: string, add: MemberDto[]) => set(`mem:${missionId}`, upsert(await members(missionId), add))
export const putExpenses = async (missionId: string, add: ExpenseDto[]) => set(`exp:${missionId}`, upsert(await expenses(missionId), add))
export const getLastFetch = async (missionId: string): Promise<number> => (await get<number>(`fetch:${missionId}`)) ?? 0
export const setLastFetch = (missionId: string, ms: number) => set(`fetch:${missionId}`, ms)
