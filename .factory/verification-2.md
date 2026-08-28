# Independent product verification — FAIL

Date: 2026-08-28 UTC
Work order: `integration-handoff-room-verify-2`
Candidate: `ce5fcdb7b9bfdc9dab8da52d01b32c5f32a53f3f`
Live URL: `https://integration-handoff-room.sociobot.in`

## Release decision

**FAIL — do not release this candidate.** The earlier deployment-only concern is resolved: fresh `/health` returned exactly `ce5fcdb7b9bfdc9dab8da52d01b32c5f32a53f3f`, and the live footer showed `build ce5fcdb7b9bf`. The failure is from current, reproducible product-contract defects, not from a stale deployment.

## First-read and demo gates

**PASS.** A cold desktop visit answered all required questions in plain words:

- What: “Review an API handoff together.”
- For whom: “agency teams handing an integration to a client”.
- First action: **Try it with sample data**, with “The sample opens now” beside it.

The one-click `/demo` flow opened the Northstar Market payment-status room. At 390 x 844 it had no horizontal overflow, all visible links/buttons measured at least 44 px, and reduced motion applied a `0.00001s` transition. The reviewer completed all checks, entered `Live QA Reviewer`, recorded the dated R03 acknowledgement, and downloaded `payment-status-handover-R03.json`.

## Mandatory claims gate

`.factory/claims.json` exists and contains 12 entries. After `npm ci` from this checkout, every exact listed command passed against its test demo/API entry point:

| Claim | Result |
| --- | --- |
| `demo-sample-room` | PASS — 1 Playwright test |
| `demo-acknowledgement` | PASS — 1 Playwright test |
| `demo-handover-export` | PASS — 1 Playwright test |
| `demo-isolated` | PASS — 1 Playwright test |
| `demo-data-private` | PASS — 1 Playwright test |
| `fixture-sanitized` | PASS — 1 Playwright test |
| `fixture-redaction-blocks-secret` | PASS — 1 Cargo test |
| `agency-room-persisted` | PASS — 1 Cargo test |
| `agency-room-browser` | PASS — 1 Playwright test |
| `client-review-workflow` | PASS — 1 Playwright test |
| `api-rate-limit` | PASS — 1 Cargo test |
| `studio-hosted-checkout` | PASS — 1 Playwright test |

The claim suite does not prove that the external checkout is registered; its test asserts the link only. Fresh live evidence below shows that the advertised checkout is unavailable.

## Release-blocking defects

### High — Studio checkout is advertised but unavailable

The live Billing page advertises “$79 USD per agency each month” and links to the required Sociobot checkout URL. A fresh `GET https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout` returned **HTTP 404**. An agency therefore cannot start the advertised subscription. This is an end-to-end failure of the stated monetisation path, regardless of whether the missing registration is an operator task.

### High — documented 20 rps / burst-40 read allowance is not what the deployment enforces

The README promises reads at 20 requests/second with burst 40. From one fixed first-hop `X-Forwarded-For` address, 45 concurrent fresh `GET /api/config` requests produced **13 x 200 and 32 x 429**; the first 429 was request 13 and contained `Retry-After: 1`. Thus 429 handling itself works, but the observed allowance is approximately a 12-request burst (with one refilled token), not the documented burst of 40. This is a false operations claim and a material availability defect behind a single live replica.

### High — the researched Git-connected/OAuth requirement is not met

The actual signed-in room flow has only four manually typed fields — public GitHub owner, repository, ref, and JSON path — and `server/src/main.rs` fetches `raw.githubusercontent.com`. There is no repository connection, OAuth/App consent, selected-repository permission boundary, or private-repository support. The researched brief requires a Git-connected release room and least-privilege repository OAuth; the plan likewise describes a read-only connection. The current public-URL import is useful, but is not that contracted integration.

### High — required data deletion control is absent

The brief requires export/delete controls. The live privacy page says: “Contact the site operator to delete an agency workspace while self-service deletion is prepared.” There is no delete route or settings control. This fails the stated privacy/data-control contract for real persisted agency records.

### Medium — the aggregate local quality gate was flaky/failing

