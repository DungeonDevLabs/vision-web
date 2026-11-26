# VisionPWA — missões em grupo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA instalável no iPhone em que um amigo entra numa missão criada no Vision (Android), lança os próprios gastos e vê/registra o acerto, sincronizando pelo Drive no mesmo formato do Android.

**Architecture:** Módulos puros em TypeScript (cifra, pacote, merge, acerto, convite) portados 1:1 do Kotlin e testados contra arquivos reais do Android; uma camada fina de Drive (REST, login OAuth por redirecionamento) e telas simples em cima. Sem servidor.

**Tech Stack:** TypeScript, Vite, Vitest, WebCrypto, IndexedDB (lib `idb-keyval`), Service Worker + manifest, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-25-visionpwa-missoes-design.md` (no repo Vision até o repo novo existir; copiar para `VisionPWA/docs/`).

## Global Constraints

- Repo novo: `d:\Documents\7 - Projetos pessoais\DVL\VisionPWA` (pasta acima do Vision). Código fonte de referência: `Vision/app/src/main/java/app/vision/finance/mission/` (`MissionPack.kt`, `DriveMissionTransport.kt`, `MissionRules.kt`).
- Pacote: `VSN1` (ASCII) + nonce 12 B + AES-256-GCM, tag 128 bits, `VSN1` como AAD; JSON `{v:1, missionId, missionName, start, end?, from, members[], expenses[], sentAt}`; máx. 1 000 000 B; v == 1.
- Convite: prefixo `vision-mission:` + base64url sem padding do JSON `{id,name,start,end?,key,from}`; chave = 32 B em base64.
- Valores em centavos inteiros (`number` seguro ou `bigint`; usar `number` e validar `Number.isSafeInteger`).
- Drive: escopo `drive.file`; arquivo `Vision/missões/missao-<missionId>-<memberId>.vision`, `anyone/reader`; leitura dos outros só com API key (`?alt=media&key=`).
- `merge` comutativo e idempotente; o membro "eu" nunca é escrito por pacote de fora; gastos só do `authorId == from`.
- Textos em PT e EN (função `t(pt, en)` como no Android).
- Nenhum dado financeiro, chave de missão ou token em log, URL enviada a terceiros ou analytics.

## Review Focus

- Pacote adulterado/chave errada/arquivo que não é pacote: ignorado sem travar nem importar nada.
- Pacote de membro sumido (404/403 no Drive): pula esse membro, o resto sincroniza.
- Token expirado no meio de um lançamento: o gasto fica salvo local e é publicado após novo login.
- Convite colado com texto em volta (WhatsApp) ou link com `#`: reconhece igual.
- Valor "12,5", "12.50", "1.234,56" no campo de gasto: vira centavos certos; divisão com resto distribui centavos sem perder nenhum.

## File Structure

```
VisionPWA/
  index.html, vite.config.ts, package.json, tsconfig.json
  public/manifest.webmanifest, public/sw.js, public/icons/
  src/core/crypto.ts      # sealBytes/openBytes (VSN1)
  src/core/pack.ts        # tipos, validate, merge, buildPack
  src/core/invite.ts      # parseInvite, inviteLink
  src/core/settle.ts      # balances, settle
  src/core/money.ts       # parseMoney, splitEqual, formatBrl
  src/drive/auth.ts       # login por redirecionamento, token
  src/drive/transport.ts  # publish/fetch/remove
  src/store.ts            # IndexedDB: missões, membros, gastos, chave, sessão
  src/sync.ts             # publicar o meu, ler os outros
  src/ui/*.ts             # telas: entrar, missão, gasto, acertos, apoio
  test/*.test.ts, test/fixtures/
  docs/ARCHITECTURE_MAP.md
```

---

### Task 1: Scaffold + deploy + spike do login no iPhone (portão)

**Files:** Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `src/drive/auth.ts`, `src/spike.ts`, `.github/workflows/pages.yml`, `.env.example`; init git no `VisionPWA`.

**Interfaces:**
- Produces: `login(): void` (redireciona ao Google), `handleRedirect(): Promise<boolean>` (lê o token do retorno), `getToken(): Promise<string | null>` (válido, renova com `prompt=none` e devolve null se precisar de login).

