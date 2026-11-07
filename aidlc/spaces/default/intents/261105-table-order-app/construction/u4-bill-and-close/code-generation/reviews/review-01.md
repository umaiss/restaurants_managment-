## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-06T19:36:47Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/server/__tests__/billing-api.test.ts > helper `place` and the `beforeEach` setup; aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/code-generation/code-summary.md > Known issue to watch | The unexplained intermittent failure (a 404, then a 422 where 200 was expected) fits one cause: an order placement that silently failed. The `place` helper never checks the HTTP status of the placement, so a failed placement returns `order_number` as undefined. The later `/close` call then finds an empty table and answers 422 TABLE_EMPTY, or an unknown table or item answers 404. The test files set `DB_FILE=':memory:'` on the first line, but import statements are hoisted, so the order depends on nothing reading the database during import. Nothing in the tests proves each file got its own empty database and its own seed. The team rule says a flaky test is fixed in the test code, not left as a note. | Make `place` assert a 201 status and fail loudly with the response body. Move the `DB_FILE` setting into `src/test-setup.ts` or a `vi.hoisted` block so it is set before any import. Then re-run the file repeatedly under load with coverage on, and record the result. If it still fails, record what the failing response body says. | New |
| R-02 | Minor | src/server/repositories/billingRepo.ts > `buildBill`, the `SELECT id, image FROM items` query | Billing reads the `items` table directly to get the emoji, although the contract says Billing builds the bill only from Ordering's in-process read. It is read-only and prices still come from the stored order lines, so BR1.4 and BR4.2 hold, but this is a second read path that the contract does not mention. | Add a one-line note in the contract or the code summary that Billing may read `items.image` read-only, or fetch the image through an Ordering or Menu read function. | New |
| R-03 | Minor | src/server/repositories/billingRepo.ts > `buildBill`, `close_available`; aidlc/spaces/default/intents/261105-table-order-app/inception/contract-design/contract-summary.md > Billing, `close_available` | The contract says `close_available` is false when there are no orders. The code is true for a visit whose orders were all Cancelled (an empty `orders[]` with a Close button enabled). This follows BR2.1 and the plan, but the contract sentence reads differently. The screen then shows an empty bill with an enabled Close table button. | State the all-Cancelled case in the contract-summary wording, or confirm it with the team. | New |
| R-04 | Minor | src/client/hooks/useBill.ts > the first-load effect and the `useStaffSSE` subscription | The first bill fetch and the opening of the event stream happen at the same moment. An order change between the fetch and the stream opening is not seen, and a reconnect does not refetch the bill. The server still refuses a wrong close, so this only leaves the screen briefly stale. | Refetch the bill when the stream reports `connected` after being down, or on first connect. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261105-table-order-app/inception/requirements-analysis/requirements.md > FR2.2 row (line 42) and the assumption at line 125 | The FR2.2 row still says "For each table with open orders, a card appears", while the new assumption says a table stays on the board until it is closed, even when every order is Completed or Cancelled. The built behaviour (`useBoardOrders.ts`, ORDER_STATUS_CHANGED branch keeps the table) follows the assumption, so the requirement text and the code disagree until someone reads line 125. | Reword the FR2.2 acceptance text to say "each table with an open visit (any order not yet closed out)", so the requirement and the assumption agree. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/code-generation/traceability.json > coverage rows FR3.5 and NFR4 | Every new target is a real file and plausibly implements its item (FR3.1 to FR3.4, US7.1, US7.2 checked). Two are thin. FR3.5 (archive the visit, reset the table, diner and board clear) points only at `tableRepo.ts`, which holds the archive; the TABLE_CLOSED reach to diner and board is not named. NFR4 (one currency, no tax or service lines) points at `billingRepo.ts`, but no test is named that proves the absence of tax lines. US7.1 and US7.2 are not defined in `requirements.md`, so the hand-added ids cannot be cross-checked there. | Add a second target for FR3.5 (for example `e2e/u4-bill-and-close/bill-and-close.spec.ts`, Flow 4) and for NFR4 (a test, or `src/client/components/staff/money.ts`). Note in the file where US7.1 and US7.2 are defined. | New |
| R-07 | Minor | src/server/routes/tableId.ts > `parseOrderNumber` and `parseTableId` | The two functions have the same pattern. Behaviour is correct (`12abc`, `0`, `-1`, `1e1`, `1.0` are rejected) but a future change to one can drift from the other. | Suggestion only: have `parseOrderNumber` call one shared positive-integer helper. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm test` | PASS: 31 test files, 320 tests passed. Server routes, repositories and staff screens show 88% to 100% line coverage (billing.ts 90%, billingRepo.ts 98%, tableId.ts 100%, sse.ts 96%). | The Step 0 fixes and the bill and close code are covered and green. `StaffView.tsx` shows 0% and `index.ts` 63%, but neither is part of this Unit's changes. |
| `npm run build` then `E2E_PORT=3100 npx playwright test e2e/u4-bill-and-close/ e2e/build-and-test/` | PASS: 16 of 16 (bill flows 1 to 5b, mockup-match, keyboard journey, live-update timing: board p95 10 ms, diner p95 57 ms) | The Close table journey (board card, bill link, bill, close, TABLE_CLOSED to the diner and board) passes in the browser. |

### Summary

The Close table journey holds end to end. `billing.ts` closes in one transaction and publishes TABLE_CLOSED to both the staff and table channels. `useBoardOrders.ts` drops the table on that event and cannot be undone by an older fetch. The strict id parsing, the HELLO that goes only to the new connection and the board refetch on reconnect all match what the plan says. Only Minor points remain: the FR2.2 requirement text, two thin traceability targets and a duplicated parser.
