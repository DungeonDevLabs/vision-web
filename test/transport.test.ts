import { describe, expect, test } from 'vitest'
import { driveTransport, type Http } from '../src/drive/transport'

type Call = { method: string; url: string; headers: Record<string, string>; body?: Uint8Array }
const json = (o: unknown) => new TextEncoder().encode(JSON.stringify(o))
const dec = (b?: Uint8Array) => new TextDecoder().decode(b)

function fake(answer: (c: Call) => { code: number; body?: Uint8Array }) {
  const calls: Call[] = []
  const http: Http = async (method, url, headers, body) => { const c = { method, url, headers, body }; calls.push(c); const r = answer(c); return { code: r.code, body: r.body ?? new Uint8Array() } }
  return { calls, http }
}
const token = async () => 'tok'

describe('publish', () => {
  test('sem fileId cria as pastas, envia multipart e abre anyone/reader', async () => {
    const f = fake((c) => {
      if (c.method === 'GET') return { code: 200, body: json({ files: [] }) }
      if (c.url.includes('/permissions')) return { code: 200, body: json({}) }
      return { code: 200, body: json({ id: c.url.includes('uploadType=multipart') ? 'FILE1' : 'FOLDER' }) }
    })
    const id = await driveTransport(f.http, token, 'KEY').publish('m1', 'u1', new Uint8Array([1, 2, 3]))
    expect(id).toBe('FILE1')
    const up = f.calls.find((c) => c.url.includes('uploadType=multipart'))!
    expect(up.headers.Authorization).toBe('Bearer tok')
    expect(dec(up.body)).toContain('missao-m1-u1.vision')
    const perm = f.calls.find((c) => c.url.endsWith('/files/FILE1/permissions'))!
    expect(dec(perm.body)).toBe('{"type":"anyone","role":"reader"}')
    expect(f.calls.filter((c) => c.method === 'POST' && !c.url.includes('upload') && !c.url.includes('permissions'))).toHaveLength(2) // Vision e missões
  })
  test('com fileId sobrescreve e devolve o mesmo id', async () => {
    const f = fake(() => ({ code: 200, body: json({ id: 'F' }) }))
    expect(await driveTransport(f.http, token, 'KEY').publish('m', 'u', new Uint8Array([1]), 'F')).toBe('F')
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0].method).toBe('PATCH')
    expect(f.calls[0].url).toContain('/upload/drive/v3/files/F?uploadType=media')
  })
  test('PATCH 404 (apagado à mão) cai para criar um arquivo novo', async () => {
    const f = fake((c) => {
      if (c.method === 'PATCH') return { code: 404 }
      if (c.method === 'GET') return { code: 200, body: json({ files: [{ id: 'P' }] }) }
      return { code: 200, body: json({ id: 'NOVO' }) }
    })
    expect(await driveTransport(f.http, token, 'KEY').publish('m', 'u', new Uint8Array([1]), 'F')).toBe('NOVO')
  })
  test('sem token lança "authorization needed"', async () => {
    const f = fake(() => ({ code: 200 }))
    await expect(driveTransport(f.http, async () => null, 'KEY').publish('m', 'u', new Uint8Array())).rejects.toThrow('authorization needed')
  })
  test('erro do Drive lança com o código', async () => {
    const f = fake(() => ({ code: 500 }))
    await expect(driveTransport(f.http, token, 'KEY').publish('m', 'u', new Uint8Array(), 'F')).rejects.toThrow('500')
  })
})

describe('fetch', () => {
  test('lê só com a API key, sem token', async () => {
    const f = fake(() => ({ code: 200, body: new Uint8Array([9]) }))
    expect(await driveTransport(f.http, token, 'K&1').fetch('ab/c')).toEqual(new Uint8Array([9]))
    expect(f.calls[0].url).toBe('https://www.googleapis.com/drive/v3/files/ab%2Fc?alt=media&key=K%261')
    expect(f.calls[0].headers.Authorization).toBeUndefined()
  })
  test('403 e 404 viram null; 500 lança', async () => {
    for (const code of [403, 404]) expect(await driveTransport(fake(() => ({ code })).http, token, 'K').fetch('x')).toBeNull()
    await expect(driveTransport(fake(() => ({ code: 500 })).http, token, 'K').fetch('x')).rejects.toThrow('500')
  })
})

describe('remove', () => {
  test('apaga e aceita 404', async () => {
    const f = fake(() => ({ code: 404 }))
    await driveTransport(f.http, token, 'K').remove('X')
    expect(f.calls[0].method).toBe('DELETE')
  })
})
