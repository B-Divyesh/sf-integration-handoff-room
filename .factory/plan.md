# Integration Handoff Room — venture plan

Status: planned on 2026-08-28. Builders must read this file, `.factory/brief.json`, `.factory/design.md`, every prior milestone handoff, and the current claims file before starting a milestone. A milestone is not complete until its claims and review/polish loop pass.

## Product requirements document

### Customer and situation

Small software agencies and fractional engineering teams repeatedly deliver API integrations to clients. At release time, the contract is spread across a repository, a request collection, messages, and a call. The agency needs the client to review one safe, runnable-looking example, understand the decisions and owners, ask questions in one place, and explicitly acknowledge the handover. Today they send links, share Postman or Bruno collections, screen-share, then spend support hours reconstructing what was agreed.

### Promise

Turn an API release into one client-ready room where the example, decisions, owners, and acknowledgement agree.

### The three jobs to nail

1. **Prepare a reviewable release.** An agency lead selects a release and safe request/response fixtures, checks the redaction report, and creates a room that a client can understand without an API client.
2. **Resolve the open work in context.** Both sides can ask a specific question, record a versioned decision, name its owner and due date, and see what remains before acceptance.
3. **Close and preserve the handover.** The named client reviewer records an acknowledgement after the checklist is complete; the agency exports the exact handover record for future support.

### Users and permissions

- **Agency owner/admin:** manages agency, repositories, staff, billing, exports, and deletion.
- **Agency contributor:** prepares rooms and responds to questions; cannot manage billing or delete the agency.
- **Client reviewer:** uses a private invitation to inspect, ask questions, record acknowledgement, and download the permitted handover export. Reviewers never see other rooms or agency settings.

### Monetisation

- **Client reviewer — free:** private read/review access; no account or paid prompt.
- **Studio — $79 USD/month per agency:** recurring Dodo-backed subscription via the Sociobot billing engine. Includes staff seats, private client reviewers, active client rooms, repository connection, acknowledgement records, and exports. Archived rooms remain readable and exportable after cancellation; creating or reactivating a room requires an active Studio subscription.

The factory registers the monthly Studio plan in Sociobot/Dodo. The product only sends people to Sociobot’s hosted checkout and reads the resulting entitlement; it never embeds Dodo or stores card data. Pricing and cancellation language must remain exact in the product and terms.

### Deliberately out of scope

- Sending live API requests, acting as an API gateway, or becoming a test runner.
- Storing source code, secrets, production credentials, tokens, or unredacted request bodies.
- Replacing a wiki, ticket tracker, contract, e-signature service, or source host.
- General chat, project management, automatic legal approval, or claiming that a product acknowledgement is a contract.

### Success and product measurements

The pilot success measure is: 80% of client integration questions are answered from the room, and post-handoff clarification hours fall 30%. Instrument only a privacy-respecting, first-party aggregate page view and opt-in pilot feedback. Do not track client review behavior across rooms. The M4 admin screen reports agency-level room completion and voluntary feedback, never third-party analytics.

## Evidence and wedge