- [ ] **Step 1:** Criar o projeto Vite TS + Vitest, `git init`, repo no GitHub, Pages por Actions (`vite build`, `base` = nome do repo). Rodar `npm run build` e abrir a URL publicada.
- [ ] **Step 2:** Implementar `login`/`handleRedirect`/`getToken` em `src/drive/auth.ts` com o fluxo implícito do Google (`response_type=token`, `scope=drive.file`, `redirect_uri` = URL da PWA, `state` aleatório validado na volta); `client_id` e API key vêm de `import.meta.env.VITE_*`. Token e expiração em `localStorage`.
- [ ] **Step 3:** `src/spike.ts`: botão Entrar → após a volta, cria um arquivo `spike.txt` em `Vision/missões` via REST e o lê de novo com a API key.
- [ ] **Step 4 (manual, no iPhone):** instalar na tela inicial, tocar Entrar, aprovar no Google. **Passa quando** volta para a PWA instalada já logada, escreve e lê o arquivo, e `getToken()` renova ou pede login limpo após 1 h. **Se falhar:** parar e reavaliar o login (ex.: fluxo de código com PKCE ou abrir só no Safari) antes das próximas tarefas.
- [ ] **Step 5: Commit** `feat: scaffold, deploy e spike do login`.

### Task 2: Cifra VSN1 com vetores do Android

**Files:** Create: `src/core/crypto.ts`, `test/crypto.test.ts`, `test/fixtures/` ; no repo Vision: um teste JVM descartável que grava os fixtures.

**Interfaces:**
- Produces: `sealBytes(plain: Uint8Array, key: string): Promise<Uint8Array>`, `openBytes(bytes: Uint8Array, key: string): Promise<Uint8Array>` (rejeita com `Error` para chave errada, byte trocado, sem cabeçalho ou > 1 000 064 B), `looksLikePack(bytes): boolean`, `newMissionKey(): string`.

- [ ] **Step 1:** No Vision, escrever um teste JVM temporário (não commitar) que usa `seal`/`sealBytes` com chave fixa e grava em `build/fixtures`: `pack-android.vision` (pacote válido com 2 membros e 3 gastos, 1 lápide), `key.txt`, `pack-android.json` (o JSON esperado). Copiar para `VisionPWA/test/fixtures/`.
- [ ] **Step 2: testes** em `test/crypto.test.ts`: `abre o arquivo do Android e bate com o JSON`; `seal→open devolve o mesmo`; `chave errada rejeita`; `um byte trocado rejeita`; `arquivo sem VSN1 rejeita`; `looksLikePack` falso para < 28 B.
- [ ] **Step 3:** Rodar `npx vitest run test/crypto.test.ts` → FAIL (módulo não existe).
- [ ] **Step 4:** Implementar com `crypto.subtle` (`AES-GCM`, `additionalData = "VSN1"`, `tagLength: 128`, nonce aleatório de 12 B no `seal`).
- [ ] **Step 5:** Rodar de novo → PASS. **Commit** `feat: cifra VSN1`.

### Task 3: Pacote, validate e merge

**Files:** Create: `src/core/pack.ts`, `test/pack.test.ts`.

**Interfaces:**
- Consumes: `openBytes`, `sealBytes` (Task 2).
- Produces: tipos `MemberDto {id,name,pixKey?,driveFileId?,updatedAt,avatar}`, `ExpenseDto {id,authorId,payerId,description,date,amountCents,split:Record<string,number>,kind:'GASTO'|'ACERTO',deleted,updatedAt}`, `MissionPack`; `openPack(bytes, key): Promise<MissionPack>`; `sealPack(pack, key): Promise<Uint8Array>`; `validate(pack, expectedMissionId): MissionPack` (lança `Error`); `merge(meId: string | null, localMembers: MemberDto[], localExpenses: ExpenseDto[], pack: MissionPack): {members: MemberDto[], expenses: ExpenseDto[], newExpenses: number}`; `buildPack(mission, members, expenses, now): MissionPack`.

- [ ] **Step 1: testes** (portar `MissionPackTest`/merge do Android quando existir; senão escrever): `validate` rejeita versão ≠ 1, missão errada, remetente fora dos membros, UUID inválido, split que não soma, split com membro desconhecido, valor negativo, descrição > 200, > 100 membros; `merge` aplica gasto mais novo e ignora o mais velho; mesmo pacote duas vezes não muda nada; ordem de dois pacotes não importa; nunca escreve o meu membro; ignora gasto cujo `authorId ≠ from`; lápide vence gasto antigo; `newExpenses` não conta lápide. Fixture do Android passa em `validate`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar espelhando `MissionPack.kt:97-190` (mesmas mensagens de erro curtas). **Step 4:** PASS. **Commit** `feat: pacote, validate e merge`.

### Task 4: Convite e armazenamento local

**Files:** Create: `src/core/invite.ts`, `src/store.ts`, `test/invite.test.ts`.

**Interfaces:**
- Produces: `parseInvite(text: string): Invite | null` (aceita código solto, texto em volta e URL com `#vision-mission:...`); `inviteLink(i: Invite, origin: string): string`; em `store.ts`: `type Mission {id,name,start,end?,key,meId,driveFileId?}`, `saveMission`, `getMission(id)`, `listMissions()`, `members(missionId)`, `expenses(missionId)`, `putMembers`, `putExpenses`, `setLastFetch(missionId, ms)`.

