import { describe, expect, test } from 'vitest'
import { formatBrl, parseMoney } from '../src/core/money'

describe('parseMoney', () => {
  test.each([['12,5', 1250], ['12.50', 1250], ['1.234,56', 123456], ['1234', 123400], ['0,05', 5], ['R$ 7,00', 700], [' 3,99 ', 399]])('%s → %i', (t, c) => expect(parseMoney(t)).toBe(c))
  test.each(['abc', '-5', '', '0', '0,00', '1,234', '12,3,4', '99999999999'])('%s → null', (t) => expect(parseMoney(t)).toBeNull())
})
describe('formatBrl', () => {
  test('formata centavos', () => {
    expect(formatBrl(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
    expect(formatBrl(5).replace(/\s/g, ' ')).toBe('R$ 0,05')
  })
})
