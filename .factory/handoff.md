# Planning and scaffold handoff

Date: 2026-08-28
Work order: `venture-integration-handoff-room-plan`

## What was done

- Captured the researched brief in `.factory/brief.json`.
- Wrote the venture plan in `.factory/plan.md`: PRD, evidence, multi-tenant architecture, Entra CIAM, least-privilege repository OAuth, Sociobot/Dodo Studio subscription, intentional AI use, operations, data model, rate limits, backups, M1–M5 delivery contract, and risk experiments.
- Recorded the original **orbital protocol atlas** visual thesis in `.factory/design.md`; added implementable CSS design tokens in `src/styles/tokens.css` and a 23-component inventory in `.factory/components.md`.
- Added the required M1 claims in `.factory/claims.json`. They deliberately point to M1 Playwright tests, which do not exist yet because M1 has not been built.
- Added a buildable Vite/strict-TypeScript browser shell with route-title logic, accessible landmarks, a restrained token preview, static routing/security configuration, favicon, sitemap, robots, and a designed static 404 page.
- Added a buildable Rust/Axum API operational shell with `/health`, `/ready`, structured JSON startup logs, graceful shutdown, and no required configuration; it is intentionally free of product endpoints until M2.
- Added the API Dockerfile, `.gitignore`, npm/Cargo tooling, and GitHub Actions CI for web checks/tests/build and API tests/release build.
- Updated README with product intent, development commands, deployment boundary, and privacy stance.

## How to verify

```sh
npm install
npm run check
npm test
npm run build
npm run test:api
npm run build:api
```

Run the web shell with `npm run dev`; run the API shell with `npm run dev:api` and request `http://localhost:8080/health`. `npm run build` creates `dist/`.

## Known gaps — intentionally deferred

- M1 product work has **not** been built: no landing, demo data, demo banner, acknowledgement flow, export, claim e2e tests, privacy/terms routes, copy audit, or production room UI exists yet.
- M2+ have no database, Entra integration, GitHub OAuth, billing, redaction engine, rate limiter, storage, background worker, or operational deployment configuration yet. The API only exposes health/readiness endpoints.
- The desired self-hosted font files and final 1200×630 product social image are an M1 asset task. The scaffold deliberately uses system fallbacks and a hand-authored favicon rather than a CDN.
- `npm run test:e2e` has only a shell smoke test. It must receive the M1 claim-tagged Playwright files; do not treat this scaffold test as claim verification.

## Next builder: M1

Read `.factory/plan.md`, `.factory/design.md`, `.factory/components.md`, `.factory/claims.json`, and this handoff. Implement only M1, preserve the existing tokens/tooling, add `.factory/demo.md` and `.factory/copy-audit.md`, and write `.factory/handoff-m1.md` with browser screenshots/traces and every claim test result. Verify the demo from a fresh browser context before marking M1 complete.

## Needs operator action

None before M1. Before M2 release, factory operators must register `https://integration-handoff-room.sociobot.in/auth/callback` on the shared Sociobot Entra SPA app, provision database/storage/OAuth credentials, and register the Dodo-backed Sociobot Studio subscription plan and pilot product.
