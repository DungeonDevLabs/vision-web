import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { inviteLink, inviteText, parseInvite, type Invite } from '../src/core/invite'

const fixture = readFileSync(new URL('./fixtures/invite.txt', import.meta.url), 'utf8').trim()
const key = readFileSync(new URL('./fixtures/key.txt', import.meta.url), 'utf8').trim()
const ana = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const inv: Invite = { id: '11111111-1111-4111-8111-111111111111', name: 'Praia ☀', start: '2026-12-20', end: '2026-12-30', key, from: { id: ana, name: 'Ana', updatedAt: 1, avatar: 3 } }

describe('parseInvite', () => {
  test('lê o convite gerado pelo Android', () => {
    const i = parseInvite(fixture)
    expect(i?.name).toBe('Praia ☀')
    expect(i?.from.driveFileId).toBe('drive-file-ana')
    expect(i?.key).toBe(key)
  })
  test('aceita texto em volta (WhatsApp)', () => {
    expect(parseInvite(`Bora pra praia! ${fixture} te espero\nlá`)?.id).toBe(inv.id)
  })
  test('aceita link com #', () => {
    expect(parseInvite(`https://x.github.io/VisionPWA/#${fixture}`)?.id).toBe(inv.id)
  })
  test('round trip com inviteLink', () => {
    expect(parseInvite(inviteLink(inv, 'https://x.github.io/VisionPWA/'))).toEqual(inv)
  })
  test('lixo e base64 inválido viram null', () => {
    expect(parseInvite('oi')).toBeNull()
    expect(parseInvite('vision-mission:@@@')).toBeNull()
    expect(parseInvite('vision-mission:aGVsbG8')).toBeNull()
  })
  test('chave que não tem 32 bytes vira null', () => {
    expect(parseInvite(inviteText({ ...inv, key: btoa('curta') }))).toBeNull()
  })
  test('fim antes do início vira null', () => {
    expect(parseInvite(inviteText({ ...inv, end: '2026-12-01' }))).toBeNull()
  })
  test('UUID inválido vira null', () => {
    expect(parseInvite(inviteText({ ...inv, id: 'x' }))).toBeNull()
    expect(parseInvite(inviteText({ ...inv, from: { ...inv.from, id: 'y' } }))).toBeNull()
  })
})
