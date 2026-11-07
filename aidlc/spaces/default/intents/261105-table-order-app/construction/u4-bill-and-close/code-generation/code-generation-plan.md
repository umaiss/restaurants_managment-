# Code Generation Plan — U4 `u4-bill-and-close`

## Summary

- Builds: the table bill at `/staff/tables/:id` (every order with items, prices, subtotals and one combined total) and the Close table action that archives the visit and resets every diner device
- Touches: `src/server/routes/billing.ts`, `src/server/repositories/billingRepo.ts`, `src/server/repositories/tableRepo.ts`, `src/server/index.ts`, `src/client/screens/staff/TableBillScreen.tsx`, `src/client/components/staff/` (bill parts), `src/client/hooks/useBill.ts`, `src/client/components/ConfirmModal.tsx`, `src/client/views/StaffView.tsx`, `e2e/u4-bill-and-close/`
- Tests: ~50 unit, component and API tests (vitest, React Testing Library, supertest) + 5 Playwright flows + 1 mockup-match spec

## Choices this plan makes (listed so the team can turn any of them back)

- **When Close table is refused.** A table with no open visit that has been closed before answers `TABLE_ALREADY_CLOSED` (409). A table with no orders (never used, or an open visit with no order in it) answers `TABLE_EMPTY` (422). A visit whose orders were all cancelled counts as having orders, so it can be closed; otherwise it could never be closed. [BR2.1] Any Pending or Preparing order answers `CLOSE_BLOCKED` (422) with the open order numbers. [BR2.3, BR2.4]
- **Bill for a table with no open visit.** `GET /api/tables/:id/bill` answers 200 with an empty `orders` list, a combined total of 0 and `close_available: false`; only an unknown table answers `UNKNOWN_TABLE` (404). [BR2.1]
- **A new order after a close.** The `TODO(U4)` in `src/server/routes/orders.ts` is resolved by leaving order placement as it is: the table "resets" on close, so the next order at that table opens a new visit. The comment is rewritten to say so. The `TABLE_CLOSED` error code in the contract stays unused by order placement. [FR3.5]
- **New close function.** `Tables` gets `closeCurrentVisit(tableId)`; the existing `closeVisit(visitId, tableId)` is left as it is.
- **Shared confirmation modal.** `ConfirmModal` gets an additive change so it meets the screen's keyboard rule: `Escape` closes it, focus moves into it and stays inside until it closes. Its other callers behave as before. [NFR6]
- **Browser test tables.** The U4 browser tests use tables 7 to 10 only, because closing a table in a shared test server must not disturb the earlier Units' specs.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "dpl-workshop",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "project",
      "text": "These notes add to the methodology the framework sets; they don't change it.\n- **Browser tests:** besides unit and integration tests, every Unit adds Playwright tests in `e2e/<unit>/` for its main flows. The walking skeleton installs Playwright with Chromium.\n- **Verification command:** `npm test && npm run test:e2e`.\n  - `npm test` writes `test-results/unit.json` and `coverage/coverage-summary.json`.\n  - `npm run test:e2e` writes `test-results/e2e.json`.\n  - The workshop dashboard reads these files.\n- **Mockup match:**\n  - Every Unit adds `e2e/<unit>/mockup-match.spec.ts`. For each refined mockup the Unit builds, it sets up the same state and checks that the screen shows the mockup's headings, labels, buttons, messages and status words.\n  - It saves the mockup and app screenshots side by side in `test-results/mockup-match/<unit>/`.\n  - Parts that a later Unit owns are left out of the comparison and listed.\n- **Browsers checked at Build and Test:**\n  - Chromium, the installed Google Chrome, and WebKit (Safari's engine).\n  - Firefox is not installed or tested.\n  - Build and Test also adds a keyboard-only test of the whole journey, for NFR6.\n- **Ports and database:** every port and the SQLite database file come from environment variables, so Bolts built in parallel never share either:\n  - `PORT`, default 3000: the app the team uses, in the main folder only.\n  - `E2E_PORT`, default 3100: the browser tests. Specs that need their own server use `E2E_PORT` + 100 and + 200 (3200 and 3300 by default).\n  - `DB_FILE`: the database file.\n  - Each parallel Bolt runs its tests with its own `E2E_PORT`: 4100, 5100, 6100 and 7100, in batch order. It also uses its own `DB_FILE` inside its worktree.\n- **A flaky test** is fixed in the test code; a threshold is never lowered."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:1802929429da4c7ecc1af400cd69f52c6f6b9645e66cf102fb8cb6c1c4e3e978",
  "contract_sha256": "sha256:b4cb807649ab2c72fee4d5b1b31c7ff4f1392743ea63e3079156fb0ca689734d"
}
```

---

## Steps

**Step 0** — First step: fixes for the five Minor findings of the kitchen board's review (replayed after Build and Test's loop-back; the team's rule is that review findings are fixed before the work moves on, here in the next Unit's plan) — `src/client/hooks/useBoardOrders.ts`, `src/server/routes/billing.ts`, `src/server/routes/orders.ts`, `src/server/routes/sse.ts`, `src/server/sse.ts`, and their tests
- [x] (1) The board relies on events alone to remove a closed table: a missed `TABLE_CLOSED` (a stream gap longer than the 60-event buffer, or a server restart) leaves a stale card until reload, and a `TABLE_CLOSED` that arrives before the first fetch resolves is lost because the fetched result adds the table back. In `useBoardOrders.ts`: fetch the board again when the staff stream reconnects, and remember tables closed while the first fetch is in flight so the fetched data does not bring them back. Tests for both, one named "regression: a table closed while the board is still loading does not come back when the first fetch resolves"
- [x] (2) `billing.ts` keeps its own copy of the 404 table-id helper: use the shared `src/server/routes/tableId.ts` instead and delete the copy; the bill and close behaviour stays as it is
- [x] (3) The order transition route reads `12abc` as order 12: order numbers must be only digits (a positive whole number); anything else answers 404 `UNKNOWN_ORDER` in the error envelope. Test it, including `0`, `-1`, `1e1`, `12abc`
- [x] (4) In `src/server/routes/sse.ts` remove the dead `_lastEventId` variable and the stale TODO; send the connection's HELLO event only to the connection that just opened, not to every existing subscriber on that channel (`src/server/sse.ts` if the send is there). Test that an existing subscriber receives no HELLO when another client connects
- [x] (5) Record the reading of FR2.2 ("a card per table with its open orders" read as "a card per table with an open visit", added in the kitchen board's Build and Test fix) as one line under the assumptions in `aidlc/spaces/default/intents/261105-table-order-app/inception/requirements-analysis/requirements.md`, so it does not live only in a code summary

**Step 1** — Verify walking skeleton foundations [US7.1, US7.2]
- [ ] Confirm U1/U2/U3 provide what U4 reads: `getOrdersByVisit(visitId)` in `orderRepo.ts`, `getCurrentVisit` in `db.ts`, `getTableStatus` in `tableRepo.ts`, `publish` in `sse.ts`, the `/sse/staff` stream, `useStaffSSE`, `ConfirmModal`, the "Table N →" link in `KitchenBoardScreen`, and the `tables/:id` placeholder route in `StaffView`
- [ ] Note any missing piece and add the smallest stub without changing U1/U2/U3 behaviour

**Step 2** — Bootstrap unit-scoped test runner
- [ ] Confirm vitest and Playwright are configured; run the unit-scoped command from `unit-test-instructions.md` once on the (still empty) U4 paths to confirm it is runnable
- [ ] Record the exact commands in `unit-test-instructions.md`

**Step 3** — Data model / database behaviour: close a visit [FR3.5, BR3.1] — `src/server/repositories/tableRepo.ts`
- [ ] Add `closeCurrentVisit(tableId): string | null`: marks the table's open visit closed (`closed_at`) and returns its id; returns `null` when no visit is open
- [ ] Add `hasClosedVisit(tableId): boolean` (the table has at least one archived visit), used to tell "already closed" from "never used"
- [ ] Leave the existing `closeVisit(visitId, tableId)` as it is
- [ ] After a close, `getTableStatus` reports the table as `closed` with `visit_id: null`, and the next `getOrOpenVisit` opens a new visit

**Step 4** — Test the visit close (5–8 tests)
- [ ] `src/server/__tests__/tableClose.test.ts`
- [ ] `closeCurrentVisit` returns the open visit id and sets `closed_at`
- [ ] Returns `null` when no visit is open
- [ ] `hasClosedVisit` is false for a never-used table and true after a close
- [ ] After a close, a new order opens a different visit and the old visit's orders are not in it
- [ ] Orders of the archived visit stay in the database
- [ ] Run vitest scoped; confirm green

**Step 5** — Business logic: build the bill and decide the close [FR3.1–FR3.5, BR1.1–BR1.4, BR2.1–BR2.4, BR4.1, BR4.2] — `src/server/repositories/billingRepo.ts`
- [ ] `buildBill(tableId)`: throws `UNKNOWN_TABLE` for an unknown table; with no open visit returns an empty bill; otherwise reads `getOrdersByVisit(visitId)` (read only; never writes to Ordering), drops Cancelled orders, keeps placement order, and uses each line's stored `price_cents_each` (never the current menu price)
- [ ] Each order `subtotal_cents` is the sum of its lines; `combined_total_cents` is the sum of the included orders, computed at read time and never stored
- [ ] `close_available` is true only when the visit has at least one order (Cancelled orders count here, so a visit where everything was cancelled can still be closed) and none is Pending or Preparing; `blocking_orders` lists the Pending and Preparing order numbers (empty when closing is available)
- [ ] `closeTable(tableId)`: throws `UNKNOWN_TABLE`, `TABLE_ALREADY_CLOSED`, `TABLE_EMPTY` or `CLOSE_BLOCKED` (with `blocking_orders`) as the choices above set out; on success calls `closeCurrentVisit` and returns `{ closed: true, archived_visit_id }`
- [ ] The check and the close run in one transaction so a status change cannot slip between them

**Step 6** — Test the bill and close rules (5–8 tests per function)
- [ ] `src/server/__tests__/billing.test.ts`
- [ ] Bill lists orders in placement order with line and order subtotals and one combined total
- [ ] Cancelled orders are left out of `orders[]`, subtotals and the combined total
- [ ] Prices come from the stored order line: change the menu price after ordering and the bill is unchanged
- [ ] `close_available` false with a Pending order, false with a Preparing order (both listed in `blocking_orders`), true when all are Completed or Cancelled with at least one included order
- [ ] A visit whose only orders are Cancelled still counts as having orders: the bill is empty (total $0.00) and `close_available` is true, so the table can always be closed (checked here with its own test)
- [ ] `closeTable` refusals: `CLOSE_BLOCKED` with the open order numbers, `TABLE_EMPTY`, `TABLE_ALREADY_CLOSED`, `UNKNOWN_TABLE`
- [ ] `closeTable` success archives the visit and returns its id
- [ ] Run vitest scoped; confirm green

**Step 7** — API / endpoint [FR3.1–FR3.6, BR3.2, BR3.3] — `src/server/routes/billing.ts`, `src/server/index.ts`, `src/server/routes/orders.ts`
- [ ] `GET /api/tables/:id/bill` returns the bill; `UNKNOWN_TABLE` answers 404 in the contract's error envelope; a non-numeric id answers 404 the same way
- [ ] `POST /api/tables/:id/close` returns 200 `{ closed: true, archived_visit_id }`; `CLOSE_BLOCKED` and `TABLE_EMPTY` answer 422 (`details.blocking_orders` on the first), `TABLE_ALREADY_CLOSED` answers 409, `UNKNOWN_TABLE` answers 404; anything unexpected answers 500 `INTERNAL_ERROR` and is logged
- [ ] On success publish `TABLE_CLOSED` `{ table_id, archived_visit_id }` to the `staff` channel and the `table:<tableId>` channel
- [ ] Register the router in `src/server/index.ts` under `/api`
- [ ] Rewrite the `TODO(U4)` comment in `src/server/routes/orders.ts` to say a closed table starts a new visit on its next order (no behaviour change)

**Step 8** — Test the endpoints (5–8 tests)
- [ ] `src/server/__tests__/billing-api.test.ts` (supertest against `app`, in-memory database)
- [ ] `GET /bill` returns the contract's shape for a table with two orders
- [ ] `GET /bill` for an unknown table is 404 `UNKNOWN_TABLE`; for an unused table it is 200 with an empty bill and `close_available: false`
- [ ] `POST /close` is 422 `CLOSE_BLOCKED` while an order is Pending, then 200 once it is Completed
- [ ] `POST /close` on a table with no orders is 422 `TABLE_EMPTY`; closing twice is 409 `TABLE_ALREADY_CLOSED`
- [ ] A successful close publishes `TABLE_CLOSED` to both channels (read from the SSE ring buffer through a subscribed test response)
- [ ] regression-style check: placing an order after a close opens a new visit and the new bill does not include the old orders
- [ ] Run vitest scoped; confirm green

**Step 9** — Frontend behaviour: shared modal [NFR6] — `src/client/components/ConfirmModal.tsx`
- [ ] Add `Escape` to close (calls `onCancel`), move focus to the first button when it opens, keep Tab inside it, and give focus back to the element that opened it when it closes
- [ ] Keep every existing prop, test id and behaviour

**Step 10** — Test the modal change (4–5 tests)
- [ ] Extend `src/client/components/__tests__/ConfirmModal.test.tsx` (new file if none exists)
- [ ] `Escape` calls `onCancel`; focus starts inside the modal; Tab from the last button wraps to the first; closed modal renders nothing; existing confirm and cancel clicks still work
- [ ] Run vitest scoped; confirm green

**Step 11** — Frontend behaviour: `useBill` hook [US7.1, FR3.1, FR3.6] — `src/client/hooks/useBill.ts`
- [ ] Fetches `GET /api/tables/:id/bill` on mount; returns `{ bill, loading, error, reload }`
- [ ] Reads `useStaffSSE` events; on `ORDER_STATUS_CHANGED` or `ORDER_PLACED` for this table fetches the bill again; ignores other tables' events and events it has already handled (by `seq`)
- [ ] On `TABLE_CLOSED` for this table returns `closed: true` so the screen can leave
- [ ] A failed fetch sets `error` and keeps the last good bill

**Step 11a** — Test `useBill` (5–8 tests)
- [ ] `src/client/hooks/__tests__/useBill.test.ts`
- [ ] Loads the bill on mount; `loading` true then false
- [ ] Status-change event for this table re-fetches; for another table does not
- [ ] `TABLE_CLOSED` for this table sets `closed`
- [ ] Fetch failure sets `error` and `reload` retries
- [ ] Run vitest scoped; confirm green

**Step 12** — Frontend behaviour: bill parts [US7.1, US7.2, FR3.1–FR3.4, NFR5, NFR6] — `src/client/components/staff/`
- [ ] `BillOrderCard.tsx`: order number `#N`, status pill with icon and word, placed time, line rows (emoji or name, `× quantity`, `$X.XX each`, line subtotal) and the order subtotal; `data-testid="bill-order-<n>"`
- [ ] `BillTotal.tsx`: "Combined total" with `$X.XX`; `data-testid="bill-combined-total"`
- [ ] `CloseTableSection.tsx`: **Close table** button (`disabled`, not `aria-disabled`, when close is not available) and the note: "One or more orders still open: #N, #M" or "This table has no orders to close."; `data-testid="btn-close-table"` and `data-testid="open-orders-note"`
- [ ] Money formatting `$X.XX` from cents in one shared helper next to the bill parts
- [ ] Visible 2 px accent focus ring on the Back link and the Close table button; no animation on bill rows

