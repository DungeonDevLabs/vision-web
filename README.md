# vision-web

Missões em grupo do Vision para quem tem iPhone. Instale na tela inicial pelo Safari (Compartilhar → Adicionar à Tela de Início), cole o convite que o amigo do Android mandou e lance seus gastos.

```
npm install
npm test          # testes (incluem arquivo real gerado pelo app Android)
npm run dev       # http://localhost:5173
npm run build     # dist/
```

## Configurar o Google (uma vez)
1. Google Cloud → novo projeto → ligar a **Google Drive API**.
2. Tela de consentimento OAuth: externo, escopo `.../auth/drive.file`; adicione os amigos como usuários de teste enquanto estiver em "Teste" (ou publique o app).
3. Credenciais → **ID do cliente OAuth, tipo Aplicativo da Web**. Origens JavaScript autorizadas: `https://<usuario>.github.io`. URIs de redirecionamento: `https://<usuario>.github.io/<repo>/` (e `http://localhost:5173/` para desenvolver).
4. Credenciais → **Chave de API**, restrita a "Referenciadores HTTP" `https://<usuario>.github.io/*` e à Drive API.
5. Copie `.env.example` para `.env.local` e preencha; no GitHub, crie as variáveis `VITE_GOOGLE_CLIENT_ID` e `VITE_DRIVE_API_KEY` (Settings → Secrets and variables → Actions → Variables) e ligue Pages com "GitHub Actions".

## Testar o login no iPhone
Abra `https://<usuario>.github.io/<repo>/spike.html`, instale na tela inicial, abra de lá, toque em **Entrar com Google** e depois **Gravar e ler arquivo**. Tem que voltar para a PWA já logada e ler o arquivo de volta.

Arquitetura: `docs/ARCHITECTURE_MAP.md`.
