# ktoggle-ui

Admin UI for **ktoggle**, KTO's feature flag service. The layout follows GrowthBook's, with KTO's visual identity
(black, red and white).

Stack: React 19, Vite, TypeScript (strict), Tailwind 4, TanStack Query, React Router, Radix, Keycloak (OIDC + PKCE).

## Running it

The simplest way is the one-command demo in the `ktoggle` repository (`docker compose --profile app up -d --build`),
which also builds and serves this UI. For development, run the `ktoggle` backend locally (see its README) and then:

```bash
npm install
npm run dev          # http://localhost:5173
```

Development users (local Keycloak, realm `ktoggle`): `admin.local/admin`, `editor.local/editor`,
`approver.local/approver`, `viewer.local/viewer`.

| Variable | Default |
|---|---|
| `VITE_API_URL` | `http://localhost:8090` |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180` |
| `VITE_KEYCLOAK_REALM` | `ktoggle` |
| `VITE_KEYCLOAK_CLIENT_ID` | `ktoggle-ui` |

## Screens

- **Features:** a list with a toggle per environment. The detail page has:
  - force and rollout rules with a visual condition builder;
  - a test panel backed by the official SDK;
  - revision history with revert.
- **Drafts and reviews:**
  - every change is staged in a draft;
  - "Review & publish" shows a side-by-side diff, conflicts and rebase, approvals and emergency publication;
  - a review queue;
  - approval settings.
- **Saved groups, Attributes, Environments, Projects, SDK connections:** catalog pages. The connection page shows
  usage snippets, the active bundle, chain verification, rollback and the delivery log.
- **Audit log:** the hash-chained trail, with an integrity indicator and a before/after diff.
- **Replay:** reproduces a past decision from an immutable bundle, or from the bundle active at a given instant.
- **Decisions:** opt-in events sent by SDKs, with HMAC-based attribute verification.
- **SDK playground:** a real SDK (`@growthbook/growthbook`) connected over SSE. Publish a change in another tab and
  watch it arrive live.

## Scripts

- `npm run build`: typecheck and production build.
- `npm test`: unit tests (Vitest).
- `npm run lint`: oxlint.
- `npm run test:e2e`: end-to-end tests (Playwright). They run against the local stack started with
  `docker compose --profile app up -d --build` in the ktoggle repository, and save screenshots in
  `e2e-report/screens`.
