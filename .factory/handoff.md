# M1 delivery handoff

Date: 2026-08-28
Work order: `venture-integration-handoff-room-m1`

## Delivered

M1 is live at `https://integration-handoff-room.sociobot.in`. It provides a
complete, safe sample handoff room at `/demo`: fixture, decisions, owners,
required checklist, named acknowledgement, and JSON export. The landing,
privacy, terms, and 404 routes are also live.

The container build now serves the Vite application and deep links directly
from Axum. It starts with only `PORT`, has no required secret configuration,
and exposes `/health` and `/ready`.

## Live verification

Cold verification of `https://integration-handoff-room.sociobot.in/demo`:

- HTTPS GET: 200
- Browser load: 604 ms
- Console errors: none
- Page checks: title present, `lang=en`, one h1, `<main>`, no missing image
  alts, and no unlabelled buttons
- `/health`: returned `status: ok` with the deployed build SHA

## How to run and verify

```sh
npm install
npm run check
npm test
npm run build
npm run test:e2e
npm run test:api
npm run build:api
```

Full scope, claim evidence, and M2 prerequisites are in
`.factory/handoff-m1.md`. The sandbox boundary is in `.factory/demo.md`.

## Next milestone

M2 adds the real account, persistence, redaction, repository, billing, and
rate-limit systems. Factory operators must register the Entra callback,
provision PostgreSQL/storage/OAuth, and register the Sociobot/Dodo Studio test
plan before that work starts.
