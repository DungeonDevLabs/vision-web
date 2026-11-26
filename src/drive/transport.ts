// Onde cada pessoa publica o próprio pacote (cifrado, público por link). Espelha DriveMissionTransport.kt.
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export type Http = (method: string, url: string, headers: Record<string, string>, body?: Uint8Array) => Promise<{ code: number; body: Uint8Array }>
export interface MissionTransport {
  publish(missionId: string, memberId: string, bytes: Uint8Array, fileId?: string | null): Promise<string>
  /** null = o arquivo sumiu ou não é legível (403/404); lança em problema de rede/servidor. */
  fetch(fileId: string): Promise<Uint8Array | null>
  remove(fileId: string): Promise<void>
}

/** O `Http` real do navegador. */
export const browserHttp: Http = async (method, url, headers, body) => {
  const r = await fetch(url, { method, headers, body: body as BodyInit | undefined })
  return { code: r.status, body: new Uint8Array(await r.arrayBuffer()) }
}

const enc = new TextEncoder()
const text = (b: Uint8Array) => new TextDecoder().decode(b)

export function driveTransport(http: Http, getToken: () => Promise<string | null>, apiKey: string): MissionTransport {
  const need = async () => (await getToken()) ?? Promise.reject(new Error('Drive: authorization needed'))
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
  const check = (r: { code: number; body: Uint8Array }, what: string) => {
    if (r.code < 200 || r.code > 299) throw new Error(`Drive HTTP ${r.code} (${what}): ${text(r.body).slice(0, 300)}`)
    return r
  }
  const idOf = (r: { body: Uint8Array }): string => {
    const id = JSON.parse(text(r.body)).id
    if (!id) throw new Error('Drive: no id')
    return id
  }
  const jsonH = (t: string) => ({ ...auth(t), 'Content-Type': 'application/json; charset=UTF-8' })

  /** Pasta que este app criou dentro de [parent] (null = raiz); cria se faltar. */
  async function folder(t: string, name: string, parent: string | null): Promise<string> {
    const q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` + (parent ? ` and '${parent}' in parents` : '')
    const found = check(await http('GET', `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`, auth(t)), 'find folder')
    const hit = JSON.parse(text(found.body)).files?.[0]?.id
    if (hit) return hit
    const meta = { name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) }
    return idOf(check(await http('POST', `${API}/files?fields=id`, jsonH(t), enc.encode(JSON.stringify(meta))), 'create folder'))
  }

  return {
    async publish(missionId, memberId, bytes, fileId) {
      const t = await need()
      if (fileId) {
        const r = await http('PATCH', `${UPLOAD}/files/${fileId}?uploadType=media&fields=id`, { ...auth(t), 'Content-Type': 'application/octet-stream' }, bytes)
        if (r.code >= 200 && r.code <= 299) return fileId
        if (r.code !== 404) check(r, 'overwrite')
        // Apagado à mão no Drive: cria outro (o id novo vai no próximo pacote).
      }
      const parent = await folder(t, 'missões', await folder(t, 'Vision', null))
      const boundary = `vision-${Date.now()}`
      const meta = JSON.stringify({ name: `missao-${missionId}-${memberId}.vision`, parents: [parent], mimeType: 'application/octet-stream' })
      const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`)
      const tail = enc.encode(`\r\n--${boundary}--`)
      const body = new Uint8Array(head.length + bytes.length + tail.length)
      body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length)
      const id = idOf(check(await http('POST', `${UPLOAD}/files?uploadType=multipart&fields=id`, { ...auth(t), 'Content-Type': `multipart/related; boundary=${boundary}` }, body), 'create'))
      check(await http('POST', `${API}/files/${id}/permissions`, jsonH(t), enc.encode('{"type":"anyone","role":"reader"}')), 'share')
      return id
    },
    async fetch(fileId) {
      const r = await http('GET', `${API}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`, {})
      if (r.code >= 200 && r.code <= 299) return r.body
      if (r.code === 403 || r.code === 404) return null
      throw new Error(`Drive HTTP ${r.code} (fetch)`)
    },
    async remove(fileId) {
      const t = await need()
      const r = await http('DELETE', `${API}/files/${fileId}`, auth(t))
      if (r.code !== 404) check(r, 'remove')
    },
  }
}