**Step 13** — Test the bill parts (5–8 tests per component)
- [ ] `src/client/components/staff/__tests__/BillOrderCard.test.tsx`, `BillTotal.test.tsx`, `CloseTableSection.test.tsx`
- [ ] Order card shows number, status pill (icon + word), lines, subtotal
- [ ] Money formats from cents as `$10.50`, `$0.00` and `$35.00`
- [ ] Close button disabled with the open-orders note listing `#N, #M`; disabled with the "no orders" note; enabled with no blocking note
- [ ] Run vitest scoped; confirm green

**Step 14** — Frontend behaviour: `TableBillScreen` and routing [US7.1, US7.2, FR3.1–FR3.6] — `src/client/screens/staff/TableBillScreen.tsx`, `src/client/views/StaffView.tsx`
- [ ] Header "Table N — Bill" and **← Board** link to `/staff`; the order list, the combined total and the close section from Step 12
- [ ] Loading shimmer for 2–3 order rows; fetch error "We cannot load the bill right now." with **Retry**; no orders shows an empty bill with Close table disabled
- [ ] Tapping **Close table** opens the confirmation "Close Table N?" with "Combined total: $X.XX" and buttons **Close table** and **Cancel**; confirming sends `POST /api/tables/:id/close`
- [ ] On success go to `/staff`; on `CLOSE_BLOCKED` show "Close table is not available until every order is completed or cancelled." and re-enable the button; on `TABLE_EMPTY` show "This table has no orders to close."; on `TABLE_ALREADY_CLOSED` go to `/staff`; any other failure shows a retryable error
- [ ] A `TABLE_CLOSED` event for this table from `useBill` goes to `/staff` at once
- [ ] The Close table button is disabled while the close request is in flight
- [ ] Replace the `TableBillPlaceholder` route in `StaffView.tsx` with `TableBillScreen`
- [ ] Test ids: `table-bill-screen`, `bill-back-link`, `bill-loading`, `bill-error`, `bill-retry`, `close-error-banner`

