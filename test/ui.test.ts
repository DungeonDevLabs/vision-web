// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.hoisted(() => { Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true }) }) // textos em PT, como no iPhone do grupo

vi.mock('../src/live', () => ({
  transport: { publish: async () => 'x', fetch: async () => null, remove: async () => {} },
  status: { needLogin: false, error: '' },
  onStatus: () => () => {},
  schedulePublish: () => {},
  publishNow: async () => {},
}))

import { joinScreen } from '../src/ui/join'
import { missionScreen } from '../src/ui/mission'
import { supportDrawer } from '../src/ui/support'
import { clearAll, putExpenses, putMembers, type Mission } from '../src/store'
import { parseInvite } from '../src/core/invite'

const inviteText = readFileSync('test/fixtures/invite.txt', 'utf8').trim()
const flush = () => new Promise((r) => setTimeout(r, 20))
HTMLCanvasElement.prototype.getContext = (() => null) as never // jsdom não desenha canvas
beforeEach(async () => { await clearAll(); document.body.innerHTML = '' })

describe('entrar', () => {
  test('colar convite válido e dizer o nome leva à missão', async () => {
    const go = vi.fn()
    const el = await joinScreen(go)
    document.body.append(el)
    const code = el.querySelector('textarea')!, name = el.querySelector('input')!
    code.value = `oi! ${inviteText}`; code.dispatchEvent(new Event('input'))
    name.value = 'Zé'
    ;[...el.querySelectorAll('button')].find((b) => b.className === 'primary')!.click()
    await flush()
    expect(go).toHaveBeenCalledOnce()
    expect(go.mock.calls[0][0].name).toBe('Praia ☀')
  })
  test('convite inválido mostra erro e não entra', async () => {
    const go = vi.fn()
    const el = await joinScreen(go)
    const code = el.querySelector('textarea')!
    code.value = 'lixo'; code.dispatchEvent(new Event('input'))
    expect(el.querySelector('.err')!.textContent).toBe('Convite inválido')
    ;[...el.querySelectorAll('button')].find((b) => b.className === 'primary')!.click()
    await flush()
    expect(go).not.toHaveBeenCalled()
  })
})

describe('missão', () => {
  const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', BIA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const m: Mission = { id: '11111111-1111-4111-8111-111111111111', name: 'Praia', start: '2026-12-20', key: 'k', meId: ME }
  test('nomes e descrições de outras pessoas entram como texto, nunca como HTML', async () => {
    const evil = '<img src=x onerror="window.pwned=1">'
    await putMembers(m.id, [{ id: ME, name: 'Eu', updatedAt: 1, avatar: 0 }, { id: BIA, name: evil, updatedAt: 1, avatar: 0 }])
    await putExpenses(m.id, [{ id: 'eeeeeeee-0000-4000-8000-000000000001', authorId: BIA, payerId: BIA, description: evil, date: '2026-12-21', amountCents: 1000, split: { [ME]: 500, [BIA]: 500 }, kind: 'GASTO', deleted: false, updatedAt: 1 }])
    const el = await missionScreen(m, () => {})
    document.body.append(el)
    expect(el.querySelector('img')).toBeNull()
    expect(el.textContent).toContain(evil)
    expect(el.textContent).toContain('R$')
  })
  test('aba Acertos mostra Paguei só para quem deve', async () => {
    await putMembers(m.id, [{ id: ME, name: 'Eu', updatedAt: 1, avatar: 0 }, { id: BIA, name: 'Bia', updatedAt: 1, avatar: 0 }])
    await putExpenses(m.id, [{ id: 'eeeeeeee-0000-4000-8000-000000000001', authorId: BIA, payerId: BIA, description: 'Jantar', date: '2026-12-21', amountCents: 1000, split: { [ME]: 500, [BIA]: 500 }, kind: 'GASTO', deleted: false, updatedAt: 1 }])
    const el = await missionScreen(m, () => {})
    ;[...el.querySelectorAll('.pills button')][1].dispatchEvent(new MouseEvent('click'))
    await flush()
    expect(el.textContent).toContain('Eu paga Bia')
    expect([...el.querySelectorAll('button')].some((b) => b.textContent === 'Paguei')).toBe(true)
  })
})

describe('moedinha de apoio', () => {
  test('tocar abre a gaveta e copiar põe o Pix na área de transferência', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    const el = supportDrawer()
    document.body.append(el)
    const panel = el.querySelector('.support-panel') as HTMLElement
    expect(panel.hidden).toBe(true)
    ;(el.querySelector('.coin-tab') as HTMLElement).click()
    expect(panel.hidden).toBe(false)
    ;(panel.querySelector('button.primary') as HTMLElement).click()
    await flush()
    expect(write).toHaveBeenCalledWith('luidy.moura.dev@gmail.com')
  })
  test('o convite do teste é válido', () => expect(parseInvite(inviteText)).not.toBeNull())
})
