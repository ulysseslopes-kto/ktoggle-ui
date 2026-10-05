# ktoggle-ui

Interface administrativa do **ktoggle**, o serviço de feature flags da KTO. O layout segue o do GrowthBook e usa a
identidade visual da KTO (preto, vermelho e branco).

Stack: React 19, Vite, TypeScript (strict), Tailwind 4, TanStack Query, React Router, Radix, Keycloak (OIDC + PKCE).

## Rodando

Pré-requisito: o backend `ktoggle` rodando localmente (veja o README dele: `docker compose up -d` e o backend com os
perfis `local,demo`).

```bash
npm install
npm run dev          # http://localhost:5173
```

Usuários de desenvolvimento (Keycloak local, realm `ktoggle`): `admin.local/admin`, `editor.local/editor`,
`approver.local/approver`, `viewer.local/viewer`.

| Variável | Padrão |
|---|---|
| `VITE_API_URL` | `http://localhost:8090` |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180` |
| `VITE_KEYCLOAK_REALM` | `ktoggle` |
| `VITE_KEYCLOAK_CLIENT_ID` | `ktoggle-ui` |

## Telas

- **Features:** lista com um toggle por ambiente; o detalhe tem regras force e rollout em rascunho, publicação com
  motivo, teste com o SDK oficial e histórico de revisões com restauração.
- **Saved groups, Atributos, Ambientes, Projetos, Conexões de SDK:** cadastros. A tela de conexões mostra snippets de
  uso, o bundle ativo, a verificação da cadeia, o rollback e o log de entregas.
- **Audit log:** a trilha encadeada por hash, com indicador de integridade e diff entre antes e depois.
- **Replay:** reproduz uma decisão passada a partir de um bundle imutável, ou do bundle ativo num instante.
- **Decisões:** eventos opt-in enviados pelos SDKs, com verificação de atributos por HMAC.
- **SDK playground:** um SDK real (`@growthbook/growthbook`) conectado via SSE. Altere uma flag em outra aba e veja a
  mudança chegar ao vivo.

## Scripts

`npm run build` (typecheck + build de produção) · `npm test` (Vitest) · `npm run lint` (oxlint) ·
`npm run test:e2e` (Playwright, contra a stack local subida com `docker compose --profile app up -d --build` no repositório
ktoggle; screenshots em `e2e-report/screens`)
