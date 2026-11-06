## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-06T18:23:10Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | `src/server/routes/orders.ts`:122 and `src/server/__tests__/api.test.ts`:69 | The transition endpoint reads `{ to, by }` from the request body, but the plan (Step 9 and Step 10 test descriptions) names the field `status`. The implementation and tests are mutually consistent so the endpoint works correctly, but the field name `to` diverges from the plan's stated contract `{ status, by }`. Later Units that build on this endpoint need to know the actual field name is `to`. | Confirm `to` is the intended field name and update the plan's Step 9 and Step 10 descriptions to match, so U2–U4 builders use the correct request shape. No code change required unless the contract review named `status` as the canonical field. | New |
| R-02 | Minor | `src/server/index.ts`:51 | The port selection expression is `process.env.PORT ?? process.env.E2E_PORT ?? '3000'`. When the Playwright web server starts the app it passes `E2E_PORT` but not `PORT`. If the developer's shell has `PORT` set globally (e.g. a system default of 80), the server will bind to that port instead of `E2E_PORT`, causing the Playwright `webServer.url` check to fail. | Add a note to `.env.example` or a code comment that `PORT` takes precedence over `E2E_PORT`; for the E2E case consider using `E2E_PORT` directly when it is set, or documenting that `PORT` must be unset when running E2E tests. | New |
| R-03 | Minor | src/server/sse.ts > subscribe / publish | The live-update stream sends no periodic keep-alive comment. A quiet channel such as a table's own stream can be dropped by an idle proxy or browser timeout with no early warning. The reconnect and replay path exists, but nothing prompts it before the drop. | Add a timer that writes a comment line (for example `: ping`) to every subscriber every 15 to 30 seconds, and stop it on close. | New |
| R-04 | Minor | src/server/sse.ts > eventCounter and ring buffers | Event ids and the replay buffers live only in memory and restart from 1 after a server restart. A client that reconnects with a pre-restart `Last-Event-ID` (say 80) will skip every new event with a lower id and will not be told that it missed anything. The agreed behaviour is that a client with no id reconciles over HTTP, but nothing covers a stale id. | Either seed the counter from the clock or a stored value so ids never go backwards, or send a resync event when the requested id is higher than the newest buffered id. Record the choice in the contract. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261105-table-order-app/construction/u1-walking-skeleton/code-generation/code-generation-plan.md > Steps 1, 10, 12, 13 | Four steps still show unchecked boxes ("awaiting Playwright install permission") and the plan text says the transition body uses `status`, while the code and contract use `to`. I did not rerun the browser tests, so the plan alone does not show that U1's Playwright specs passed. | Tick the steps once the browser tests have been run, and correct the plan prose to say `to`. Rely on the Build and Test run for the browser evidence. | New |
| R-06 | Minor | src/server/routes/orders.ts > POST /tables/:id/orders | `parseInt` on the table id accepts values such as `5abc` as table 5. An unknown id gets 404, but a malformed id is treated as a real table. | Reject ids that are not plain whole numbers with a 400 `INVALID_REQUEST`. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm test` (run from project main folder) | PASS: 28 test files, 228 tests passed. Server files show 91% line coverage overall; `routes/sse.ts` is at 48%, `routes/orders.ts` at 71% and `index.ts` at 63%. | The suite is green. It covers the merged app, so U1's share is only part of it. The thin route coverage is the skeleton's stream and error branches and is not blocking. |

### Summary

U1 holds up as a shared base. The schema enforces the idempotency key and the order number. Transitions follow the contract's actor rules, including the diner being unable to cancel a Preparing order. Order and status events go to both channels. No critical or major issues were found; the four minor items are stream robustness after a quiet period or restart, plan bookkeeping, and input strictness on the table id.
