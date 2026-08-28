# Independent verification 3 — FAIL

**Candidate:** `301b0b9013eecbec255dbc8ccd970f034eec1511`  
**Production URL:** `https://integration-handoff-room.sociobot.in`  
**Verified:** 2026-08-28 UTC  
**Verdict:** **FAIL — release blocked**

## Scope and first read

This was an independent, clean-clone verification. No product source was changed.

Cold desktop production read (`1440×900`): the first screen says **“Review an API handoff together.”** It says it is for agency teams handing an integration to a client, and presents **“Try it with sample data”** as the primary action with the plain explanation “The sample opens now.” The required three plain facts are present. The primary action opens `/demo` in one click. This requirement passes.

At `390×844`, the title, primary action, and all three facts are visible without horizontal overflow; the facts start at `y=577.44`.

## Declared claims — PASS

`.factory/claims.json` exists. After `npm ci`, every declared test was executed from the clean checkout. The browser claim command ran all 11 declared browser claims together and passed; the three listed API commands each passed.

| Claim | Result | Evidence |
| --- | --- | --- |
| `demo-sample-room` | PASS | Playwright claim suite, 11/11 passed |
| `demo-acknowledgement` | PASS | Playwright claim suite, 11/11 passed |
| `demo-handover-export` | PASS | Playwright claim suite, 11/11 passed |
| `demo-isolated` | PASS | Playwright claim suite, 11/11 passed |
| `demo-data-private` | PASS | Playwright claim suite, 11/11 passed |
| `fixture-sanitized` | PASS | Playwright claim suite, 11/11 passed |
| `fixture-redaction-blocks-secret` | PASS | `cargo test … claim_fixture_redaction_blocks_secret_corpus`: 1/1 |
| `agency-room-persisted` | PASS | `cargo test … real_room_persists_is_tenant_scoped_and_has_private_review`: 1/1 |
| `agency-room-browser` | PASS | Playwright claim suite, 11/11 passed |
| `client-review-workflow` | PASS | Playwright claim suite, 11/11 passed |
| `api-rate-limit` | PASS | `cargo test … claim_api_rate_limit_uses_forwarded_ip_and_retry_after`: 1/1 |
| `studio-hosted-checkout` | PASS | Playwright claim suite, 11/11 passed |
| `github-selected-repository` | PASS | Playwright claim suite, 11/11 passed |
| `agency-deletion` | PASS | Playwright claim suite, 11/11 passed |

## Local build and automated checks — PASS

`npm run test:all` passed end to end:

- `npm run check` — PASS.
- `npm test` — PASS, 8 tests.
- `npm run test:api` — PASS, 7 tests.
- `npm run test:e2e` — PASS, 20 tests.
- `npm run build` — PASS. Initial application JS is 48.88 kB / 13.97 kB gzip; CSS is 21.49 kB / 4.79 kB gzip. The 316.60 kB MSAL chunk is lazy-loaded rather than requested on the initial demo load.
- `npm run build:api` — PASS (clean release compilation).

The release binary also started with only `PORT` supplied and returned `/health` 200. It generated its default data/key configuration as documented. The generated local test data was moved out of the worktree afterward.

Docker itself is unavailable in this verifier container (`docker: command not found`), so the Docker image could not be built here. The two build stages it runs were both completed successfully by `test:all`.

## Production checks — PASS except findings below

- Live `/health` returned 200 and `build_sha` exactly `301b0b9013eecbec255dbc8ccd970f034eec1511`; the page footer reports the same short SHA. Production therefore matches the candidate.
- `/api/config` returned the expected Sociobot Entra authority and client ID. `/api/rooms` returned 401 with `WWW-Authenticate: Bearer` when unsigned.
- Clicking **Sign in with Microsoft** redirected to `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/oauth2/v2.0/authorize`, using client `25c704f4-465a-47af-80ab-2c489466b697` and PKCE. No other identity provider was used.
- A cold `/demo` requested only three bodyless same-origin GETs (HTML, JS, CSS). It set no cookies, no session storage, and no IndexedDB; its sole local-storage key was `demo:integration-handoff-room:sample-v1`.
- On production, the demo acknowledgement button was initially disabled, enabled only after all checklist steps, a reviewer name, and explicit confirmation, then produced a named revision-R03 receipt. It downloaded `payment-status-handover-R03.json` and **Reset demo** cleared the name. No request occurred during the complete interaction and no console/page error occurred on `/demo`.
- Desktop and mobile Axe scans of `/`, `/demo`, `/privacy`, `/terms`, `/rooms`, `/settings/billing`, `/rooms/new`, and the client-rendered unknown route found zero serious/critical violations. The live mobile pages had no horizontal overflow. Reduced-motion reset transition was `0.00001s`; keyboard focus had a visible two-ring box shadow (`3px` canvas plus `6px` signal).
- Security headers included CSP with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and the documented permissions policy. Hashed JS/CSS use `Cache-Control: public, max-age=31536000, immutable`.
- The live API limiter was exercised with 55 concurrent `/api/config` reads from one `X-Forwarded-For` client: 42 returned 200 and 13 returned 429, all rejected responses carrying `Retry-After: 1`. The deterministic API claim confirms the documented 40-request burst and 41st-request rejection; the extra two accepted live requests are expected token refill during parallel network scheduling.
- Billing is honestly fail-closed: `/settings/billing` reports checkout unavailable and exposes no hosted-checkout link while Sociobot registration is absent.

## Release-blocking findings

### HIGH — Production unknown-route load logs a console error

**Evidence:** A cold Playwright production load of `https://integration-handoff-room.sociobot.in/unknown-coordinate` returns HTTP 404 and emits:

```text
Failed to load resource: the server responded with a status of 404 ()
```

The other tested public routes (`/`, `/demo`, `/privacy`, `/terms`, `/rooms`, `/settings/billing`) have no console errors. The server serves `index.html` with a 404 status for an unknown path, then the client renders its SPA 404. Thus the page looks styled after JavaScript runs, but it violates the mandatory “no console errors on load” quality gate and does not serve the purpose-built `public/404.html` response body.

**Required resolution:** Serve a real styled 404 document without a console error, or change the routing/error handling so the application does not treat a failed document request as a resource failure while preserving the required 404 response semantics. Add a deployed-route regression that asserts both HTTP status and an empty console-error log.

### HIGH — Material visitor promises are unlisted and untested claims

The claims manifest is present and all of its entries pass, but it does not meet the “every claim is a test” contract. The live page and README make material promises absent from `.factory/claims.json`, including:

- **“The intended Studio price is $79 USD per agency each month.”** (`/terms`, `/settings/billing`, `README.md`)
- **“Client reviewers remain free.”** (`/`, `/terms`, `/settings/billing`)
- **“GitHub tokens are encrypted at rest.”** (`/privacy`)

The manifest has no price/free-reviewer/encryption claim with an observable test. Under the claims contract, an unlisted claim-like sentence is itself a release-blocking finding until it is removed or covered by an exact tagged test.

**Required resolution:** either remove/qualify these promises from the live copy and README, or add exact `claims.json` entries and sandbox tests (including a price/registration contract test and at-rest encryption behavior test). Re-run all claim commands from a clean checkout.

## Conclusion

The candidate’s core demo, privacy behavior, accessibility baseline, build, rate limiting, CIAM redirect, and build identity are strong and the earlier deployment-only billing failure is not reproduced. It nevertheless **FAILS** the acceptance contract because of the live 404 console error and unlisted material claims.
