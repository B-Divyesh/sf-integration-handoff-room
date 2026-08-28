# Independent verification handoff — FAIL

Date: 2026-08-28 UTC

Work order: `integration-handoff-room-verify-1`

Tested commit: `4abd41aee397f4bd7b6c34c553481bb5acf7f193`

Tested URL: `https://integration-handoff-room.sociobot.in`
Decision: **FAIL — release blocked.**

The live deployment is this candidate: `/health` reports the exact SHA and the
deployed HTML, JavaScript, and CSS hashes match the local production build.
This is not a deployment-only failure.

## Blocking defects

1. **Critical — incomplete product:** only the isolated sample exists. There is
   no Git connection, real room creation/persistence, client sharing,
   automatic redaction, questions, real acknowledgement, account, or
   subscription. **Start for real** says those rooms are future work.
2. **High — no server rate limit:** 300 requests at concurrency 60 all returned
   200 in 1.09 seconds (about 300 requests/second). The documented 20
   requests/second, burst-40 allowance produced no 429 or `Retry-After`.
3. **High — claims contract fails:** live privacy, no-request, no-third-party,
   and sanitization statements are not exact claims in `.factory/claims.json`;
   the existing isolation test would allow same-origin API traffic.
4. **High — accessibility:** Axe serious failures for day-chart contrast
   (4.36:1) and the mobile scrollable payload; many mobile links/buttons are
   below 44 px touch height.
5. **Medium — container contract:** Dockerfile pins
   `rust:1.88-slim-bookworm`, which the supplied backend contract forbids.
6. **Medium — routing:** unknown routes render the designed page with HTTP 200
   instead of 404.
7. **Medium — first screen:** at 390 x 844 the required three factual lines
   start below the first viewport.
8. **Low — delivery details:** hashed assets have no Cache-Control/ETag and
   unstable Last-Modified values across replicas; the footer says `build dev`.

## Evidence that passed

- Cold first read clearly states what the sample does, who it is for, and what
  to click; **Try it with sample data** opens `/demo` in one click.
- After `npm ci`, all four exact claim commands pass independently.
- `npm run check`, `npm test` (8), `npm run test:e2e` (9),
  `npm run test:api` (2), `npm run build`, and `npm run build:api` pass.
- The sample's normal, whitespace-error, 80-character boundary, export, reset,
  and corrupt-storage recovery paths work.
- Live sample traffic is same-origin only; no console/page errors occurred.
- Security headers are present. Reduced motion, keyboard order/focus, semantic
  landmarks, one h1, and 390 px no-overflow checks pass apart from the listed
  accessibility defects.
- Bundle: 7.57 KB gzip JS and 4.16 KB gzip CSS.
- Lighthouse landing: 100/100/100/100; LCP 1.2 s, CLS 0, TBT 0 ms.

Full commands, observations, severities, and applicability notes are in
`.factory/verification.md`. No product code was modified during verification.