- [ ] **Step 1: testes** de `parseInvite`: código puro, com texto antes/depois, link com `#`, base64 inválido → null, chave de 16 B → null, `end` antes de `start` → null, UUID inválido → null; round-trip `inviteLink`→`parseInvite`.
- [ ] **Step 2:** FAIL; **Step 3:** implementar espelhando `MissionPack.kt:117-131`; `store.ts` em IndexedDB com `idb-keyval` (chaves por missão). **Step 4:** PASS. **Commit** `feat: convite e armazenamento`.

### Task 5: Dinheiro e acerto de contas

**Files:** Create: `src/core/money.ts`, `src/core/settle.ts`, `test/money.test.ts`, `test/settle.test.ts`.

**Interfaces:**
- Produces: `parseMoney(text: string): number | null` (centavos; aceita "12,5", "12.50", "1.234,56"); `formatBrl(cents: number): string`; `splitEqual(total: number, memberIds: string[]): Record<string, number>` (resto distribuído 1 centavo por membro em ordem de id; soma = total); `balances(members, expenses): Record<string, number>` (pago − parte, lápides fora, `ACERTO` dentro); `settle(balances): {from: string, to: string, cents: number}[]` (guloso: maior devedor → maior credor, desempate por id, ≤ n−1 transferências).

- [ ] **Step 1: testes:** os formatos de `parseMoney` acima + "abc" e "-5" → null; `splitEqual(1000, [a,b,c])` soma 1000 e difere ≤ 1 centavo; `balances` ignora gasto deletado e conta `ACERTO`; `settle` zera todos os saldos e usa ≤ n−1 transferências; dois devedores iguais desempatam por id.
- [ ] **Step 2:** FAIL; **Step 3:** implementar espelhando `MissionRules.kt` (`summarize`/`settle`); **Step 4:** PASS. **Commit** `feat: dinheiro e acerto`.

### Task 6: Transporte Drive

**Files:** Create: `src/drive/transport.ts`, `test/transport.test.ts`.

**Interfaces:**
- Consumes: `getToken()` (Task 1).
- Produces: `interface MissionTransport { publish(missionId, memberId, bytes, fileId?): Promise<string>; fetch(fileId): Promise<Uint8Array | null>; remove(fileId): Promise<void> }`; `driveTransport(http: Http, getToken, apiKey): MissionTransport` com `type Http = (method, url, headers, body?) => Promise<{code: number, body: Uint8Array}>`.

- [ ] **Step 1: testes com `Http` falso**, espelhando `DriveMissionTransport.kt`: `publish` sem `fileId` cria pastas `Vision/missões`, envia multipart e abre `anyone/reader`; com `fileId` faz PATCH e devolve o mesmo id; PATCH 404 cai para criar novo; `fetch` 403/404 → null, 500 → lança; sem token → lança "authorization needed".
- [ ] **Step 2:** FAIL; **Step 3:** implementar com `fetch()` do navegador (URLs em `drive/v3` e `upload/drive/v3`); **Step 4:** PASS. **Commit** `feat: transporte Drive`.

### Task 7: Sincronização

**Files:** Create: `src/sync.ts`, `test/sync.test.ts`.

**Interfaces:**
- Consumes: `store`, `pack`, `crypto`, `MissionTransport`.
- Produces: `joinFromInvite(inv: Invite, myName: string): Promise<Mission>` (cria `meId` UUID novo, membros = convidante + eu, guarda a chave); `publishMine(missionId): Promise<void>` (publica 2× na primeira vez para o pacote levar o `driveFileId`; não reenvia pacote idêntico); `fetchOthers(missionId, force: boolean): Promise<number | null>` (lê cada membro com `driveFileId` ≠ meu, ≥ 2 min desde a última leitura, falha de um não para os outros, devolve novos gastos); `exportPackFile(missionId): Promise<File>` (`missao-<nome>.vision`).

- [ ] **Step 1: testes** com transporte falso e store em memória: join cria eu + convidante; `fetchOthers` importa gastos do convidante e aprende o `driveFileId` de um terceiro pelos `members`; um 404 não impede os demais; pacote adulterado é ignorado; segunda chamada < 2 min devolve null sem `force`; `publishMine` com pacote igual não reenvia.
- [ ] **Step 2:** FAIL; **Step 3:** implementar; **Step 4:** PASS. **Commit** `feat: sincronização`.

### Task 8: Telas (entrar, missão, gasto, acertos)

