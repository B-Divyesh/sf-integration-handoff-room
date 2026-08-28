# Independent product verification — FAIL

Date: 2026-08-28 UTC

Work order: `integration-handoff-room-verify-1`

Candidate: `4abd41aee397f4bd7b6c34c553481bb5acf7f193`

Live URL: `https://integration-handoff-room.sociobot.in`
Result: **FAIL — do not release this candidate as the researched product.**

## Executive result

The cold first-read gate passes and the sample room works well as a sample. It
does not, however, perform the brief's real job. A user cannot connect a
repository, create or persist a real room, invite a client, ask a question, or
store a real acknowledgement. The page's **Start for real** action confirms
that these capabilities are future work.

There are independent release blockers beyond scope: the Axum service does not
enforce the documented request allowance, visitor-visible privacy and
sanitization promises are missing from `claims.json`, and the demo has serious
Axe failures. The live deployment is the candidate; this is not a stale-
deployment result.

## First-read gate

**PASS.** From a cold 1440 x 900 visit, the first screen says:

- What it does: “Review an API handoff together.”
- For whom: agency teams handing an integration to a client.
- First action: **Try it with sample data**.
- What happens: “Opens a payment-status handoff.”

The action opens `/demo` in one click without setup or an account. At 390 x
844, the headline, audience sentence, action, and action note are all visible;
the action ends at y=803 and its note at y=837. The three required plain facts
begin below the first viewport at y=869, so the mobile first-screen composition
still needs tightening.

## Release-blocking findings

### Critical — the real job-to-be-done is not implemented

The researched smallest useful product is a Git-connected, client-facing
release room. This candidate is only a browser-local sample. It has no account,
Git connection, fixture import/redaction pipeline, real room creation,
server-side persistence, tenant boundary, client invitation, questions, or
subscription. Clicking **Start for real** returns to the landing page and says
“Real agency rooms are next.” This violates the repository definition of done:
the real job must work end to end, not only as a demo.

### High — mandatory request allowance is not enforced

The documented read policy is 20 requests/second with burst 40, keyed from the
first `X-Forwarded-For` hop. Fresh live probes with a fixed forwarded address
produced:

- 160 sequential requests to `/demo`: 160 x HTTP 200, no 429.
- 200 requests at concurrency 100: 200 x HTTP 200, no 429.
- Autocannon, 300 requests at concurrency 60: 300 x HTTP 200 in 1.09 s,
  approximately 300 requests/second, no 429.

No `Retry-After` header can be observed because the server never returns 429.
The allowance observed is therefore **not enforced through at least 300
requests/second and a 60-request burst**. `server/Cargo.toml` has no limiter
dependency, and `server/src/main.rs` explicitly defers rate limiting to M2.

### High — serious accessibility failures and undersized touch targets

Axe 4.11 found:

- Day chart, `/demo`, desktop and 390 px: `color-contrast` serious. “Redaction
  report” is 4.36:1 (`#28733e` on `#d5e2e0`), below 4.5:1.
- `/demo`, 390 px, both themes: `scrollable-region-focusable` serious. The
  horizontally scrollable `<pre class="payload">` has no explicit keyboard-
  accessible focus target for Safari.

The mobile header, footer, and demo banner also contain targets below the
required 44 px height: wordmark 24.8 px; primary nav links 21.7 px; theme
button 36 px; Reset demo 40 px; Start for real 24.8 px; footer links 21.7 px.
Checkboxes have large clickable labels, so their native 18 px boxes were not
counted as separate target failures.

Keyboard order, skip link, and visible focus rings otherwise work. The sample
acknowledgement/export flow also passes the repository keyboard-only test.

### High — visitor-visible claims are absent from the claims contract

All four listed claims have exactly one matching `@claim:` test, but the live
site and README make additional claims that are not entries in
`.factory/claims.json`, including:

- “No live API calls run in this sample.”
- “This sample does not send API requests.”
- “The demo does not ... send fixtures to a server, or load third-party
  analytics, fonts, or scripts.”
- “Sanitized sample” and “No secret-like values found in this prepared
  sample.”
- README: “M1 uses no third-party analytics, CDNs, embedded payment providers,
  or live API requests.”

The `demo-isolated` test rejects cross-origin requests, but it would allow a
same-origin API request and does not inspect cookies, session storage, IndexedDB,
or request bodies. The sanitization test only checks that a redaction message
exists; it does not test a redaction corpus or scan the fixture. Under the
attached claims contract, these unlisted or incompletely proved promises block
release.

### Medium — the Dockerfile violates the required Rust base-image contract

The API stage uses `FROM rust:1.88-slim-bookworm`. The supplied backend contract
requires the floating stable tag `rust:1-slim` or `rust:1-alpine` and explicitly
forbids a pinned minor. The web and Rust release stages build independently,
and the deployed container works, but the checked-in production Dockerfile is
not compliant. No Docker-compatible engine was present in the verifier image,
so a local image build could not be repeated.

## Other defects

### Medium — unknown URLs return HTTP 200

`/does-not-exist` and `/not-a-real-route` render the designed not-found screen
but return HTTP 200. The Axum fallback always serves `index.html`; the
`staticwebapp.config.json` 404 override is not used by the deployed container.
This is a soft 404 and breaks the required real 404 response.

