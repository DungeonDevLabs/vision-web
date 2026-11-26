import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { looksLikePack, newMissionKey, openBytes, sealBytes } from '../src/core/crypto'

const fx = (n: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)))
const key = readFileSync(new URL('./fixtures/key.txt', import.meta.url), 'utf8').trim()
const enc = new TextEncoder()

describe('crypto VSN1', () => {
  test('abre o arquivo gerado pelo Android', async () => {
    const plain = await openBytes(fx('pack-android.vision'), key)
    const json = JSON.parse(new TextDecoder().decode(plain))
    expect(json.missionName).toBe('Praia ☀')
    expect(json.expenses).toHaveLength(3)
    expect(json.expenses[0].description).toBe('Hotel é café')
  })
  test('seal e open devolvem o mesmo', async () => {
    const k = newMissionKey()
    const out = await openBytes(await sealBytes(enc.encode('oi'), k), k)
    expect(new TextDecoder().decode(out)).toBe('oi')
  })
  test('seal começa com VSN1 e muda a cada vez', async () => {
    const a = await sealBytes(enc.encode('x'), key)
    const b = await sealBytes(enc.encode('x'), key)
    expect(new TextDecoder().decode(a.slice(0, 4))).toBe('VSN1')
    expect(a).not.toEqual(b)
  })
  test('chave errada rejeita', async () => {
    await expect(openBytes(fx('pack-android.vision'), newMissionKey())).rejects.toThrow()
  })
  test('um byte trocado rejeita', async () => {
    const b = fx('pack-android.vision').slice()
    b[b.length - 1] ^= 1
    await expect(openBytes(b, key)).rejects.toThrow()
  })
  test('arquivo sem VSN1 rejeita', async () => {
    await expect(openBytes(new Uint8Array(100), key)).rejects.toThrow('not a pack')
  })
  test('arquivo grande demais rejeita', async () => {
    await expect(openBytes(new Uint8Array(1_000_065), key)).rejects.toThrow('too big')
  })
  test('looksLikePack falso para menos de 32 bytes', () => {
    expect(looksLikePack(enc.encode('VSN1'))).toBe(false)
    expect(looksLikePack(fx('pack-android.vision'))).toBe(true)
  })
  test('chave que não tem 32 bytes rejeita', async () => {
    await expect(sealBytes(enc.encode('x'), btoa('curta'))).rejects.toThrow('key size')
  })
})
