// Pacote do grupo: "VSN1" + nonce 12 B + AES-256-GCM (tag 128, "VSN1" como AAD). Espelha MissionPack.kt.
const HEADER = new TextEncoder().encode('VSN1')
const NONCE = 12
const TAG_BYTES = 16
export const MAX_PACK_BYTES = 1_000_000

export const b64decode = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
export const b64encode = (b: Uint8Array): string => btoa(String.fromCharCode(...b))

export function newMissionKey(): string {
  return b64encode(crypto.getRandomValues(new Uint8Array(32)))
}

async function importKey(key: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const raw = b64decode(key)
  if (raw.length !== 32) throw new Error('key size')
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [usage])
}

export function looksLikePack(bytes: Uint8Array): boolean {
  return bytes.length >= HEADER.length + NONCE + TAG_BYTES && HEADER.every((b, i) => bytes[i] === b)
}

export async function sealBytes(plain: Uint8Array, key: string): Promise<Uint8Array> {
  const k = await importKey(key, 'encrypt')
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, additionalData: HEADER as BufferSource, tagLength: 128 }, k, plain as BufferSource))
  const out = new Uint8Array(HEADER.length + NONCE + ct.length)
  out.set(HEADER, 0); out.set(nonce, HEADER.length); out.set(ct, HEADER.length + NONCE)
  return out
}

/** Rejeita (Error) chave errada, byte trocado, arquivo que não é pacote ou grande demais. */
export async function openBytes(bytes: Uint8Array, key: string): Promise<Uint8Array> {
  if (bytes.length > MAX_PACK_BYTES + 64) throw new Error('too big')
  if (!looksLikePack(bytes)) throw new Error('not a pack')
  const k = await importKey(key, 'decrypt')
  const nonce = bytes.slice(HEADER.length, HEADER.length + NONCE)
  const ct = bytes.slice(HEADER.length + NONCE)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource, additionalData: HEADER as BufferSource, tagLength: 128 }, k, ct as BufferSource))
}
