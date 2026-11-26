// Ligação com o Drive de verdade: transporte, publicação com atraso (10 s) e estado de login para a tela.
import { driveTransport, browserHttp } from './drive/transport'
import { getToken } from './drive/auth'
import { publishMine } from './sync'

export const transport = driveTransport(browserHttp, getToken, (import.meta.env.VITE_DRIVE_API_KEY as string | undefined) ?? '')
export const status = { needLogin: false, error: '' }
const listeners = new Set<() => void>()
export const onStatus = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) }
const notify = () => listeners.forEach((f) => f())
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Publica o meu pacote ~10 s depois da última mudança. Sem token, o dado fica salvo e a tela pede o login. */
export function schedulePublish(missionId: string, delayMs = 10_000): void {
  clearTimeout(timers.get(missionId))
  timers.set(missionId, setTimeout(() => void publishNow(missionId), delayMs))
}
export async function publishNow(missionId: string): Promise<void> {
  try { await publishMine(missionId, transport); status.needLogin = false; status.error = '' }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    status.needLogin = /authorization needed/.test(msg)
    status.error = status.needLogin ? '' : msg
  }
  notify()
}