| Signal | What it says | Product implication |
| --- | --- | --- |
| [HN item 45214077](https://hn.algolia.com/api/v1/items/45214077) (2025-09-11) | A small team has onboarding, design, API, and operational material scattered across Notion, Drive, GitHub, and Slack; maintaining and syncing it is hard. | The room must be a concise release artifact, not another general documentation library. |
| [Bruno issue #5657](https://github.com/usebruno/bruno/issues/5657) (2025-09-29) | Developers and QA need reusable valid, invalid, and localized request variants for debugging, regression, and handoff. | A fixture is a first-class, versioned review object, not a pasted code block. |

Notion and Confluence explain; Postman and Bruno execute; Stoplight documents. Their gap is the agency-client acceptance moment: none binds one selected safe example, the decision record, named ownership, and acknowledgement into a durable client-facing artifact. The wedge is a focused release room that makes the support record at the same time as the acceptance call.

## Architecture

### Stack and deployment shape

- **Web:** Vite 7, strict TypeScript, browser-native components and CSS custom properties. No framework runtime is warranted: screens are structured forms, documents, and focused state transitions, not a rich drag-and-drop editor. Keep initial public JS under 150 KB gzip and never load a third-party script or font CDN.
- **API:** Rust 2021, Axum, Tokio, SQLx, PostgreSQL, Serde, Tracing. The API lives in `server/`; its container is multi-stage, non-root, accepts `PORT` with a default of `8080`, and exposes `/health` with the build SHA. It must boot without required secret environment variables, generating and persisting any internal secret material under its data volume when an operator has not supplied an override.
- **Delivery:** the factory work order deploys one Container App, so the Axum process serves the compiled Vite build and future `/api` routes from the same origin on `PORT`. The frontend is built into the multi-stage image; Axum supplies SPA fallback and production security headers. `staticwebapp.config.json` remains as a portable static-host configuration. The API CORS allowlist, when cross-origin use is introduced, only permits the production web origin and localhost development origin.
- **Storage:** PostgreSQL for shared data and job coordination; private object storage for encrypted exports and larger sanitized fixture attachments. The browser stores only an Entra session cache and the isolated demo namespace. No source repository token, raw secret, or fixture body is put in browser storage.
- **Tooling:** npm/Vitest/Playwright 1.58.2 for web checks; Cargo tests for the API; GitHub Actions runs typecheck, web tests, web build, API tests, and release build. Playwright browsers are installed in CI when end-to-end tests are introduced in M1.

### Data model, ownership, and tenancy

Every mutable business row has `agency_id`; PostgreSQL row-level access is enforced in application queries and covered by cross-tenant tests. IDs are opaque UUIDs. Timestamps are UTC. All user-visible changes write an immutable audit event with actor type, safe target identifiers, and before/after summaries that exclude fixtures and tokens.

| Entity | Key fields | Owner / purpose |
| --- | --- | --- |
| `users` | `id`, `entra_oid`, display name, email snapshot | Stable identity keyed only by Entra `oid`; email is display/contact data, not the identity key. |
| `agencies`, `memberships` | agency name, role, user id | Tenant boundary and staff permissions. |
| `subscriptions` | provider subscription id, plan, status, period end | One Studio entitlement per agency; updated from verified Sociobot billing events. |
| `repository_connections` | provider account/repository ids, scopes, encrypted refresh reference | Agency-owned, read-only GitHub connection; token material is envelope-encrypted server-side. |
| `rooms` | title, status, repository/release ref, owner, client label | The unit of review and billing activity. |
| `room_revisions` | monotonic revision, source commit/tag, published at | Snapshot of what the client reviewed; never rewritten after acknowledgement. |
| `fixtures`, `fixture_versions` | request/response, headers, redaction report, checksum | Sanitized selected examples tied to one revision. Raw imports are short-lived job input and are purged after redaction. |
| `checklist_items` | label, required, state, completed by/time | Acceptance criteria per room revision. |
| `questions`, `decisions` | status/version, decision text, owner, due date | The question and agreement record; decisions are append-only versions. |
| `review_invites`, `review_sessions` | hashed token, expiry, reviewer email/name, permissions | Narrow, revocable client access to exactly one room revision. |
| `acknowledgements` | reviewer typed name, checklist revision, timestamp, disclaimer version | Immutable record of a named acknowledgement, explicitly not a legal signature. |
| `exports` | revision, format, checksum, expiry/storage key | Versioned export and download audit trail. |
| `jobs` | kind, safe payload, state, attempts, run_after | Idempotent redaction, import, export, mail, cleanup, and billing-sync work. |

### Identity and access

M2 uses Sociobot Microsoft Entra External ID exactly as follows: frontend `@azure/msal-browser` with PKCE, redirect login, sessionStorage cache, scopes `openid profile email`, and the shared SPA client ID `25c704f4-465a-47af-80ab-2c489466b697`. Defaults (all overrideable) are `ENTRA_TENANT_ID=35c6fe40-0ec0-46b6-98c6-213ad4de6650`, `ENTRA_TENANT_SUBDOMAIN=sociobotcustomers`, and that client ID. The redirect to register is `https://integration-handoff-room.sociobot.in/auth/callback`.

The API resolves OIDC discovery at startup and caches discovery/JWKS for one hour. It validates RS256 signatures, `aud`, tenant ID, discovered issuer, `exp`, and `nbf`, returning `401` with `WWW-Authenticate: Bearer` when invalid. Authorisation happens after identity validation and before every tenant query. Client reviewers are not given agency credentials: a hashed, one-room, expiry-bound review token has the least privilege needed; acknowledgement requires a typed name and an explicit acknowledgement checkbox. Tokens are never logged.

GitHub connection is a separate OAuth/App flow in M2, with repository metadata and read-only contents permission only. Repository selection is explicit; no write, organisation administration, workflow, issue, or user-data scopes. The consent screen and UI explain exactly what files are fetched. Disconnect revokes the provider grant where supported and deletes local encrypted token material.

### Billing

M2 wires Studio to the Sociobot product endpoint `https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout` (pilot uses `https://pilot-api.sociobot.in` and the registered test product). The factory configures this product as the Dodo-backed recurring $79/month Studio plan and supplies the documented plan selection/return parameters at registration time; implementation must not guess undocumented Dodo APIs. A hosted checkout return is only a hint: the backend verifies the subscription entitlement against Sociobot, handles signed provider events idempotently, and lets cancellation/failed-payment grace rules come only from the registered plan. Client reviewers, accessibility, safety notices, and export of existing data are never paywalled. Restore/entitlement recovery is available in Billing.

### Fixture safety, jobs, files, and email

Import is pull-only through the selected repository connection. Before saving a fixture, the redaction job detects and replaces common secret patterns (authorization headers, bearer/basic tokens, API keys, private keys, cookies, connection strings, JWT-like strings, high-entropy values) and requires a human confirmation for any unresolved finding. The UI labels examples as sanitized samples, shows exactly what was removed, and offers manual edits. It rejects oversized/binary files and never offers a "show original" escape hatch.

Jobs run from PostgreSQL with leases, retry limits, idempotency keys, and dead-letter visibility. Scheduled work deletes demo tenants after 24 hours, purge raw import buffers immediately after redaction, expires review tokens, generates exports, delivers transactional invitation/reminder emails, and reconciles billing. Email is transactional only; no marketing list or behavioral tracking pixels. Attachments and exports are encrypted in private storage, use short-lived download URLs, and are deleted on expiry or tenant deletion.

### AI, only where it helps

M3 adds one optional action: **Draft a plain-language reply** to a client question from the selected sanitized fixture and its related decision. The user sees and confirms the exact selected text before sending it; the streamed draft is editable, is not saved unless the user chooses to post it, and there is always a manual reply path. The API calls only the Sociobot OpenAI-compatible gateway at `https://api.sociobot.in/v1/responses`, choosing an available `gpt-5.6-*` model (normally `gpt-5.6-sol`). It uses a server-side `FACTORY_SOCIOBOT_KEY` with per-agency daily spend cap when provisioned; otherwise the explicit opt-in BYOK path stores the user’s Sociobot key only in browser storage and sends it only to `api.sociobot.in`. Demo and automated tests use canned responses and never spend. No Azure endpoint or raw model key appears in browser code.

### Rate limits, operations, and recovery

Every API endpoint except liveness has a client-IP limit keyed from the first `X-Forwarded-For` hop (fallback socket IP), returns `429` plus `Retry-After`, and has a stricter per-user/agency limit where identity exists. Initial policy: read 20 req/s burst 40; writes 5 req/s burst 10; auth callback/token processing 5/min/IP; review-token attempts 10/min/IP; imports/exports 6/hour/agency; AI 2/min/user and 20/day/agency; billing/webhook endpoints independently bounded and idempotent. Tests must prove a protected route reaches `429` and returns `Retry-After`.

`/health` reports build SHA and liveness; `/ready` checks database and job-worker readiness; internal metrics expose request count/latency, limiter denies, job age/failure, redaction findings, export failures, and entitlement state without personal data. JSON structured logs include request and tenant-safe correlation IDs, redact authorization/token/fixture fields, and have alert thresholds for failed jobs, 5xx rate, queue age, and failed backup. Target error budget: 99.5% successful non-4xx API requests each rolling 30 days.

PostgreSQL uses daily snapshots plus point-in-time recovery with 30-day retention; encrypted object exports use versioning and 30-day recovery. M4 documents and performs a quarterly restore drill to an isolated environment. An agency admin can export all agency data and request deletion; deletion revokes review links and connections, queues fixture/export erasure, retains only the minimum billing/audit record required by law, and reports completion.

## Design system

The visual thesis, tokens, component inventory, screen descriptions, accessibility rules, original-asset provenance, and implementation constraints are in [.factory/design.md](design.md) and [.factory/components.md](components.md). The source token contract is [`src/styles/tokens.css`](../src/styles/tokens.css). M1 must implement the visual system rather than substitute a generic dashboard or SaaS hero.

## Milestones

### M1 — A tryable release room

**Status:** planned. **Goal:** a stranger can use a one-click, safe sample room to understand and complete the core handoff loop without signing in.

**Routes/screens:** `/` landing; `/demo` and `?demo=1` seeded room; demo room fixture detail, decision rail, checklist, acknowledgement panel, export action; `/privacy`, `/terms`, and designed `/404`. The landing follows the standard information order, uses clear title/metadata, and calls the demo in one click.

**Scope:** build the Vite interface against a local, versioned `demo:` storage namespace. Seed one realistic payment-status release with a sanitized request/response fixture, two decisions, named owners, an incomplete acceptance checklist, and a client reviewer. A visitor selects the fixture, completes the required sample acceptance steps, enters a name, records an acknowledgement, and downloads a JSON handover record. The persistent demo banner says it is sample data, offers Reset demo and Start for real, and never reads/writes real storage or calls a production API. The UI must be keyboard usable, mobile first, and honest that it is sample data. Add `.factory/demo.md`, accessibility/browser tests, page metadata, privacy/terms, and a copy audit.

**M1 claims (the authoritative entries are in `.factory/claims.json`):**

| Claim id | Visitor-visible claim | Required observable test |
| --- | --- | --- |
| `demo-sample-room` | Sample data opens a realistic payment API handoff room. | Fresh browser opens `/demo`, finds the seeded room and its selected fixture. |
| `demo-acknowledgement` | A reviewer can record a named acknowledgement in the sample room. | Fresh demo completes required items, types a name, and sees the dated acknowledgement receipt. |
| `demo-handover-export` | Exports a handover JSON file with the selected fixture, decisions, checklist, and acknowledgement. | Download and parse JSON; assert all four sections and submitted reviewer name. |
| `demo-isolated` | Demo changes stay in a separate browser storage namespace. | From `/demo`, mutate/reset then assert only `demo:` keys are used and no cross-origin requests occur. |

**Tests:** Vitest for seeded data, redaction display, handover serialization, and router/title logic; Playwright 1.58.2 test per M1 claim tagged exactly `@claim:<id>`; keyboard-only acknowledgement/export test; Axe no serious/critical findings; viewport checks at 390px and desktop; Playwright request log for same-origin-only demo; production build has no console errors and stays under 150 KB gzip JS. Update `claims.json`, `.factory/demo.md`, `.factory/copy-audit.md`, and handoff with test evidence.

**Definition of done:** landing makes the job and first action clear in one screen; `/demo` is directly reloadable and resettable; the complete sample handoff works without an account; every claim test passes from a clean browser context; privacy/terms/404 and route metadata work; no secret-looking sample value is present; accessibility and reduced-motion checks pass; `npm test`, `npm run build`, and API skeleton checks pass. Write `.factory/handoff-m1.md`, set this status complete, then obtain a review/polish PASS before M2.

### M2 — Real agencies, rooms, and subscription

**Status:** planned. **Goal:** an agency can sign in, create its isolated workspace, connect one repository read-only, save a room, and start/restore a Studio subscription.

**Routes/screens:** `/auth/callback`, `/rooms`, `/rooms/new`, `/rooms/:roomId`, `/settings/agency`, `/settings/repositories`, `/settings/billing`; the M1 public routes remain unchanged and demo remains isolated.

**Scope:** implement Entra CIAM PKCE and server JWT validation; provision agency/membership on first sign-in; PostgreSQL migrations with reversible down migrations; tenant/RBAC enforcement; read-only GitHub connection and explicit repository selection; asynchronous import of only selected fixture paths; automatic redaction plus human confirmation; persistent room draft/publish flow; Studio pricing/checkout/return/verified entitlement/restore; billing webhooks; base rate limiting; health/readiness/logging; private object storage boundary. Ensure no raw Git token or unredacted import survives. Factory/operator task: register the Entra callback and Sociobot/Dodo Studio test/live plan before release.

**Claims to add:** `agency-room-persisted`, `cross-tenant-room-denied`, `fixture-redaction-blocks-secret`, `studio-checkout-uses-hosted-sociobot`, and `api-rate-limit`. Each gets an isolated API/browser test; checkout uses pilot fixture responses in automation, not a live payment.

**Tests:** SQLx migration up/down and temporary-Postgres API integration; JWT reject/accept fixtures including bad audience/issuer/tenant; tenant isolation; OAuth scope/config contract; redaction corpus; billing webhook idempotence; 429 plus `Retry-After`; Playwright sign-in mocked token flow and room persistence; demo regression. Run a 100 rps read smoke and record result.

**Definition of done:** a real Studio test-mode agency can create/reload only its own safe room, configure/replace a repository connection with least privilege, see verified subscription state, and cancel/disconnect without losing export rights; all migration, security, rate-limit, demo, build, and claims checks pass; deployment configuration has no required secret missing; write `.factory/handoff-m2.md` and obtain review/polish PASS.

### M3 — Decisions, questions, and client acceptance

**Status:** planned. **Goal:** turn a saved room into a shared, accountable client review and acknowledgement record.

**Routes/screens:** `/rooms/:roomId/review`, `/rooms/:roomId/decisions`, `/rooms/:roomId/questions`, `/review/:token`, `/review/:token/acknowledged`; room activity view and client invitation dialog.

**Scope:** implement versioned decisions, question threads, named owners/due dates, immutable room revisions, checklist templates, private expiring/revocable client invitations, client question submission, acknowledgement receipt/disclaimer, and activity/audit timeline. Invitations are transactional messages with no tracking pixel. Add the optional gateway-only AI draft action with explicit content preview/consent, streaming/cancel/undo, cost/rate guard, canned demo/test behavior, and manual alternative. A decision or fixture update after acknowledgement creates a new revision and visibly marks the old acknowledgement as applying only to its revision.

**Claims to add:** `client-review-token-is-scoped`, `decision-history-is-versioned`, `acknowledgement-binds-room-revision`, `question-owner-visible`, and, only if the copy states it, `drafts-client-reply-from-selected-context` using a recorded gateway fixture.

**Tests:** access token cannot reach a different room; expired/revoked link denied; concurrent decision update behavior; acknowledgement immutability/revision markers; client keyboard flow; email content snapshot; recorded AI streaming/cancel/no-send test; full fresh demo regression. Test that AI receives only user-confirmed sanitized text and demo makes no gateway request.

**Definition of done:** a client reviewer can complete a private review without an agency account, questions and decisions have accountable history, acknowledgement cannot be silently reassigned to newer content, and the agency can see an accurate timeline; all accessibility, privacy, entitlement, rate-limit, claim, and regression checks pass; write `.factory/handoff-m3.md` and obtain review/polish PASS.

### M4 — Operable records and trustworthy exits

**Status:** planned. **Goal:** agencies can preserve, export, and delete handover data while operators can run the service safely.

**Routes/screens:** `/rooms/:roomId/export`, `/settings/data`, `/settings/notifications`, `/settings/security`, internal `/admin/operations` (factory-authorised operators only), and public `/status` only if factory operations policy permits it.

**Scope:** versioned signed handover export (JSON plus accessible HTML/PDF print view); agency-wide export; self-service deletion and retention status; download expiry; transactional invite/reminder controls with opt-in reminders; billing reconciliation; immutable audit retrieval; worker dashboard/dead-letter recovery; metrics/alerts; backup/restore runbook and isolated restore test; support-safe diagnostics. Do not add tracking pixels, marketing mail, or client data to logs.

**Claims to add:** `export-matches-acknowledged-revision`, `agency-export-is-complete`, `review-link-revoked-after-delete`, `backup-restore-preserves-tenant-boundary`, and any delivery timing claim only if measured.

**Tests:** parse each export and compare checksum/revision; asynchronous export retry; delete purge sequence and revoked links; backup restore fixture; billing reconciliation idempotence; failure alert/structured-log redaction; 100 rps smoke; admin RBAC. Run a documented restore drill before handoff.

**Definition of done:** an agency can leave with usable data, request deletion, and keep the exact accepted revision; operational staff can identify a failed job without accessing private fixture content; verified backup restore, alerts, data controls, all claims, and demo regression pass; write `.factory/handoff-m4.md` and obtain review/polish PASS.

### M5 — Release-aware sharing and adoption

**Status:** planned. **Goal:** reduce repeated setup as agencies deliver more releases while retaining the narrow handoff purpose.

**Routes/screens:** `/settings/repositories/:connectionId`, `/rooms/new/from-release`, `/rooms/:roomId/changes`, `/share/:token` (read-only export share if an agency explicitly enables it), and `/integrations`.

**Scope:** opt-in Git release/tag sync that proposes—not silently publishes—a new room revision; compare safe fixture checksums; clear change summary; repository connection health; one-click duplicate from prior room; narrowly scoped Slack/email delivery only if factory can run it without a paid third party; shareable, expiry-bound read-only export link; import templates for Bruno/Postman collections only after sanitizer support and fixture tests. Never become a source host or test runner.

**Claims to add:** `release-sync-requires-publish-confirmation`, `changed-fixture-is-marked`, `shared-export-expires`, and any imported collection support claim.

**Tests:** mocked Git webhook/release poll deduplication, no publish without confirmation, change-set accuracy, disabled/revoked repository behavior, share link expiry, imported collection redaction corpus, and tenant isolation. Preserve all earlier demo and claim tests.

**Definition of done:** a connected agency can turn a new release into a proposed review revision without redoing its room, can clearly see what changed, and can share only the exact export it enabled; integration failures are understandable and recoverable; all claims, rate limits, accessibility, security, and regression checks pass; write `.factory/handoff-m5.md` and obtain review/polish PASS.

## Risks and unknowns

| Risk or unknown | Why it matters | Experiment / decision gate |
| --- | --- | --- |
| Clients may still prefer an acceptance call over a room. | The product could become another link in the pile. | M1 usability sessions with 5 agency-client pairs: task is find expected payload, answer one question, acknowledge. Advance only if 4/5 finish without a call and can explain what was acknowledged. |
| Automated redaction may miss secrets or damage useful examples. | A leak is unacceptable; false positives destroy trust. | Build M2 adversarial fixture corpus (tokens, JWTs, nested JSON, headers, encoded values) and target zero known-secret escapes; require review for unresolved/high-entropy findings. Security review before real Git import beta. |
| $79/month may not map to agencies’ handoff frequency. | Low frequency reduces willingness to subscribe. | Interview 10 agencies and offer a 30-day Studio pilot; measure rooms created, client completion, support-hours baseline. Revisit price only with evidence. |
| Repository OAuth consent can be a blocker. | Least privilege may still look risky to clients. | Prototype M2 consent copy and explicit selected-repo screen; test with 5 leads. Keep a manual sanitized fixture upload only if it meets the same redaction and lifecycle rules. |
| Acknowledgement can be mistaken for legal sign-off. | Legal ambiguity harms both parties. | Have counsel review M3 acknowledgement language; test comprehension question with pilot reviewers; keep “not a contract” beside action and in export. |
| Reviewer emails may be blocked or a no-login link forwarded. | Access and accountability can fail. | M3 deliverability smoke plus token expiry/revocation tests; offer copyable secure link and optional email match check without blocking access unnecessarily. |
| AI reply drafting might send too much context or be unused. | It is optional and must earn privacy cost. | M3 feature flag pilot: record only opt-in aggregate usage and edit/save rate. Remove or keep behind BYOK if fewer than 20% of eligible pilots use it; never expand context automatically. |
| Service operations may be disproportionate for small agencies. | A broken export or deleted record destroys the promise. | M4 restore drill, job failure simulation, and 30-day operations review against error budget before growth work. |

## Delivery discipline

Every builder updates this plan’s milestone status only after the milestone handoff and PASS review. Claims are additive and must match user-facing copy exactly. Keep `/demo` available from a clean context throughout. No secrets, source control tokens, live fixture data, payment-provider credentials, or raw model keys may enter the repository, browser bundle, test artifacts, or logs.
