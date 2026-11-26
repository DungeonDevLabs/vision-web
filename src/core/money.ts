/** "12,5", "12.50", "1.234,56", "R$ 7" → centavos; null = inválido ou não positivo. */
export function parseMoney(text: string): number | null {
  const s = text.replace(/R\$/i, '').trim()
  if (!s) return null
  let n: string
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) n = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,9}([.,]\d{1,2})?$/.test(s)) n = s.replace(',', '.')
  else return null
  const cents = Math.round(parseFloat(n) * 100)
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000_00 ? cents : null
}

export const formatBrl = (cents: number): string => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
