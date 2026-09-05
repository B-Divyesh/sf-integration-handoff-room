# Integration Handoff Room

Integration Handoff Room gives small software agencies one client-ready place to review a sanitized API fixture, answer questions, and preserve a named acknowledgement.

The public `/demo` is an isolated sample. Signed-in agency members connect GitHub through a read-only GitHub App consent flow, select one permitted repository, import one JSON fixture, review automatic redaction, save a room, create a private client link, answer questions, and export the record. Client reviewers use a scoped private room link without an account or subscription. Studio is $79 USD per agency each month when Sociobot registration is available; its hosted checkout is shown only after the live product endpoint verifies registration.

The researched opportunity is in [.factory/brief.json](.factory/brief.json), the delivery plan is in [.factory/plan.md](.factory/plan.md), and the product-specific visual system is in [.factory/design.md](.factory/design.md).

## Who it is for

Small software agencies and fractional engineering teams handing API integrations to clients.

## Run locally

Prerequisites are Node.js 22+, npm, and the stable Rust toolchain.

```sh
npm ci
npm run build
STATIC_DIR="$PWD/dist" DATA_DIR="$(mktemp -d)" PORT=8080 npm run dev:api
```

Open `http://localhost:8080/demo` for the isolated sample. Open `/rooms` for the real workflow. Entra redirects back to `/auth/callback`; localhost and production callback URLs must be registered on the shared Sociobot SPA application.

The demo uses only `demo:integration-handoff-room:sample-v1` in local storage. Reset demo restores the bundled fictional payment-status room. See [.factory/demo.md](.factory/demo.md).

## Verify

```sh
npm run check
npm test
npm run test:e2e
npm run test:api
npm run build
npm run build:api
```

Every visitor-visible product promise is listed in [.factory/claims.json](.factory/claims.json) with its exact isolated test command. Playwright is pinned to 1.58.2.

## Runtime and deployment

The multi-stage `Dockerfile` builds Vite and the Rust service. The non-root container serves the site and API on `PORT` (default 8080), stores SQLite data under `/data`, and reports its build argument from `/health`. The service starts with only `PORT`; Entra tenant values use the shared Sociobot defaults and remain overrideable.

All routes except health checks have per-client token-bucket limits: reads are 20 requests per second with a burst of 40, and writes are 5 requests per second with a burst of 10. Rejected requests return 429 and `Retry-After: 1`. This in-memory limiter is correct for one replica; deployment must remain at one replica until the factory provides a shared limiter.

GitHub App OAuth is optional runtime configuration: set `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` after registering a GitHub App with read-only Contents permission and selected-repository installation. The service starts without them, but correctly refuses repository connection rather than falling back to public raw URLs. OAuth tokens are encrypted before storage with a generated `/data/github-token-key.bin` (or a 32-byte URL-safe-base64 `GITHUB_TOKEN_ENCRYPTION_KEY` override). Agency owners can disconnect GitHub or permanently delete the workspace at `/settings/data`.

The factory deploys the container. Do not run infrastructure, DNS, or billing-provider changes from this repository.

## Privacy and licensing

The sample sends no fixture or review data. Real rooms store only the sanitized fixture and room record. Microsoft Entra handles agency sign-in, and Sociobot hosts checkout. The project is released under the [MIT License](LICENSE).