**Step 15** — Test `TableBillScreen` (5–8 tests)
- [ ] `src/client/screens/staff/__tests__/TableBillScreen.test.tsx`
- [ ] Renders orders, subtotals and the combined total from a mocked bill
- [ ] Shows the loading and the fetch-error states; Retry fetches again
- [ ] Close table confirm flow sends the POST and navigates to `/staff`
- [ ] `CLOSE_BLOCKED` and `TABLE_EMPTY` responses show their banners and keep the screen
- [ ] `TABLE_ALREADY_CLOSED` navigates to `/staff`
- [ ] A live status event re-fetches the bill; a `TABLE_CLOSED` event navigates to `/staff`
- [ ] Run vitest scoped; confirm green

**Step 16** — Playwright E2E tests [US7.1, US7.2, FR3.1–FR3.6] — `e2e/u4-bill-and-close/bill-and-close.spec.ts`
- [ ] Each flow places its own orders through the API on tables 7 to 10
- [ ] Flow 1: the bill lists every order with items, quantities, prices, subtotals and the combined total; a Cancelled order is not shown
- [ ] Flow 2: Close table is disabled with a Pending order and the note lists it; completing the order on the board makes the bill enable Close table within 2 seconds without a reload
- [ ] Flow 3: a table with no orders shows the empty bill and a disabled Close table with the "no orders" message
- [ ] Flow 4: closing the table with a diner screen open for it shows the "This table was closed" takeover within 2 seconds, the bill leaves for `/staff`, and the table is gone from the Kitchen Board
- [ ] Flow 5: closing a table that was already closed from another session sends the staff member back to `/staff`; the Back link returns to the board from the bill

