# Integration Test Instructions — Table Order Web App

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`; test strategy Standard
- Contract tests named in `inception/contract-design/contract-summary.md`

## What is covered

| Boundary | Where it is tested | Real browser? |
|---|---|---|
| Server routes against a real in-memory SQLite database: menu, orders, transitions, bill, close | `src/server/__tests__/*.test.ts` (supertest, Node) | No: Node |
| Live updates: `/sse/staff` and `/sse/tables/:id` events and replay | `src/server/__tests__/sse.test.ts`, `e2e/u1-walking-skeleton/skeleton.spec.ts` | Node and Chromium |
| Diner screens against the server | `e2e/u2-diner-screens/diner.spec.ts` | Chromium, Chrome, WebKit |
| Kitchen Board against the server | `e2e/u3-kitchen-board/kitchen-board.spec.ts` | Chromium, Chrome, WebKit |
| Table bill and Close table, including the diner takeover | `e2e/u4-bill-and-close/bill-and-close.spec.ts` | Chromium, Chrome, WebKit |
| The whole journey by keyboard only (NFR6) | `e2e/build-and-test/keyboard-journey.spec.ts` | Chromium, Chrome, WebKit |
| Board to bill link for a table with only completed orders | `e2e/build-and-test/board-bill-link.spec.ts` | Chromium, Chrome, WebKit |
| Live-update timing, NFR1 and NFR2 (p95) | `e2e/build-and-test/live-update-timing.spec.ts` | Chromium |

## Commands

```bash
npm run build
npm test                                                           # unit, component and server tests, with coverage
npm run test:e2e                                                   # every browser spec in Chromium
npx playwright test --config playwright.cross-browser.config.ts --project=chrome
npx playwright test --config playwright.cross-browser.config.ts --project=webkit
```

Run the Chrome and WebKit projects one at a time: both start their own fresh in-memory server, so a second browser never sees the first one's orders. The cross-browser config leaves the `mockup-match` specs out because they save the screenshots the team looks at (taken in Chromium).

## Test data

- Each spec places its own orders through the API with its own `placement_key`.
- Tables in use: 1–3 (Kitchen Board), 4 (board-to-bill regression), 5 (diner and skeleton), 6 (keyboard journey and timing), 7–10 (bill and close). The Build and Test specs put their table back in `finally` / `afterEach` (`e2e/build-and-test/helpers.ts`).

## Expected results

Every spec passes in every browser. Timing: p95 of the board latency and of the diner latency, each at most 2000 ms.