### Medium — the 390 px first screen omits the three facts above the fold

At 390 x 844 the atlas is placed ahead of the copy. The action barely fits,
but the privacy/offline/price facts start at y=869. The attached first-screen
contract requires those three facts in the first screen.

### Low — hashed assets have no durable cache policy

HTML, JavaScript, CSS, and other assets have no `Cache-Control` and no ETag.
Twelve requests for the same hashed JavaScript alternated between two
`Last-Modified` values (`19:01:06` and `19:08:57` UTC), so that validator is not
stable across replicas. Immutable hashed assets are therefore not cached as
required.

### Low — the public footer reports the wrong build identity

Every live page says `build dev` in the footer, while `/health` correctly
reports candidate `4abd41aee397f4bd7b6c34c553481bb5acf7f193`.

## Claims gate

The mandated first invocation happened before any other repository inspection.
From the untouched clone, all four commands initially failed because
`@playwright/test` was not installed. After the required `npm ci`, each exact
command passed against its own fresh browser context:

| Claim | Installed clean-checkout result | Evidence |
| --- | --- | --- |
| `demo-sample-room` | PASS | 1 Playwright test, 4.6 s |
| `demo-acknowledgement` | PASS | 1 Playwright test, 5.3 s |
| `demo-handover-export` | PASS | Download parsed with all four promised sections and reviewer name |
| `demo-isolated` | PASS | One `demo:` localStorage key; same-origin request log |

The pre-install failures were dependency-availability failures, not behavioral
failures. The later exact runs prove the declared sample behaviors, but the
unlisted-claim finding above independently fails the claims contract.

## Functional evidence

- Normal flow: completed all three required checks, entered a reviewer name,
  confirmed revision R03, recorded the acknowledgement, and downloaded
  `payment-status-handover-R03.json`.
- Export: contained `selected_fixture`, `decisions`, `checklist`, and
  `acknowledgement`; all checklist values were true and revision was R03.
- Boundary: an 80-character reviewer name was accepted and preserved.
- Invalid input: whitespace-only reviewer name produced the announced error
  “Complete every required step, enter your name, and confirm the review.”
- Recovery: Reset demo removed the receipt, cleared all checks, and retained
  only `demo:integration-handoff-room:sample-v1`. Corrupt JSON in that key was
  replaced with a fresh usable seed on reload.
- Responsive: no page-level horizontal overflow at 390 px or at the 640 px
  reflow approximation for 200% desktop zoom.
- Reduced motion: animations were absent and transition/animation durations
  were reduced to 0.01 ms.
- Links: all product links resolved. The only status defect was the soft-404
  behavior described above.

## Privacy, network, and response headers

The complete live sample flow made only same-origin GET requests for documents,
JavaScript, and CSS. It made no API POST, analytics, font-CDN, billing, AI, or
auth request. There were no console errors, page errors, or failed resource
responses.

Live responses include a restrictive same-origin CSP, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and a
camera/microphone/geolocation `Permissions-Policy`. Sign-in and billing are not
implemented, so Entra authority and Sociobot billing checks are not applicable
to the sample; their absence is part of the critical real-product gap.

## Build, tests, identity, and performance

| Check | Result |
| --- | --- |
| Candidate/clean tree before QA | PASS — exact SHA, no changes |
| `npm ci` | PASS — 60 packages, 0 vulnerabilities |
| `npm run check` | PASS |
| `npm test` | PASS — 8/8 |
| `npm run test:e2e` | PASS — 9/9 |
| `npm run test:api` | PASS — 2/2 |
| `npm run build` | PASS — `dist/` produced |
| `npm run build:api` | PASS |
| Runtime with only `PORT` | PASS — production binary started; `/health` 200 |
| Factory `verify-url.sh` root/demo | PASS — 570/561 ms, no errors, title/lang/h1/main present |
| Live build identity | PASS — `/health` SHA equals candidate |
| Live/local bytes | PASS — HTML, JS, and CSS SHA-256 hashes match exactly |
| Initial JS | PASS — 22.35 KB raw, 7.57 KB gzip |
| CSS | PASS — 17.54 KB raw, 4.16 KB gzip |
| Lighthouse mobile landing | 100 performance / 100 accessibility / 100 best practices / 100 SEO |
| Lighthouse metrics | FCP 1.2 s; LCP 1.2 s; CLS 0; TBT 0 ms |
| Console/page errors | PASS — none |
| Docker image build | NOT RUN — no Docker, Podman, Buildah, or nerdctl in verifier image |

## Applicability notes

This is not a library, CLI, or PWA, so consumer-package and service-worker
checks do not apply. There are no real data endpoints or database in the
candidate, so tenant persistence and concurrent write checks cannot be run.
The static server did serve all 300 concurrent-probe responses successfully;
that same result proves the missing limiter.

## Required next step

Do not release this commit as the product. Implement the real Git-connected
room and identity/persistence boundary, enforce rate limits with 429 plus
`Retry-After`, make every live claim an exact sandbox test, clear both serious
Axe issues and touch-target failures, correct the container/404/cache/build-id
contracts, then rerun this verification from a clean clone and fresh live
deployment.
