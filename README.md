# Integration Handoff Room

Integration Handoff Room gives small software agencies one client-ready place to review a sanitized API fixture, answer questions, and preserve a named acknowledgement.

The public `/demo` is an isolated sample. Signed-in agency members can import one public GitHub JSON fixture, review automatic redaction, save a room, create a private client link, answer questions, and export the record. Client reviewers can ask questions and acknowledge one room revision without an account. Studio costs $79 USD per agency each month through Sociobot hosted checkout.

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

All routes except health checks have per-client token-bucket limits. The configured three-replica service stays below 20 reads per second with a burst of 40. Writes stay below 5 per second with a burst of 10. Rejected requests return 429 and `Retry-After: 1`.

The factory deploys the container. Do not run infrastructure, DNS, or billing-provider changes from this repository.

## Privacy and licensing

The sample sends no fixture or review data. Real rooms store only the sanitized fixture and room record. Microsoft Entra handles agency sign-in, and Sociobot hosts checkout. The project is released under the [MIT License](LICENSE).