**Step 17** — Playwright mockup-match spec — `e2e/u4-bill-and-close/mockup-match.spec.ts`
- [ ] Seed table 10 with two Completed orders (as in the S2 mockup) and open its bill
- [ ] Check the S2 mockup's headings, labels and words: "Table 10 — Bill", "← Board", "Combined total", "Subtotal", "Close table", status word "Completed", `each` prices, `$` totals
- [ ] Check the loading, empty ("This table has no orders to close.") and error ("We cannot load the bill right now.") states the mockup lists
- [ ] Save the mockup and app screenshots side by side in `test-results/mockup-match/u4-bill-and-close/`
- [ ] Parts that belong to other Units (the board's table card header link, the diner takeover content) are named in a spec comment as outside this Unit's comparison

**Step 18** — Environment/build configuration
- [ ] No new dependencies. Confirm `npm run build` still succeeds and the server route is picked up by `tsx src/server/index.ts`
- [ ] Confirm every port and the database file in the new specs come from `E2E_PORT` and `DB_FILE`

**Step 19** — Documentation, `source-manifest.json` and `traceability.json`
- [ ] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/code-generation/code-summary.md` (files, decisions, tests, anything not run, deviations)
- [ ] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/code-generation/source-manifest.json` listing every file created or changed
- [ ] Run `aidlc engine sensor-traceability --stage code-generation --output-path aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/code-generation/traceability.json --write-upstream` and fill in OK targets

**Step 20** — Fix found by Build and Test (Loop-back 1): the Unit's traceability record covers its stories and requirements [US7.1, US7.2, FR3.1–FR3.5, NFR4]
- [x] What went wrong: `traceability.json` lists only BR1.1 to BR4.2, so Build and Test's cross-unit check finds FR3.1 to FR3.5 and NFR4 "not built" although the code and tests exist
- [x] Re-run `aidlc engine sensor-traceability --stage code-generation --output-path aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/code-generation/traceability.json --write-upstream` and add a row with status `OK` for each of US7.1, US7.2, FR3.1, FR3.2, FR3.3, FR3.4, FR3.5 and NFR4 (NFR4 target: `src/server/repositories/billingRepo.ts`, whose bill has no tax or service line), each pointing at one existing implementation or test file; keep every BR row
- [x] Confirm `aidlc engine sensor-traceability --stage build-and-test` reports FR3.1 to FR3.5 and NFR4 as covered
- [x] Note in `code-summary.md` that the Unit's record now lists its stories and requirements. No application code changes in this step
