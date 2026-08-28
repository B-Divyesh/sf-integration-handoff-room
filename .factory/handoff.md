# Repair handoff — release candidate after independent verification

Date: 2026-08-28 UTC
Work order: `integration-handoff-room-repair-1`
Verifier report: `af1f63becb7d5d9b2d463bd98a8fe680cdc2b27f`
Failed candidate: `4abd41aee397f4bd7b6c34c553481bb5acf7f193`

## What changed

- Replaced the sample-only dead end with real `/rooms`, `/rooms/new`, `/rooms/:id`, `/review/:token`, `/auth/callback`, and `/settings/billing` routes.
- Added Sociobot Entra PKCE sign-in with session-storage caching. The API resolves discovery/JWKS, accepts RS256 only, and checks audience, tenant, discovered issuer, expiry, and not-before claims.
- Added a persistent SQLite tenant model with users, agencies, memberships, rooms, scoped review invitations, questions, decisions with named owners, and revision-bound acknowledgements.
- Added public-GitHub JSON fixture import, a 256 KB limit, path validation, recursive secret detection/redaction, mandatory human confirmation, and no raw-fixture persistence.
- Added seven-day hashed review tokens, client questions, agency answers, acknowledgement enforcement, and complete JSON exports.
- Added a per-forwarded-IP token bucket to every non-health route: reads 20/s with burst 40; writes 5/s with burst 10. Denials are 429 with `Retry-After: 1`.
- Changed unknown container routes to HTTP 404, added strong ETags and one-year immutable caching for hashed assets, and injected `BUILD_SHA` into the public footer.
- Switched the Rust build stage to `rust:1-slim`, kept a non-root runtime, and created writable `/data` storage.
- Corrected day-chart success/action contrast, made payload regions keyboard-focusable, raised all measured links/buttons to 44 px, and simplified the 390 px first screen so its three facts are visible.
- Expanded `.factory/claims.json` with privacy, sanitization, real-room, client-review, rate-limit, and checkout coverage. The demo privacy test now inspects methods, bodies, origins, cookies, local/session storage, and IndexedDB.
- Split MSAL into an on-demand chunk. The landing page initial JavaScript is 43.42 KB raw / 12.77 KB gzip; the 316.60 KB MSAL chunk loads only on identity routes.

## Finding-by-finding regression evidence

| Verifier finding | Repair evidence |
| --- | --- |
| Real job missing | Backend integration creates and reloads a tenant room, redacts its fixture, records a named-owner decision, creates a scoped link, stores a client question and acknowledgement, and exports all records. Browser tests cover agency preparation and account-free client review. |
| Rate allowance absent | `claim_api_rate_limit_uses_forwarded_ip_and_retry_after` passes. A local production probe returned 52 x 200 and 48 x 429 for 100 rapid requests from one forwarded IP; 429 included `Retry-After: 1`. |
| Claims incomplete | Twelve claim entries now map to isolated commands. Privacy and sanitization claims inspect observable data rather than checking for labels. |
| Axe/touch failures | Playwright Axe 4.11 reports no serious/critical findings across seven routes, two themes, desktop, and 390 px. A geometric check finds no visible demo link/button below 44×44 px. |
| Docker base pinned | `Dockerfile` now uses `rust:1-slim`; local release compilation passes and the factory ACR build is the deployment gate. |
| Soft 404 | Rust integration test and local production probe both return HTTP 404 for `/does-not-exist` while rendering the designed page. |
| Mobile facts below fold | At 390×844, Playwright asserts the fact list starts above y=844. |
| No durable asset cache | Local production response for the hashed JS has `Cache-Control: public, max-age=31536000, immutable` and a SHA-256 ETag. |
| Footer build `dev` | Docker passes the source commit as `VITE_BUILD_SHA`; the footer renders its first 12 characters and `/health` returns the full commit. |

## Clean verification

Run from a clean dependency install:

```text
npm ci                    PASS — 62 packages, 0 vulnerabilities
npm run test:all          PASS
  npm run check           PASS
  npm test                PASS — 8/8
  npm run test:api        PASS — 5/5
  npm run test:e2e        PASS — 18/18
  npm run build           PASS — dist/ created
  npm run build:api       PASS — optimized Rust binary
```

Browser coverage includes desktop, 390 px, keyboard-only acknowledgement/export, 200% reflow approximation, reduced motion, same-document offline use, route titles, one h1, no console errors, every exact claim, and the real agency/client workflows.

`verify-url.sh` passed locally for `/` and `/demo` with no console errors; reports and screenshots are under `.factory/evidence/local-*`. Lighthouse mobile evidence is `.factory/evidence/lighthouse-local.json`: performance 100, accessibility 100, best practices 100, SEO 100; FCP 1.2 s, LCP 1.4 s, CLS 0, TBT 0 ms.

The live OIDC discovery returned the GUID issuer and Sociobot JWKS URL. An authorization request using the production callback returned the Microsoft sign-in page, confirming that `https://integration-handoff-room.sociobot.in/auth/callback` is accepted.

## Run and verify

```sh
npm ci
npm run test:all

npm run build
DATA_DIR="$(mktemp -d)" STATIC_DIR="$PWD/dist" PORT=8080 npm run dev:api
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/does-not-exist
```

The container requires only `PORT`. `DATA_DIR`, `STATIC_DIR`, `BUILD_SHA`, `PUBLIC_ORIGIN`, and the three `ENTRA_*` settings are optional overrides.

## Needs operator action

- The required Sociobot product is not registered: on 2026-08-28, both live and pilot checkout endpoints for `integration-handoff-room` returned HTTP 404. The repository uses the mandated URL and never contacts Dodo directly, but checkout cannot complete until the factory runs its paid-product registration workflow.
- The container deployment script supplies no persistent volume or PostgreSQL connection and scales to three replicas. This repair defaults safely to SQLite under `/data`, but durable multi-replica production storage requires the factory to attach persistent storage or supply the planned PostgreSQL service. Until then, keep the app at one replica; redeployment can replace local room data.

No AI feature is included. It is not needed for the repaired core workflow and the plan correctly defers the optional reply draft.
