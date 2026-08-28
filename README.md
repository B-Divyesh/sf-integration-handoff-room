# Integration Handoff Room

Integration Handoff Room gives small software agencies one client-ready place to review a safe API example, record decisions and ownership, and preserve a named handover acknowledgement.

M1 ships a complete, account-free sample room. Open `/demo` (or `/?demo=1`), complete the payment-status checklist, record a named acknowledgement, and download the handover JSON. The sample is isolated in `demo:` browser storage and does not call a live API.

The product plan is in [.factory/plan.md](.factory/plan.md), the researched opportunity is in [.factory/brief.json](.factory/brief.json), and the orbital protocol atlas design system is in [.factory/design.md](.factory/design.md).

## Who it is for

Small software agencies and fractional engineering teams that hand API integrations to clients. Client reviewers get a focused review space instead of a pile of docs, collection links, and follow-up email.

## Try the sample

```sh
npm install
npm run dev
```

Open [http://localhost:5173/demo](http://localhost:5173/demo). The seeded room
uses fictional payment-status data. **Reset demo** returns it to a clean state.
See [.factory/demo.md](.factory/demo.md) for the sandbox boundary.

## Development

Prerequisites: Node.js 22+, npm, and the Rust stable toolchain.

```sh
npm install
npm run dev                 # web app at http://localhost:5173
npm run dev:api             # container service at http://localhost:8080
npm run check
npm test
npm run build               # creates dist/
npm run test:e2e            # claim tests, keyboard flow, Axe, mobile check
npm run test:api
npm run build:api
```

Each claim in [.factory/claims.json](.factory/claims.json) maps to exactly one
fresh-context Playwright test tagged `@claim:<id>`. Run an individual claim
with `npm run test:e2e -- --grep @claim:demo-handover-export`.

## Deployment

The factory deploys one non-root Container App. The multi-stage `Dockerfile`
builds the Vite app into `dist/`; Axum serves it, its deep links, `/health`, and
`/ready` on `PORT` (default `8080`). `BUILD_SHA` and `STATIC_DIR` are optional
overrides; no configuration is required to start the container. The Dockerfile
accepts `BUILD_SHA`, `GIT_SHA`, and `SOURCE_COMMIT` without relying on `.git`.

M2 will add Entra sign-in, PostgreSQL, redaction jobs, repository connection,
Sociobot/Dodo Studio billing, and API rate limits. Those production services do
not exist in M1, so the sample does not pretend to use them.

## Privacy and licensing

M1 uses no third-party analytics, CDNs, embedded payment providers, or live API
requests. It never asks for a real credential. The project is released under
the [MIT License](LICENSE).
