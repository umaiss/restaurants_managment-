# Code Summary — U4 `u4-bill-and-close`

## What was built

The table bill at `/staff/tables/:id` and the Close table action, with the server endpoints behind them.

## Files created

- `src/server/repositories/billingRepo.ts`: `buildBill`, `closeTable`, `BillingError`
- `src/server/routes/billing.ts`: `GET /api/tables/:id/bill`, `POST /api/tables/:id/close`
- `src/client/hooks/useBill.ts`
- `src/client/components/staff/money.ts`, `BillOrderCard.tsx`, `BillTotal.tsx`, `CloseTableSection.tsx`
- `src/client/screens/staff/TableBillScreen.tsx`
- Tests: `src/server/__tests__/{tableClose,billing,billing-api}.test.ts`, `src/client/components/__tests__/ConfirmModal.test.tsx`, `src/client/hooks/__tests__/useBill.test.ts`, `src/client/components/staff/__tests__/{BillOrderCard,BillTotal,CloseTableSection}.test.tsx`, `src/client/screens/staff/__tests__/TableBillScreen.test.tsx`
- Browser tests: `e2e/u4-bill-and-close/bill-and-close.spec.ts`, `e2e/u4-bill-and-close/mockup-match.spec.ts`

## Files changed

- `src/server/repositories/tableRepo.ts`: added `closeCurrentVisit`, `hasClosedVisit` (existing `closeVisit` untouched)
- `src/server/index.ts`: registers the billing router under `/api`
- `src/server/routes/orders.ts`: the `TODO(U4)` comment now says a closed table starts a new visit on its next order (no behaviour change)
- `src/client/components/ConfirmModal.tsx`: Escape closes, focus moves in and stays in, focus returns to the opener (additive)
- `src/client/views/StaffView.tsx`: the placeholder route is replaced by `TableBillScreen`

## Key decisions (as the approved plan set out)

- Close refusals: `CLOSE_BLOCKED` 422 (with `blocking_orders`), `TABLE_EMPTY` 422, `TABLE_ALREADY_CLOSED` 409, `UNKNOWN_TABLE` 404. A visit whose orders are all Cancelled can be closed.
- The bill of a table with no open visit is 200 with an empty list and `close_available: false`.
- The check and the close run in one immediate transaction.
- A non-numeric table id answers 404 `UNKNOWN_TABLE`.
- Small addition inside the plan's scope: each bill line carries an optional `image` (the menu item's emoji, read-only join on `items`) so the bill shows the emoji the S2 mockup shows. Prices still come from the stored order line.

## Tests

| File | Tests |
|---|---|
| `src/server/__tests__/tableClose.test.ts` | 7 |
| `src/server/__tests__/billing.test.ts` | 15 |
| `src/server/__tests__/billing-api.test.ts` | 9 |
| `src/client/components/__tests__/ConfirmModal.test.tsx` | 7 |
| `src/client/hooks/__tests__/useBill.test.ts` | 8 |
| `src/client/components/staff/__tests__/BillOrderCard.test.tsx` | 8 |
| `src/client/components/staff/__tests__/BillTotal.test.tsx` | 3 |
| `src/client/components/staff/__tests__/CloseTableSection.test.tsx` | 5 |
| `src/client/screens/staff/__tests__/TableBillScreen.test.tsx` | 15 |
| `e2e/u4-bill-and-close/bill-and-close.spec.ts` (Playwright) | 6 |
| `e2e/u4-bill-and-close/mockup-match.spec.ts` (Playwright) | 6 |

Whole suite through `aidlc engine swarm check`: converged (224 unit tests, all Playwright specs).

## Bugs found by the tests and fixed

None.

## Not run

- WebKit and installed Google Chrome checks and the whole-journey keyboard test belong to Build and Test; this Unit ran Chromium only.

## Review findings fixed

The architecture review of U4 came back READY with 1 Major and 3 Minor findings. All were handled in the Unit.

- **Major: flaky server tests.** Two earlier runs under heavy load failed one `billing-api.test.ts` test each (a 404, then a 422 where 200 was expected). The `place` and `transition` helpers never checked the HTTP status, so a failed placement or status change would go unnoticed and show up later as a wrong close answer. Also, `process.env.DB_FILE = ':memory:'` sat on the first line of each file, but imports are hoisted, so it was not guaranteed to run before the database modules loaded. Fixed in `billing-api.test.ts`, `billing.test.ts` and `tableClose.test.ts`:
  - the in-memory setting now runs in a `vi.hoisted` block, before any import;
  - the `place` and `transition` helpers (and the repo-level equivalents in the other two files) assert the 201 or 200 and the expected status and `order_number`, with the response in the failure message;
  - `resetDb()` and `seedIfEmpty()` already ran in `beforeEach`, and `billing-api.test.ts` (the only file that publishes) already called `_resetForTest()` there.
  - I did not catch the original failure again, so I can't prove which of the two weaknesses caused it. Both are now closed. The repeat run after the fix: the three server files ran 12 times in parallel with 4 full `vitest --coverage` runs going at the same time. All 12 runs of the three files passed (31 of 31 tests each) and all 4 full runs passed.
- **Minor: `useBill` missed changes around the event stream opening.** `useBill` now fetches the bill again each time the staff event stream turns connected (first open and every reconnect). It reacts to the change from not connected to connected only, so it cannot loop. New test: "fetches the bill again when the event stream connects, and again after each reconnect, but never in a loop" (`useBill.test.ts` now has 8 tests).
- **Minor: contract wording (bill line `image`, wording for an all-cancelled visit).** The coordinator aligns the contract; no behaviour change here.
- **Minor / other findings:** no other code changes were requested.

Second review (3 Minor findings):

- **Stale contract copy.** The worktree's `inception/contract-design/contract-summary.md` now has the same three Billing GET bullets as the main folder's copy (`close_available` with the all-Cancelled case, the optional `image` extension, the no-open-visit answer). Nothing else in that file changed. This path is a record file, not application source, so it is not in `source-manifest.json`.
- **`CLOSE_BLOCKED` test strengthened.** "CLOSE_BLOCKED shows its banner, fetches the bill again and shows the blocking order with Close table disabled" now makes the mocked bill gain a blocking order after the 422, and checks a second bill fetch, a disabled Close table button and the note "One or more orders still open: #20". The screen already refetched after `CLOSE_BLOCKED` (and `TABLE_EMPTY`), so `TableBillScreen.tsx` needed no fix for this point.
- **Focus after a failed close.** The error banner (`close-error-banner`) has `tabIndex={-1}` and takes focus when a close fails, so keyboard users land on the message while the Close table button is still disabled. New test: three cases (`CLOSE_BLOCKED`, `TABLE_EMPTY`, an internal error). `ConfirmModal` now skips restoring focus to an opener that is disabled by the time it closes; new test in `ConfirmModal.test.tsx`. Its other callers behave as before.

## Deviations from the plan

- The plan asks for 5 Playwright flows; there are 6 (Flow 5 was split into a live "closed from another session" flow and a "409 already closed" flow).
- `sensor-traceability` wrote `traceability.json` into the main folder's record; the filled copy is in this Unit's worktree record.
