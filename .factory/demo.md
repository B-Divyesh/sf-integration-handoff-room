# Demo sandbox

## Entry points

- Production: `https://integration-handoff-room.sociobot.in/demo`
- Development: `http://localhost:5173/demo`
- Query entry: `/?demo=1` opens the same room directly.

## What is seeded

The room contains the fictional **Payment status release** for Northstar Market:

- One sanitized `POST /v1/payment-status` request and paid response.
- Two named decisions: client-facing status and a 30-second retry window.
- Three required review steps.
- A blank acknowledgement ready for a client reviewer name.

No source repository, client record, credential, live API request, or production account is involved.

## Storage and reset

The only browser storage key used by the demo is
`demo:integration-handoff-room:sample-v1`. It contains the sample checklist
state and, once recorded, the sample acknowledgement. The persistent banner's
**Reset demo** action replaces it with a fresh seed. Leaving the demo does not
copy any sample state into a real-data namespace.

## Verification

Each visitor-visible claim has a Playwright test from a fresh browser context:

```sh
npm run test:e2e -- --grep @claim:demo-sample-room
npm run test:e2e -- --grep @claim:demo-acknowledgement
npm run test:e2e -- --grep @claim:demo-handover-export
npm run test:e2e -- --grep @claim:demo-isolated
```

The isolation test records every page request and fails if any request leaves
the page origin. It also verifies that every local storage key begins with
`demo:` after a mutation and reset.
