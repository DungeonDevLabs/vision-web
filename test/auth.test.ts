import { describe, expect, test } from 'vitest'
import { authUrl, completeLogin, readToken, type KV } from '../src/drive/auth'

const kv = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), del: (k) => void m.delete(k) } }
const cfg = { clientId: 'cid.apps.googleusercontent.com', redirectUri: 'https://x.github.io/vision-web/' }

describe('authUrl', () => {
  test('pede só drive.file, token na volta, e guarda o state', () => {
    const s = kv()
    const u = new URL(authUrl(cfg, s, false, 'abc123'))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('response_type')).toBe('token')
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file')
    expect(u.searchParams.get('redirect_uri')).toBe(cfg.redirectUri)
    expect(u.searchParams.get('state')).toBe('abc123')
    expect(u.searchParams.get('prompt')).toBeNull()
    expect(s.get('oauth_state')).toBe('abc123')
  })
  test('renovação silenciosa usa prompt=none', () => {
    expect(new URL(authUrl(cfg, kv(), true, 's')).searchParams.get('prompt')).toBe('none')
  })
})

describe('completeLogin', () => {
  test('guarda o token com validade e limpa o state', () => {
    const s = kv(); authUrl(cfg, s, false, 'st')
    expect(completeLogin('#access_token=T1&token_type=Bearer&expires_in=3599&state=st', s, 1000)).toBe('ok')
    expect(readToken(s, 1000 + 3_000_000)).toBe('T1')
    expect(s.get('oauth_state')).toBeNull()
  })
  test('state diferente é recusado e nada é guardado', () => {
    const s = kv(); authUrl(cfg, s, false, 'st')
    expect(completeLogin('#access_token=T1&expires_in=3599&state=outro', s, 1000)).toBe('bad-state')
    expect(readToken(s, 1000)).toBeNull()
  })
  test('erro do Google (precisa de login) é reportado', () => {
    const s = kv(); authUrl(cfg, s, true, 'st')
    expect(completeLogin('#error=interaction_required&state=st', s, 1000)).toBe('interaction_required')
  })
  test('hash sem token e sem erro não é login', () => {
    expect(completeLogin('#vision-mission:abc', kv(), 1000)).toBe('none')
    expect(completeLogin('', kv(), 1000)).toBe('none')
  })
})

describe('readToken', () => {
  test('expira 60 s antes do fim', () => {
    const s = kv(); authUrl(cfg, s, false, 'st')
    completeLogin('#access_token=T&expires_in=3600&state=st', s, 0)
    expect(readToken(s, 3_539_000)).toBe('T')
    expect(readToken(s, 3_541_000)).toBeNull()
  })
  test('sem token guardado devolve null', () => expect(readToken(kv(), 0)).toBeNull())
})
