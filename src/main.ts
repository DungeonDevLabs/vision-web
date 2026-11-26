import './style.css'
import { handleRedirect } from './drive/auth'
import { parseInvite } from './core/invite'
import { getMission, type Mission } from './store'
import { publishNow } from './live'
import { joinScreen } from './ui/join'
import { missionScreen } from './ui/mission'
import { supportDrawer } from './ui/support'

const LAST = 'last_mission'
const app = document.getElementById('app')!
document.body.append(supportDrawer())

const show = (el: HTMLElement) => app.replaceChildren(el)
async function home(invite = null as Parameters<typeof joinScreen>[1]) {
  localStorage.removeItem(LAST)
  show(await joinScreen(openMission, invite))
}
async function openMission(m: Mission) {
  localStorage.setItem(LAST, m.id)
  show(await missionScreen(m, () => void home()))
}

async function boot() {
  const login = handleRedirect() // 'ok' = acabou de voltar do Google
  const invite = parseInvite(location.hash)
  if (invite) {
    history.replaceState(null, '', location.pathname + location.search)
    const have = await getMission(invite.id)
    return have ? openMission(have) : home(invite)
  }
  const last = localStorage.getItem(LAST)
  const m = last ? await getMission(last) : undefined
  if (m) {
    await openMission(m)
    if (login === 'ok') void publishNow(m.id) // o que ficou salvo sem login sobe agora
    return
  }
  return home()
}
void boot()
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
