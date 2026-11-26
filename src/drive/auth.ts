// Login Google por redirecionamento (a página inteira vai ao Google e volta; sem popup, que quebra na PWA do iPhone).
// Fluxo implícito: o Google não deixa trocar código por token sem segredo, e não há servidor aqui.
export interface KV { get(k: string): string | null; set(k: string, v: string): void; del(k: string): void }
export interface AuthConfig { clientId: string; redirectUri: string }
export type LoginResult = 'ok' | 'none' | 'bad-state' | string // string = código de erro do Google (ex.: interaction_required)

export const localKV: KV = {
  get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), del: (k) => localStorage.removeItem(k),
}

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const SKEW_MS = 60_000

/** A URL do Google; guarda o `state` para conferir na volta. [silent] = renovar sem tela (prompt=none). */
export function authUrl(cfg: AuthConfig, kv: KV, silent: boolean, state: string = crypto.randomUUID()): string {
  kv.set('oauth_state', state)
  const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: 'token', scope: SCOPE, state, include_granted_scopes: 'true' })
  if (silent) q.set('prompt', 'none')
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

/** Lê o fragmento da volta do Google. 'none' = a página não voltou de um login (ex.: é um convite). */
export function completeLogin(hash: string, kv: KV, now = Date.now()): LoginResult {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const token = p.get('access_token'), error = p.get('error')
  if (!token && !error) return 'none'
  const expected = kv.get('oauth_state')
  kv.del('oauth_state')
  if (!expected || p.get('state') !== expected) return 'bad-state'
  if (error || !token) return error ?? 'none'
  kv.set('oauth_ever', '1')
  kv.set('oauth_token', token)
  kv.set('oauth_exp', String(now + Number(p.get('expires_in') ?? 0) * 1000))
  return 'ok'
}

/** O token, se ainda valer (com folga de 1 min); null = precisa entrar de novo. */
export function readToken(kv: KV, now = Date.now()): string | null {
  const t = kv.get('oauth_token'), exp = Number(kv.get('oauth_exp'))
  return t && exp - SKEW_MS > now ? t : null
}

const SILENT_EVERY_MS = 10 * 60_000

/** Já entrou alguma vez, o token venceu e não tentou em silêncio há pouco (evita laço de redirecionamentos). */
export function shouldSilentLogin(kv: KV, now = Date.now()): boolean {
  return !!kv.get('oauth_ever') && !readToken(kv, now) && now - Number(kv.get('oauth_silent_at') ?? 0) > SILENT_EVERY_MS
}
export const markSilentAttempt = (kv: KV, now = Date.now()): void => kv.set('oauth_silent_at', String(now))

const config = (): AuthConfig => ({
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
  redirectUri: location.origin + import.meta.env.BASE_URL,
})
export const login = (silent = false): void => { location.href = authUrl(config(), localKV, silent) }
/** Renovar sem tela: se o Google ainda lembra de você, volta na hora. Chame ao abrir o app. */
export function trySilentLogin(): boolean {
  if (!shouldSilentLogin(localKV)) return false
  markSilentAttempt(localKV)
  login(true)
  return true
}
export const getToken = async (): Promise<string | null> => readToken(localKV)
/** Chame ao abrir a página; limpa o fragmento do token da barra de endereço. */
export function handleRedirect(): LoginResult {
  const r = completeLogin(location.hash, localKV)
  if (r !== 'none') history.replaceState(null, '', location.pathname + location.search)
  return r
}
