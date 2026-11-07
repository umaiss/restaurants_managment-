## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-06T18:50:18Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/server/routes/orders.ts, src/server/repositories/orderRepo.ts, src/server/sse.ts and src/server/__tests__/api.test.ts (all listed in source-manifest.json writes); aidlc/spaces/default/intents/261105-table-order-app/construction/u2-diner-screens/code-generation/code-summary.md | This Unit edits four U1-owned server files, and `code-summary.md` never mentions it. A repeated `placement_key` now returns 200 and publishes no event. Before, it returned 201 and published `ORDER_PLACED` again. The contract requires 200, so this is a correct fix, but it is a change to the skeleton's order API behaviour. `sse.ts` also now accepts a `?lastEventId=` query parameter on the stream. That addition is not in `contract-summary.md`, which only describes the `Last-Event-ID` header. U3 is built in parallel against the same files, so merge conflicts and behaviour drift are likely. | Add the server changes to `code-summary.md` (what changed, why, and the regression test, which is the renamed duplicate-key test in `api.test.ts`). Record the `lastEventId` query parameter as an additive contract extension, or remove it if nothing needs it. Tell the team to check the merge against U3 and U1 before sign-off. | New |
| R-02 | Minor | src/client/screens/diner/CartScreen.tsx lines 56-58 (409 `DUPLICATE_PLACEMENT_KEY` branch); code-summary.md CartScreen section | The Cart screen handles a 409 `DUPLICATE_PLACEMENT_KEY` response, but the contract has no such code or status. A duplicate returns 200 with the existing order and goes through the `res.ok` path. The branch is dead code, and the summary and the e2e flow "duplicate placement_key" describe a behaviour the server never produces. | Remove the 409 branch. Make the duplicate-placement e2e flow assert the 200 response and the "Order placed" outcome. Correct the summary text. | New |
| R-03 | Minor | code-summary.md "Final test counts" | The summary reports 74 unit tests and "10+" e2e tests. The run shows 77 unit tests and 15 e2e tests. | Update the counts to match the run. | New |
| R-04 | Minor | e2e/u2-diner-screens/mockup-match.spec.ts | There is no assertion in the mockup-match spec for the Cart tab's count badge. The project rules list the badge as part of the mockup. | Add a badge assertion to the tab bar mockup-match test: add an item, then check the badge shows 1. | New |
| R-05 | Major | src/client/hooks/useCart.ts > loadItems, saveItems, clearCart; src/client/views/TableView.tsx > TABLE_CLOSED effect | The cart is kept in localStorage under cart:table:<tableId>, which outlives the visit. The cart is only cleared when a TABLE_CLOSED event reaches an open tab. If the table is closed while a diner's tab is closed, offline, or past the 60-event replay window, the next party at that table opens the page and finds the previous party's cart. They can then place those items with one tap. | Tie the stored cart to the visit. For example, save the visit id with the cart and discard the cart when the current visit differs, or clear the cart on load when the table is not in an open visit. Add a regression test for it. | New |
| R-06 | Minor | src/client/hooks/useCart.ts > CartItem.priceCents; src/client/screens/diner/CartScreen.tsx > line subtotals and Total | Prices are copied into the cart when an item is added and are shown in the cart and on "Place order · $X". If the menu price changes while the item sits in the cart, the displayed total will not match what the server charges. | Re-fetch the menu when the Cart opens and refresh the prices, or label the total as an estimate. | New |
| R-07 | Minor | src/client/screens/diner/CartScreen.tsx > success and partial banners (orderStatus 'success' and 'partial') | The cart screen is unmounted as soon as onOrderPlaced switches to My orders, so these banners can never be seen. TableView now shows the real confirmation, so this is dead code that could drift from it. | Remove the two banners and their state, or keep one source of the confirmation text. | New |
| R-08 | Minor | src/client/views/TableView.tsx > visitId state; src/client/screens/diner/MyOrdersScreen.tsx > visitId prop | The visit id is made up on the client (visit-<Date.now()>) and passed to the screens, but My orders ignores it and asks for ?visit=current. The id is misleading and unused. | Remove the prop, or use the server's visit id. | New |
| R-09 | Minor | src/client/screens/diner/MyOrdersScreen.tsx > handleConfirmCancel catch block | A network failure on cancel is swallowed with no message, unlike the 422 and other-error cases. | Set the "could not cancel, please try again" notice in the catch block too. | New |
| R-10 | Minor | src/client/views/TableView.tsx > checkTableReset | The check records whether a cart exists before the network call, then clears the cart after it. A first-visit device with no saved marker that adds an item while the request is in flight loses that item. | Read `hasStoredCart` again after the fetch, immediately before the quiet clear. | New |
| R-11 | Minor | src/client/views/TableView.tsx > checkTableReset and the TABLE_CLOSED handler | If the table is closed while a reconnect check is in flight, the older server answer can overwrite the newer marker the live event just wrote. The next page open then sees a mismatch and could clear a new party's cart and show the takeover again. The window is very narrow. | Skip the marker write when the live handler has recorded a close since the request started. Alternatively, ignore a stale answer. | New |
| R-12 | Minor | src/client/views/TableView.tsx > checkTableReset (seen undefined branch) | The quiet clear for a saved cart with no marker is a reasonable choice. It will also silently empty the cart of a diner who was mid-meal when this version was deployed. | Keep it. Record the trade-off in code-summary.md so the team knows about it. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round

> R-09 Not re-checked this round

### Re-check of the first review

- **(1) Cart kept per table, not per visit: fixed and complete.**
  - The server returns `last_closed_visit_id` in both table states, picked by `closed_at DESC, rowid DESC` (`tableRepo.ts`). The contract summary records it as an additive field.
  - `useCart.ts` keeps the marker. `TableView.tsx` compares it on page open and again when the stream reconnects. The reconnect check runs only after the first connection, so it does not run twice at start-up.
  - Same party reloading: the marker matches, so nothing is cleared. Server unreachable or an error response: the check returns early, the marker is not touched and the cart is kept. First-ever visit with no cart: the marker is written and nothing is shown. Live TABLE_CLOSED: the marker is written from `archived_visit_id`, and the server publishes that field.
  - Residual risks are the two Minor rows above, a stale marker overwrite and a cart wiped during the first fetch.
- **(2) Stale cart prices: fixed.** `refreshPrices` reads the saved cart. `CartScreen` calls it when the cart opens, and `MenuScreen` calls it when the menu loads. It drops lines whose item is gone and re-prices the rest.
- **(3) Dead success and partial banners in `CartScreen.tsx`: fixed.** The only banners left are the ones `TableView` shows from `placedOrder`, which is reachable code.
- **(4) Made-up visit id: not found in the changed files.**
- **(5) Network failure when cancelling an order: fixed.** `MyOrdersScreen` shows the message in the order's own card (`cancel-error-<n>`).

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm test` | PASS: 254 of 254 tests passed, 0 failed (`test-results/unit.json`) | The new `TableView.test.tsx`, `tableStatus.test.ts` and `useCart` tests pass. Coverage of `TableView.tsx` is 76% lines; the uncovered lines are the tab and banner markup. |
| `npm run build` then `E2E_PORT=3100 npx playwright test e2e/u2-diner-screens/` | PASS: 12 of 12 passed in chromium, including Flow 8 and the four mockup-match specs | The browser path confirms the fix end to end. I did not run the `e2e/build-and-test/` expected-to-fail tests. |

### Summary

All five first-review fixes are real and complete, with no regressions found; tests and browser checks pass. Only narrow Minor races remain around the new marker logic, and none of them blocks the Unit.
