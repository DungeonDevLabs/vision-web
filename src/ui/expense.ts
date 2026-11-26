import { saveExpense } from '../ledger'
import { members, expenses, type Mission } from '../store'
import { parseMoney } from '../core/money'
import { h, t } from './dom'

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Formulário de gasto: descrição, valor, data, quem pagou e quem divide. [editId] edita um gasto meu. */
export async function expenseForm(m: Mission, editId: string | null, done: (saved: boolean) => void): Promise<HTMLElement> {
  const ms = await members(m.id)
  const old = editId ? (await expenses(m.id)).find((x) => x.id === editId) : undefined
  const desc = h('input', { type: 'text', maxLength: 200, value: old?.description ?? '', placeholder: t('Descrição (ex.: Jantar)', 'Description (e.g. Dinner)') })
  const amount = h('input', { type: 'text', inputMode: 'decimal', value: old ? (old.amountCents / 100).toFixed(2).replace('.', ',') : '', placeholder: t('Valor (ex.: 45,90)', 'Amount (e.g. 45.90)') })
  const date = h('input', { type: 'date', value: old?.date ?? today() })
  const payer = h('select', {}, ...ms.map((x) => h('option', { value: x.id, selected: x.id === (old?.payerId ?? m.meId) }, x.name + (x.id === m.meId ? t(' (eu)', ' (me)') : ''))))
  const checks = ms.map((x) => ({ id: x.id, box: h('input', { type: 'checkbox', checked: old ? x.id in old.split : true }), name: x.name }))
  const err = h('p', { class: 'err', role: 'alert' })
  const save = h('button', {
    class: 'primary block',
    onclick: async () => {
      const cents = parseMoney(amount.value)
      if (cents === null) { err.textContent = t('Valor inválido', 'Invalid amount'); return }
      try {
        await saveExpense(m, { id: editId ?? undefined, description: desc.value, amountCents: cents, payerId: payer.value, splitAmong: checks.filter((c) => c.box.checked).map((c) => c.id), date: date.value })
        done(true)
      } catch (e) {
        const k = e instanceof Error ? e.message : ''
        err.textContent = k === 'description' ? t('Descreva o gasto', 'Describe the expense') : k === 'split' ? t('Escolha quem divide', 'Choose who splits') : k === 'date' ? t('Data inválida', 'Invalid date') : t('Não deu para salvar', "Couldn't save")
      }
    },
  }, t('Salvar', 'Save'))
  return h('section', {},
    h('h2', {}, editId ? t('Editar gasto', 'Edit expense') : t('Novo gasto', 'New expense')),
    desc, amount, date,
    h('label', {}, t('Quem pagou', 'Paid by'), payer),
    h('fieldset', {}, h('legend', {}, t('Dividir entre', 'Split between')), ...checks.map((c) => h('label', { class: 'check' }, c.box, c.name))),
    err, save, h('button', { class: 'block', onclick: () => done(false) }, t('Cancelar', 'Cancel')),
  )
}
