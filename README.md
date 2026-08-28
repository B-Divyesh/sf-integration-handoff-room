# Integration Handoff Room

Integration Handoff Room gives small software agencies one client-ready place to review a safe API example, record decisions and ownership, and preserve a named handover acknowledgement. It is planned as a web application with a Rust API; the current repository is the buildable product scaffold for M1, not the product itself.

The product plan is in [.factory/plan.md](.factory/plan.md), the researched opportunity is in [.factory/brief.json](.factory/brief.json), and the orbital protocol atlas design system is in [.factory/design.md](.factory/design.md).

## Who it is for

Small software agencies and fractional engineering teams that hand API integrations to clients. Client reviewers get a focused review space instead of a pile of docs, collection links, and follow-up email.

## Development

Prerequisites: Node.js 22+, npm, and the Rust stable toolchain.

```sh
npm install
npm run dev                 # web shell at http://localhost:5173
npm run dev:api             # API shell at http://localhost:8080
npm run check
npm test
npm run build               # creates dist/
npm run test:api
npm run build:api
```

`npm run test:e2e` begins with a browser smoke test. M1 must add the exact claim tags recorded in `.factory/claims.json`; the shell smoke test is not a substitute for that claim suite.

## Deployment

The factory deploys the static web build and the API container. The API starts with no required variables and honors `PORT` (default `8080`); `BUILD_SHA` is optional. The `Dockerfile` accepts the factory build arguments `BUILD_SHA`, `GIT_SHA`, and `SOURCE_COMMIT` without relying on `.git`.

Production configuration, Entra callback registration, GitHub OAuth credentials, database/storage, and the Sociobot/Dodo Studio subscription registration are operator-managed and must never be committed. See the M2 plan and handoff requirements before deployment.

## Privacy and licensing

The planned product does not use third-party analytics, CDNs, or embedded payment providers. It will never store live API secrets and will make export/delete controls available to agency admins. The project is released under the [MIT License](LICENSE).
