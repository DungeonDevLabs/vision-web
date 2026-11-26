# vision-web — missões em grupo para iPhone (design)

Repo novo `vision-web`, na pasta acima do Vision (`d:\Documents\7 - Projetos pessoais\DVL\vision-web`). Este doc mora aqui até o repo existir; depois de aprovado, copiar para `vision-web/docs/`.

## Por quê
Amigos com iPhone não rodam o Vision (Android). A missão em grupo é a feature que precisa de todo mundo, então a PWA começa por ela. Versão enxuta, sem o resto do app.

## Metas
- Amigo de iPhone entra numa missão criada no Android, lança os próprios gastos (autor, pagador, divisão), vê membros, gastos e o acerto de contas ("Acertos"), e registra "Paguei" quando é o devedor.
- Interoperável com o app Android sem mudar o formato: mesmos pacotes, mesma cifra, mesmo merge.

- A moedinha "Apoie o Vision" continua na PWA: mesmo sprite `coin` e mesma gaveta com o Pix do autor (fonte: `SupportDrawer.kt` e `res/values/support.xml` do Android), com copiar Pix.

## Não-metas
- Criar missão; Nearby (não existe no iOS); lançamentos pessoais, orçamento, chefão, moeda estrangeira, backup, qualquer outra feature do Vision.
- Servidor próprio. Nenhum dado financeiro passa por nós.

## Anti-metas (seria falha mesmo "funcionando")
- Divergir do formato do Android (o merge deixaria de ser comutativo/idempotente).
- A chave da missão ou os gastos saírem do aparelho/Drive da pessoa sem cifra.
- Login que "abre e não volta" na PWA instalada no iPhone.

## Contrato com o Android (fonte da verdade: `MissionPack.kt`, `DriveMissionTransport.kt`, ARCHITECTURE_MAP §5.9)
- Convite: `vision-mission:` + base64url(JSON `{id,name,start,end?,key,from:{id,name,pixKey?,driveFileId?,updatedAt,avatar}}`).
- Pacote: `VSN1` + nonce 12 B + AES-256-GCM (tag 128, `VSN1` como AAD); JSON `{v:1, missionId, missionName, start, end?, from, members[], expenses[só do from, com lápides], sentAt}`.
- `validate` e `merge` portados 1:1 (membro pelo maior `updatedAt`, nunca o meu; gasto só se `authorId == from` e `updatedAt` maior; split soma o valor).
- Drive: cada pessoa tem o próprio arquivo `Vision/missões/missao-<missionId>-<memberId>.vision`, público por link (anyone/reader), cifrado. Escrita com token OAuth `drive.file`; leitura dos outros só com API key (`files/<id>?alt=media&key=`), sem login. Os `driveFileId` dos outros chegam dentro dos pacotes (`members[].driveFileId`); o do convidante vem no convite.
- Acerto: saldo = pago − parte; `settle` guloso (maior devedor → maior credor, desempate por id, ≤ n−1); só o devedor registra `ACERTO`.

## Abordagens consideradas
1. Login por popup (Google Identity Services): menos código, mas arrisca quebrar na PWA instalada no iOS.
2. **Login por redirecionamento (escolhida):** a página vai ao Google e volta; convite, chave e estado ficam em `localStorage`/IndexedDB para sobreviver à ida e volta. Mais segura no iPhone instalado.
3. Só leitura, sem login: não deixa o amigo lançar gasto; descartada.

## Decisões
- Entrada: link `https://<host>/#vision-mission:<token>` (o fragmento nunca vai ao servidor) ou colar o código; leitura de QR pela câmera é opcional na v1 (colar/abrir link basta).
- Stack (minha escolha): TypeScript + Vite, sem framework pesado; WebCrypto para AES-GCM; Service Worker + manifest para instalar; dados em IndexedDB.
- Hospedagem estática com endereço fixo (GitHub Pages). A API key (restrita por referrer a esse endereço) e o cliente OAuth Web (origem e redirect autorizados) dependem dele.
- Token de acesso dura ~1 h e não há refresh sem servidor: ao expirar, novo redirecionamento silencioso (`prompt=none`), caindo para tela de login se falhar.
- Primeiro marco = spike só do login por redirecionamento no iPhone instalado + gravar/ler um arquivo de teste no Drive. Só depois portar cifra, merge e telas.
- Testes: vetores reais — pacotes gerados pelo app Android (abrir na PWA) e pacote gerado pela PWA (importar no app) — mais testes do `merge`/`settle` portados.

## Lacuna que a PWA expõe (decisão minha, confira)
Hoje os `driveFileId` se espalham pelos pacotes, mas o convidante só aprende o arquivo de quem entrou **depois de ler um pacote dele** — e ele não sabe onde está o arquivo. No Android isso é coberto por Nearby/arquivo `.vision`. Para a PWA: após entrar e publicar, a PWA oferece "Enviar meu pacote ao grupo" (Web Share com o arquivo `.vision`, que o app Android já sabe importar). Esse import traz o `driveFileId` do amigo e dali em diante o Drive resolve sozinho. Nada muda no Android.

## Fora do escopo agora / para depois
- App Android gerar o convite como link `https://…/#vision-mission:…` (mudança pequena; até lá o código colado funciona).
- Criar missão na PWA; leitura de QR; notificações.

## Fica a cargo de quem construir
Estrutura de pastas, UI/visual (seguir o tom do app: pixel art opcional), estados de erro e textos PT/EN, escolha de lib de QR e de testes.

## Pré-requisitos seus (fora do código)
- Projeto no Google Cloud com cliente OAuth tipo Web e API key nova restrita ao domínio da PWA, Drive API ligada.
- Repo `vision-web` no GitHub com Pages ligado (ou outro host estático com endereço fixo).
