// Entrar na missão, publicar o meu pacote e ler os dos outros (Drive). Espelha MissionRepository.publishDrive/fetchDrive.
import { buildPack, merge, openPack, sealPack, validate, type MemberDto } from './core/pack'
import type { Invite } from './core/invite'
import { expenses, getLastFetch, getMission, members, putExpenses, putMembers, saveMission, setLastFetch, type Mission } from './store'
import type { MissionTransport } from './drive/transport'

export const FETCH_EVERY_MS = 120_000
const published = new Map<string, string>() // missão → assinatura do último pacote publicado (só nesta sessão)
export const resetPublished = () => published.clear()

/** Entra pelo convite: eu (id novo) + quem convidou. Já estar na missão devolve a que existe, com o meu id de antes. */
export async function joinFromInvite(inv: Invite, myName: string): Promise<Mission> {
  const name = myName.trim().slice(0, 40)
  if (!name) throw new Error('name')
  const old = await getMission(inv.id)
  if (old) return old
  const m: Mission = { id: inv.id, name: inv.name, start: inv.start, end: inv.end ?? null, key: inv.key, meId: crypto.randomUUID() }
  await saveMission(m)
  await putMembers(m.id, [inv.from, { id: m.meId, name, updatedAt: Date.now(), avatar: 0 }])
  return m
}

async function myPack(m: Mission, now: number) {
  return buildPack({ id: m.id, name: m.name, start: m.start, end: m.end, meId: m.meId }, await members(m.id), await expenses(m.id), now)
}
const signature = (p: { members: unknown; expenses: unknown }) => JSON.stringify([p.members, p.expenses])

/** Publica o meu pacote. Na primeira vez publica duas: a segunda já leva o meu driveFileId. Pacote igual não reenvia. */
export async function publishMine(missionId: string, transport: MissionTransport): Promise<string> {
  const m = (await getMission(missionId))!
  const me = (await members(missionId)).find((x) => x.id === m.meId)!
  let pack = await myPack(m, Date.now())
  if (me.driveFileId && published.get(missionId) === signature(pack)) return me.driveFileId
  const fileId = await transport.publish(missionId, m.meId, await sealPack(pack, m.key), me.driveFileId)
  if (fileId !== me.driveFileId) {
    const next: MemberDto = { ...me, driveFileId: fileId, updatedAt: Math.max(Date.now(), me.updatedAt + 1) }
    await putMembers(missionId, [next])
    pack = await myPack(m, Date.now())
    await transport.publish(missionId, m.meId, await sealPack(pack, m.key), fileId)
  }
  published.set(missionId, signature(pack))
  return fileId
}

/** Lê o arquivo de cada outro membro que publicou. Devolve quantos gastos eram novos; null = lido há menos de 2 min. */
export async function fetchOthers(missionId: string, transport: MissionTransport, force: boolean, now = Date.now()): Promise<number | null> {
  const m = await getMission(missionId)
  if (!m) return null
  const last = await getLastFetch(missionId)
  if (!force && last && now - last < FETCH_EVERY_MS) return null
  await setLastFetch(missionId, now)
  let fresh = 0
  for (const other of (await members(missionId)).filter((x) => x.id !== m.meId && x.driveFileId)) {
    try {
      const bytes = await transport.fetch(other.driveFileId!)
      if (!bytes) continue
      const pack = validate(await openPack(bytes, m.key), missionId)
      const r = merge(m.meId, await members(missionId), await expenses(missionId), pack)
      await putMembers(missionId, r.members)
      await putExpenses(missionId, r.expenses)
      fresh += r.newExpenses
    } catch { /* arquivo sumido, de outra chave ou adulterado: esse membro é pulado, os outros entram */ }
  }
  return fresh
}

/** O pacote como arquivo `.vision` para mandar ao grupo (o app Android já sabe importar). */
export async function exportPackFile(missionId: string): Promise<File> {
  const m = (await getMission(missionId))!
  const bytes = await sealPack(await myPack(m, Date.now()), m.key)
  const slug = m.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'grupo'
  return new File([bytes as BlobPart], `missao-${slug}.vision`, { type: 'application/octet-stream' })
}
