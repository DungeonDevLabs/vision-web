import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { avatarName, parsePalette, parseSprite } from '../src/ui/sprite'

const palette = parsePalette(readFileSync('src/sprites/palette.txt', 'utf8'))
const txt = (n: string) => readFileSync(`src/sprites/${n}.txt`, 'utf8')

describe('parsePalette', () => {
  test('lê letra e cor', () => {
    expect(palette.get('k')).toBe('#1A1030')
    expect(palette.get('w')).toBe('#FFD36E')
  })
})

describe('parseSprite', () => {
  test('a moeda tem 6 quadros de 16x16 a 10 fps em loop', () => {
    const s = parseSprite(txt('coin'), palette)
    expect([s.width, s.height, s.fps, s.loop, s.frames.length]).toEqual([16, 16, 10, true, 6])
  })
  test('todo sprite copiado para a PWA é válido', () => {
    for (const f of readdirSync('src/sprites').filter((n) => n !== 'palette.txt')) expect(() => parseSprite(readFileSync(`src/sprites/${f}`, 'utf8'), palette), f).not.toThrow()
  })
  test('rejeita número de quadros errado', () => {
    expect(() => parseSprite(txt('coin').replace('frames: 6', 'frames: 5'), palette)).toThrow('frames')
  })
  test('rejeita cor fora da paleta e quadro fora do tamanho', () => {
    expect(() => parseSprite('name: x\nsize: 2x1\nframes: 1\nfps: 0\nloop: no\n--- 1\n!.', palette)).toThrow('palette')
    expect(() => parseSprite('name: x\nsize: 2x1\nframes: 1\nfps: 0\nloop: no\n--- 1\nk', palette)).toThrow('size')
  })
})

describe('avatarName', () => {
  const ids = ['ccc', 'aaa', 'bbb']
  test('escolhido vale; senão a posição entre os ids ordenados (igual em todo aparelho)', () => {
    expect(avatarName(ids, 'ccc', 7)).toBe('avatar_7')
    expect(avatarName(ids, 'aaa', 0)).toBe('avatar_1')
    expect(avatarName(ids, 'ccc', 0)).toBe('avatar_3')
  })
  test('passa de 24 e volta ao começo; valor fora de 1..24 conta como automático', () => {
    const many = Array.from({ length: 30 }, (_, i) => String(i).padStart(2, '0'))
    expect(avatarName(many, '25', 0)).toBe('avatar_2')
    expect(avatarName(ids, 'bbb', 99)).toBe('avatar_2')
  })
})
