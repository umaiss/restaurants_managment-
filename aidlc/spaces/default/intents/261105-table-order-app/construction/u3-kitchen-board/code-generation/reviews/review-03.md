## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-06T19:04:17Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | e2e/u3-kitchen-board/mockup-match.spec.ts (whole file) | The mockup match does not compare the screens to the refined mockups. It saves only the app screenshots and never loads or saves the mockup beside them, which the project rule asks for. It checks only a few status words and buttons. Its first test is titled "★ New highlight" but never asserts the highlight (a code comment admits this). No test covers the mockup's Completed card, the Cancel confirmation, the empty state or the reconnect banner. | Load the refined mockup for each screen the Unit builds (`inception/refined-mockups/preview.html` or `mockups.md`) and save it beside the app screenshot in `test-results/mockup-match/u3-kitchen-board/`. Assert the mockup's headings, labels, buttons, messages and status words, including the ★ New label (set up through a live ORDER_PLACED event), a Completed card, the empty state, the Cancel modal and the reconnect banner. List anything that is left out because U4 owns it. | New |
| R-02 | Major | playwright.config.ts (E2E_PORT and DB_FILE defaults, new `chrome` and `webkit` projects); package.json (`test:e2e` script); e2e/u1-walking-skeleton/mockup-match.spec.ts | The Unit rewrites files that every Bolt shares. It changes the default `E2E_PORT` from 3100 to 5100 and the default `DB_FILE` from `:memory:` to `e2e-u3.db`. It also adds browser projects and changes the `test:e2e` script. U2 (running in parallel) edits the same lines, so the merge will conflict, and the merged config would carry U3's port and database as defaults. It also drops a U1 assertion that U3 itself invalidated. Each Bolt's port and database are meant to come from the environment (`E2E_PORT`, `DB_FILE`), not from edited defaults. | Keep the shared defaults as in U1 (3100 and `:memory:`, or a neutral value) and give this Bolt's port 5100 and database file only through environment variables when the Bolt runs its tests. Check that the `chrome` and `webkit` projects and the script change are wanted. Drop them from this Unit if Build and Test owns them, or make them one deliberate merge-safe change. Record the U1 spec edit as an intentional cross-Unit change in the code summary. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261105-table-order-app/construction/u3-kitchen-board/code-generation/code-summary.md > What was built; Tests; Bugs found by the tests and fixed | The summary no longer matches the code. It omits the Cancel button and its confirmation, and the reconnect banner, which exist in `OrderCard.tsx` and `KitchenBoardScreen.tsx`. It describes the availability panel as checkboxes, but the code uses `role="switch"`. The Flow 5 "fix" it describes (`isChecked` plus a 500 ms wait) is not what the spec does. The test counts are off: the OrderCard suite alone has about 14 tests, not 7. The three bugs listed have no "regression: …" test, as the project rule asks. | Update the summary to describe the shipped behaviour and the real counts. For each bug, either name its "regression: …" test or say why a test-only bug needs none. | New |
| R-04 | Minor | e2e/u3-kitchen-board/kitchen-board.spec.ts > Flow 5 | Flow 5 checks only that `aria-checked` flips after the click, which is the optimistic UI state. It never checks that the server stored the change or that `GET /api/menu` reflects it. It leaves i-01 unavailable for later tests, and they have to reset it first. | Assert the persisted state with `GET /api/menu` (or `MENU_AVAILABILITY_CHANGED`), and restore the item at the end of the test. | New |
| R-05 | Minor | playwright.config.ts > webServer command | A file-based `DB_FILE=e2e-u3.db` replaces the in-memory database. With `reuseExistingServer` on, data carries over between runs. The tests pass today only because they use fresh placement keys and read their own order numbers. | Delete the database file before each run, or go back to `:memory:` for tests. Keep the file name per Bolt through `DB_FILE`. | New |
| R-06 | Minor | src/client/hooks/useBoardOrders.ts > initial fetch merge and SSE handlers | Because a table now leaves the board only on a TABLE_CLOSED event, a missed TABLE_CLOSED (stream gap longer than the 60-event replay buffer, or a server restart that empties the buffer) leaves a stale card on the board until the page is reloaded. The same applies if TABLE_CLOSED arrives before the initial fetch resolves, because the fetch result then adds the table back. The board does not refetch after the stream reconnects. | Refetch the board's tables when the staff stream reconnects, or record this as a known limit in code-summary.md. | New |
| R-07 | Minor | src/server/routes/billing.ts > unknownTable and parseTableId | The billing routes keep their own copy of the 404 helper rather than using the new shared src/server/routes/tableId.ts. The digits-only rule is applied on every route that reads a table id (orders, tables, bill, close, stream). The menu availability route's `:id` is a menu item id and is correctly not covered. The two copies could drift apart. | Import parseTableId and unknownTable from tableId.ts in billing.ts. | New |
| R-08 | Minor | src/server/routes/orders.ts > POST /orders/:order_number/transition | `parseInt(req.params.order_number, 10)` still reads "12abc" as order 12. This is the same trailing-text problem fixed for table ids, on an order id. | Apply the same digits-only check to the order number, or note it as out of scope. | New |
| R-09 | Minor | src/server/routes/sse.ts > GET /tables/:id | The `_lastEventId` variable and the "TODO: replay" comment are stale, because replay is already done inside subscribe(). The replay filter compares numeric ids with `e.id > lastId`. This is sound across a restart, since ids now start at Date.now(). Each new connection also publishes a HELLO to every existing subscriber of that channel. | Remove the dead variable and TODO. Optionally send HELLO to the new subscriber only. | New |
| R-10 | Minor | src/client/screens/staff/KitchenBoardScreen.tsx > TableSection | When a table has an open order, its cancelled orders are hidden. When nothing is open, all orders show, including cancelled ones. The code, the "No open orders. Open the bill to close this table." message and the tests agree. The FR2.2 re-reading ("a card per table with an open visit") is recorded only in code-summary.md. | Add the FR2.2 re-reading as a note in requirements or functional-spec so the next reader of the spec sees it. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| npm test | PASS: 30 test files, 298 tests passed. Coverage shows tableId.ts at 100%, sse.ts at 96%, and the staff screens at 97-98%. | Includes the three new regression tests (board with only completed orders, trailing-text table id, and the earlier cart ones). |
| Browser tests (npm run build, then playwright) | Not run in this pass, to keep to the turn budget. | The person should weigh this. The code-summary reports the two build-and-test specs as passing. |

### Summary

The Step 17a fix is sound. A table stays on the board while its current visit has any order and leaves only on TABLE_CLOSED. The keep-alive timer starts with the first subscriber, stops with the last, is unref'd, and drops subscribers whose write throws. The digits-only table id is applied on every table-id route. The remaining concerns are Minor. The main one is that the board relies on events alone to remove a closed table, so a missed TABLE_CLOSED leaves a stale card until reload.
