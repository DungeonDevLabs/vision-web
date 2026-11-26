# vision-web — mapa da arquitetura

PWA para amigos de iPhone participarem das **missões em grupo** do Vision (Android). Sem servidor: o grupo se sincroniza pelo Drive de cada pessoa, no mesmo formato do app Android. Design: `docs/superpowers/2026-11-25-visionpwa-missoes-design.md`; plano: `docs/superpowers/2026-11-25-visionpwa-missoes.md`.

## Stack
TypeScript + Vite (sem framework), Vitest (+ jsdom, fake-indexeddb), WebCrypto, IndexedDB (`idb-keyval`), Service Worker. Deploy: GitHub Pages (`.github/workflows/pages.yml`).

## Módulos

| Arquivo | Papel |
|---|---|
| `src/core/crypto.ts` | `VSN1` + nonce 12 B + AES-256-GCM (tag 128, `VSN1` como AAD). `sealBytes`/`openBytes`/`newMissionKey` |
| `src/core/pack.ts` | Tipos do pacote, `validate`, `merge` (idempotente, comutativo), `buildPack`, `openPack`/`sealPack` |
| `src/core/invite.ts` | `vision-mission:` + base64url(JSON); `parseInvite` (aceita texto em volta e link com `#`), `inviteLink` |
| `src/core/money.ts` | `parseMoney` ("12,5", "1.234,56" → centavos), `formatBrl` |
| `src/core/settle.ts` | `equalSplit` (resto nos primeiros), `balances`, `settle` (guloso, ≤ n−1), `groupTotal` |
| `src/store.ts` | IndexedDB: missões, membros, gastos, última leitura |
| `src/ledger.ts` | Meus gastos: `saveExpense`, `deleteExpense` (lápide), `settleUp` ("Paguei" = `ACERTO`) |
| `src/sync.ts` | `joinFromInvite`, `publishMine` (2× na primeira vez), `fetchOthers` (≥ 2 min), `exportPackFile` |
| `src/drive/auth.ts` | Login Google por **redirecionamento** (fluxo implícito, `drive.file`); token em `localStorage` |
| `src/drive/transport.ts` | Drive REST: publicar (público por link, cifrado), ler só com API key, apagar |
| `src/live.ts` | Transporte real, publicação com atraso de 10 s, estado "precisa entrar" |
| `src/ui/*` | `join` (entrar), `mission` (gastos + acertos), `expense` (formulário), `support` (moedinha "Apoie o Vision"), `dom` (helpers; texto sempre como texto) |
| `src/main.ts` | Roteamento: convite no `#` → entrar; senão última missão; senão início |
| `spike.html` + `src/spike.ts` | Teste manual do login no iPhone instalado (fora do app) |
| `test/fixtures/` | Arquivo, chave e convite **gerados pelo app Android** (a cifra e o merge são testados contra eles) |

## Contrato com o Android
Fonte da verdade: `Vision/app/src/main/java/app/vision/finance/mission/` (`MissionPack.kt`, `DriveMissionTransport.kt`, `MissionRules.kt`) e `Vision/docs/ARCHITECTURE_MAP.md` §5.9. Mudou lá, muda aqui (e regenere os fixtures).

- Convite e pacote: ver `crypto.ts`/`pack.ts`/`invite.ts`. `PACK_VERSION = 1`, ≤ 1 MB.
- Drive: `Vision/missões/missao-<missionId>-<memberId>.vision`, `anyone/reader`; leitura dos outros só com `?alt=media&key=<API key>`; os `driveFileId` dos outros chegam dentro dos pacotes.
- **Lacuna conhecida:** o app só aprende onde está o arquivo de quem entrou depois de importar um pacote dele. A PWA oferece "Enviar meu pacote ao grupo" (Web Share do `.vision`, que o Android já importa).

## Regras de negócio
- Só o autor escreve o próprio gasto; apagar = lápide; o merge ignora gasto cujo `authorId ≠ from`.
- Nunca criar missão na PWA (v1). Nenhum dado financeiro, chave de missão ou token vai para log/analytics.
- A moedinha de apoio usa o mesmo Pix do app (`res/values/support.xml`).

## Configuração (`.env.local`, ver `.env.example`)
`VITE_GOOGLE_CLIENT_ID` (cliente OAuth tipo Web; origem e redirect = URL da PWA), `VITE_DRIVE_API_KEY` (restrita por referrer ao domínio da PWA; Drive API ligada). No GitHub: variáveis do repositório com os mesmos nomes. `VITE_BASE=/<repo>/` é posto pelo workflow.

## Pendências
- Teste manual do login no iPhone instalado (`/spike.html`) — portão do projeto.
- Teste ponta a ponta Android ↔ iPhone.
- Android gerar o convite como link `https://…/#vision-mission:…`.
