// Helpers mínimos de DOM. Texto de outras pessoas (nomes, descrições) entra SEMPRE como texto, nunca como HTML.
type Child = Node | string | null | false | undefined
type Props = Record<string, unknown> & { class?: string; onclick?: (e: MouseEvent) => void }

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener)
    else if (k === 'class') el.className = String(v)
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v
    else el.setAttribute(k, String(v))
  }
  for (const c of kids) if (c) el.append(c)
  return el
}

const pt = typeof navigator === 'undefined' || navigator.language.toLowerCase().startsWith('pt')
export const t = (ptText: string, en: string): string => (pt ? ptText : en)

export function toast(msg: string): void {
  const el = h('div', { class: 'toast' }, msg)
  document.body.append(el)
  setTimeout(() => el.remove(), 2600)
}

export async function copy(text: string, done: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast(done) } catch { toast(t('Não deu para copiar', "Couldn't copy")) }
}