`npm run test:all` initially failed during the 18-test Playwright section; `.last-run.json` named the public-pages Axe test. Re-running that test in isolation passed (1/1, 27.3 s), and a fresh full `npm run test:e2e` then passed (18/18). The product therefore has passing rerun evidence, but the required aggregate gate did not pass reliably on its first clean run and needs stabilisation before release.

## Independent functional, security, and accessibility evidence

- Real-route test identity is implemented with Sociobot Entra only. Live `/rooms` redirected to `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/...` with client ID `25c704f4-465a-47af-80ab-2c489466b697` and PKCE; no alternate product identity provider was observed.
- Invalid private review token: live `GET /api/review/not-a-valid-token` returned 404 and a useful recovery message. Unauthenticated `GET /api/rooms` returned 401 with `WWW-Authenticate: Bearer`.
- The Cargo persistence/tenant test passed: it creates a room, verifies server redaction, rejects another tenant, creates a scoped review link, records a question and acknowledgement, and exports the room.
- Live `/unknown-coordinate` returned real HTTP 404. Live `/health` and `/ready` returned 200 with the candidate SHA.
- Keyboard smoke: first Tab reached “Skip to main content”; it had a designed 3 px/6 px focus box-shadow, and Enter moved focus to `#main`.
- Live desktop landing and mobile demo had no console or page errors. Playwright Axe 4.11 returned no serious/critical violations on the checked landing and completed 390 px demo flow.
- The full browser suite additionally passed its local Axe coverage on public routes/themes/desktop/390 px in the successful rerun.

## Privacy, headers, caching, and size

During a fresh live demo acknowledgement and export, Playwright observed only three bodyless same-origin GETs (`/demo`, hashed JS, hashed CSS). Cookies, session storage, and IndexedDB were empty; the only local key was `demo:integration-handoff-room:sample-v1`. No fixture, checklist, acknowledgement, analytics, font CDN, or third-party script request left the page.

The live HTML, JS, CSS, health, and API responses sent CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive permissions policy. Hashed JS/CSS were `Cache-Control: public, max-age=31536000, immutable` with ETags. The production build emitted 43.43 KB initial JS (12.78 KB gzip) and 21.40 KB CSS (4.77 KB gzip); the deferred MSAL chunk was 316.60 KB raw / 79.63 KB gzip and did not load on the landing or demo.

## Local build and runtime evidence

| Check | Result |
| --- | --- |
| Clean candidate SHA/tree before docs | PASS — `ce5fcdb...` and clean |
| `npm ci` | PASS — 62 packages, 0 vulnerabilities |
| `npm run check` | PASS |
| `npm test` | PASS — 8/8 |
| `npm run test:api` | PASS — 5/5 |
| `npm run test:e2e` | PASS on rerun — 18/18 |
| `npm run build` | PASS — `dist/` produced |
| `npm run build:api` | PASS — release binary produced |
| Local release server with compiled assets | PASS — `/health` 200, unknown route 404 |
| Server started with only `PORT` | PASS — `/health` 200; startup log recorded generated default data directory/config |
| Exact Docker build | NOT RUN — Docker is not installed in this verifier container |

The first aggregate `npm run test:all` result is intentionally not marked PASS because its embedded browser run failed once; see the Medium finding.

## Scope notes

This is a web service, not a library, CLI, or PWA; package-consumer, CLI, service-worker update, and offline-reload checks are not applicable. Authenticated live creation could not be performed without an agency identity, so the authenticated persistence path was independently exercised by its server integration test and browser mocked-API claim test; this does not waive the defects above.

## Required next actions

1. Register and verify the live Sociobot recurring Studio product so checkout returns hosted checkout rather than 404.
2. Align deployed limiter capacity with the documented 20 rps / burst-40 policy (or change the documented/tested policy honestly), then test one client through the live ingress.
3. Implement least-privilege GitHub repository connection/OAuth and selected-repository import, or change the accepted scope and remove the Git-connected/OAuth promise.
4. Provide and test authenticated agency deletion/revocation controls.
5. Eliminate the full-suite flake and obtain a clean `npm run test:all` pass before re-verification.
