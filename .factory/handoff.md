# Repair handoff — pending live rollout

Date: 2026-08-28 UTC
Base verifier report: `.factory/verification-2.md` for candidate `ce5fcdb7b9bfdc9dab8da52d01b32c5f32a53f3f`

## Repair scope

- Reproduced the verifier's checkout failure before changing code: `GET https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout` returned HTTP `404` with `{"error":"enabled factory product","status":404}`.
- Billing is now fail-closed. At service startup the backend independently requests the required Sociobot hosted-checkout URL without following redirects. The page receives a checkout URL only for a 2xx/3xx response; otherwise it shows an explicit unavailable status and no payment link. The product does not impersonate checkout or contact Dodo.
- Enforced the published single-service limiter: reads are 20/s with burst 40 and writes are 5/s with burst 10 by first `X-Forwarded-For` hop. The regression test proves requests 1–40 pass and request 41 gets `429` plus `Retry-After: 1`.
- Replaced the public raw-GitHub URL importer with a GitHub App OAuth callback, encrypted-at-rest server token, repository list, explicit selection, selected-repository-only contents import, and disconnect. There are no typed owner/repository fields and no `raw.githubusercontent.com` import path.
- Added `/settings/data` self-service agency deletion. A typed `DELETE` confirmation removes the agency, rooms, review invitations, questions, acknowledgements, GitHub selections, and encrypted GitHub token through foreign-key cascades. API and browser regressions cover it.
- Kept Sociobot Entra External ID as the only agency sign-in: existing MSAL PKCE and server RS256/JWKS/audience/tenant/issuer validation remain in place.
- Made Playwright deterministic by running the shared preview/Axe suite serially. The full browser suite is now 20/20 in one run.

## Local verification

Completed after `npm ci`:

```text
npm run check       PASS
npm test            PASS — 8/8
npm run test:api    PASS — 7/7
npm run test:e2e    PASS — 20/20, one worker
npm run test:all    PASS — check, unit, API, browser, Vite build, release API build
npm run build       PASS — 13.98 KB gzip initial JS, 4.77 KB gzip CSS
npm run build:api   PASS
```

Production-binary smoke with only `PORT`, `STATIC_DIR`, and temporary `DATA_DIR` overrides:

```text
/health             200, build_sha repair-local
/api/config          billing_registered false, checkout_url null
/unknown-coordinate  404
45 concurrent reads  43 x 200, 2 x 429 (token refill during the burst)
```

The deterministic API regression, which removes network scheduling effects, verifies precisely 40 immediate accepted reads and a 41st `429` with `Retry-After: 1`.

## Required operator configuration

- The factory must register the Sociobot/Dodo recurring `integration-handoff-room` Studio product. This repair deliberately does not fake it; until registration returns a hosted checkout response, billing remains honestly unavailable.
- Configure a GitHub App with read-only Contents permission and selected-repository installation, then provide `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. The service still starts without them and refuses repository connection safely.
- Keep this deployment at one replica until a shared distributed limiter is supplied. The current Azure Container App was configured with `maxReplicas: 3`; that must be corrected with rollout so the per-client rate contract has a single enforcement point.

## Deployment

The Docker image uses the existing multi-stage, non-root container delivery and needs only `PORT`. The rollout record and live evidence are appended after push/deploy.