**Files:** Create: `src/ui/join.ts`, `src/ui/mission.ts`, `src/ui/expense.ts`, `src/ui/settle.ts`, `src/main.ts`, `src/style.css`; Test: `test/ui.test.ts` (jsdom, só o essencial).

**Interfaces:**
- Consumes: Tasks 3–7.

- [ ] **Step 1:** Entrar: campo para colar convite ou abrir via `#vision-mission:`; pede o nome; chama `login()` se faltar token e retoma o convite guardado após o redirecionamento; chama `joinFromInvite`.
- [ ] **Step 2:** Missão: lista de membros e gastos (lápides escondidas), puxar-para-atualizar chama `fetchOthers(id, true)`; abrir a missão chama `fetchOthers(id, false)`.
- [ ] **Step 3:** Gasto: descrição, valor (`parseMoney`), pagador, quem divide (padrão todos, `splitEqual`), editar/apagar (lápide) só dos meus; cada mudança agenda `publishMine` com debounce de 10 s; sem token, o gasto fica salvo e mostra "entre para sincronizar".
- [ ] **Step 4:** Acertos: transferências de `settle`, botão "Paguei" só para o devedor (cria `ACERTO`); mostra Pix copia-e-cola da chave do credor quando houver `pixKey` (copiar texto da chave; geração de BR Code fica fora desta versão).
- [ ] **Step 5:** Teste de UI: colar convite válido leva à tela da missão; convite inválido mostra erro. **Commit** `feat: telas de missão`.

### Task 9: Enviar meu pacote ao grupo

**Files:** Modify: `src/ui/mission.ts`; Test: `test/sync.test.ts`.

- [ ] **Step 1: teste:** `exportPackFile` devolve arquivo que o `openPack` do Android-fixture-style abre com a chave da missão e cujo `members` do eu traz o `driveFileId`.
- [ ] **Step 2:** Botão "Enviar meu pacote ao grupo": `navigator.share({files:[file]})` quando disponível, senão baixa o arquivo. Mostrar um aviso na primeira entrada explicando o passo (resolve a lacuna do spec).
- [ ] **Step 3 (manual):** compartilhar do iPhone e importar no app Android; confirmar que dali em diante o Android lê o Drive do amigo. **Commit** `feat: enviar meu pacote ao grupo`.

### Task 10: Moedinha "Apoie o Vision"

**Files:** Create: `src/ui/support.ts`, `public/icons/coin.png` (ou sprite 20 px); Modify: `src/ui/mission.ts` (cabeçalho).

- [ ] **Step 1:** Ler `Vision/app/src/main/java/app/vision/finance/ui/SupportDrawer.kt` e `res/values/support.xml` para copiar textos, sprite `coin` e a chave Pix do autor.
- [ ] **Step 2:** Moeda no cabeçalho de todas as telas; toque abre a gaveta com título "Apoie o Vision com um Pix" / "Support Vision with a Pix", a chave e botão copiar (`navigator.clipboard.writeText`).
- [ ] **Step 3:** Teste de UI: tocar na moeda mostra a chave; copiar chama o clipboard. **Commit** `feat: moedinha de apoio`.

### Task 11: Instalação, docs e fechamento

**Files:** Modify: `public/manifest.webmanifest`, `public/sw.js`; Create: `docs/ARCHITECTURE_MAP.md`, `README.md`.

- [ ] **Step 1:** Manifest (`display: standalone`, ícones 180/512, `start_url` com `base`), Service Worker com cache do shell (offline abre a missão salva).
- [ ] **Step 2:** `docs/ARCHITECTURE_MAP.md` do repo novo (módulos, contrato com o Android, variáveis `VITE_GOOGLE_CLIENT_ID`/`VITE_DRIVE_API_KEY`, como publicar); `README.md` com o passo a passo de criar o cliente OAuth Web e a API key restrita ao domínio.
- [ ] **Step 3 (manual, ponta a ponta):** Android cria missão e compartilha convite → iPhone entra, lança gasto, envia pacote → Android importa, vê o gasto, lança outro → iPhone vê pelo Drive → acerto bate nos dois. No Vision, atualizar `docs/ARCHITECTURE_MAP.md` (§5.9) com uma linha apontando para a PWA.
- [ ] **Step 4: Commit** `docs: arquitetura e README`.

---

## Self-review

- Spec: metas (Tasks 7–8), moedinha (10), contrato/cifra/merge/acerto (2,3,5), Drive (1,6), lacuna do pacote (9), instalação e docs (11). Não-metas ficaram de fora (sem criar missão, sem Nearby, sem BR Code).
- Fora do plano de propósito: gerar Pix copia-e-cola (o Android gera; a PWA só copia a chave).
- Risco principal: Task 1 é portão; se o login falhar no iPhone instalado, parar ali.
