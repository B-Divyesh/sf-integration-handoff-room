# M1 handoff — tryable release room

Date: 2026-08-28
Work order: `venture-integration-handoff-room-m1`

## What shipped

- Landing page with the orbital protocol atlas visual system, plain-language first action, live room preview, three-step explanation, privacy boundary, planned Studio price, route metadata, social card, and mobile layout.
- Isolated `/demo` and `/?demo=1` payment-status handoff room. It seeds a sanitized fixture, two decisions with owners, a three-step checklist, a named acknowledgement, and a downloaded JSON handover record.
- Persistent demo banner with Reset demo and an honest Start for real path. The demo stores only `demo:integration-handoff-room:sample-v1`; it never calls a live API or reads/writes a real-data namespace.
- `/privacy`, `/terms`, and designed `/404` pages, consistent landmarks, dynamic route titles/descriptions/canonical URL, visible focus, keyboard handling, day/night chart treatment, and reduced-motion fallback.
- Unit tests for the seed, acknowledgement gate, serializer, demo storage namespace, routing, and titles. Browser tests cover each required claim, export parsing, keyboard use, Axe, mobile layout, route metadata, and console errors.
- Container delivery now builds Vite and Rust in separate stages and serves the public app, deep links, `/health`, and `/ready` on `PORT`. This corrects the plan's original static-host description to match the supplied `deploy: container` work order.

## Verification evidence

Completed locally from the repository:

```text
npm run check                 PASS
npm test                      PASS — 8 tests
npm run build                 PASS — 7.55 KB gzip JavaScript
npm run test:e2e             PASS — 9 browser tests
npm run test:api              PASS — 2 tests
npm run build:api             PASS
```

Claim commands from `.factory/claims.json` all pass independently from a fresh browser context:

```text
@claim:demo-sample-room       PASS
@claim:demo-acknowledgement  PASS
@claim:demo-handover-export  PASS
@claim:demo-isolated         PASS
```

The local container-service smoke check served `/demo` with HTTP 200 and security headers. The factory verifier recorded no console errors; title, `lang`, one h1, `<main>`, image alts, and button labels passed. The live cold verification is recorded in `.factory/handoff.md`.

## M2 needs

- Real Entra CIAM registration for `https://integration-handoff-room.sociobot.in/auth/callback`.
- PostgreSQL, migrations, tenant/RBAC checks, encrypted storage, redaction jobs, and server endpoints with the plan's required rate limits.
- Sociobot/Dodo Studio test product and the verified recurring entitlement workflow. Do not add a client-side payment-provider integration.
- Repository OAuth/App credentials and the selected-repository, read-only import boundary.

## Known intentional gaps

M1 is a local, public sample. It has no user account, real room persistence, repository connection, billing entitlement, API product routes, or server-side rate limiter because the plan schedules each of those in M2. The sample makes no claim that those services are already present.
