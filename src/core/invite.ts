// Convite do grupo: "vision-mission:" + base64url(JSON). Espelha MissionPack.kt (parseInvite/inviteText).
import { b64decode } from './crypto'
import { isUuid, type MemberDto } from './pack'

export interface Invite { id: string; name: string; start: string; end?: string | null; key: string; from: MemberDto }
export const INVITE_PREFIX = 'vision-mission:'

const toB64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => new TextDecoder().decode(b64decode(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)))

export const inviteText = (i: Invite): string => INVITE_PREFIX + toB64Url(JSON.stringify(i))
/** Link que abre a PWA já com o convite; o fragmento (#) nunca vai ao servidor. `base` = URL da PWA. */
export const inviteLink = (i: Invite, base: string): string => `${base.replace(/#.*$/, '')}#${inviteText(i)}`

/** O convite dentro de [text] (pode vir com outras palavras ou num link); null = não tem ou é inválido. */
export function parseInvite(text: string): Invite | null {
  try {
    const at = text.indexOf(INVITE_PREFIX)
    if (at < 0) return null
    const token = /^[A-Za-z0-9_-]*/.exec(text.slice(at + INVITE_PREFIX.length))![0]
    const i = JSON.parse(fromB64Url(token)) as Invite
    if (!isUuid(i.id) || !isUuid(i.from.id) || !i.name?.trim() || !i.from.name?.trim()) return null
    if (b64decode(i.key).length !== 32) return null
    const d = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Error('date'); return s }
    if (i.end && d(i.end) < d(i.start)) return null
    d(i.start)
    return i
  } catch {
    return null
  }
}
