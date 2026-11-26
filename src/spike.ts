// Teste manual do login por redirecionamento no iPhone instalado (abrir /spike.html). Não faz parte do app.
import { getToken, handleRedirect, login } from './drive/auth'
import { transport } from './live'

const log = document.getElementById('log')!
const say = (s: string) => { log.textContent += s + '\n' }

say(`standalone (instalado): ${(navigator as unknown as { standalone?: boolean }).standalone ?? matchMedia('(display-mode: standalone)').matches}`)
say(`volta do login: ${handleRedirect()}`)
getToken().then((t) => say(`token válido: ${t ? 'sim' : 'não'}`))

document.getElementById('login')!.onclick = () => login()
document.getElementById('test')!.onclick = async () => {
  try {
    const bytes = new TextEncoder().encode(`spike ${new Date().toISOString()}`)
    const id = await transport.publish('spike', 'teste', bytes)
    say(`gravou, id ${id}`)
    const back = await transport.fetch(id)
    say(back ? `leu de volta: ${new TextDecoder().decode(back)}` : 'LEITURA FALHOU (403/404): confira a API key e o referrer')
  } catch (e) { say(`erro: ${e instanceof Error ? e.message : e}`) }
}
