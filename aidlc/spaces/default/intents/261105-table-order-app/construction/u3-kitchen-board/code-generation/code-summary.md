# Code Summary — U3 `u3-kitchen-board`

## What was built

The Kitchen Board staff screen at `/staff`, replacing the U1 placeholder stub with a live, real-time order management interface.

### Hooks

- `src/client/hooks/useBoardOrders.ts` — Fetches active orders for all 10 tables in parallel via `GET /api/tables/:id/orders?visit=current`, subscribes to `/sse/staff` EventSource, and handles `ORDER_PLACED` (adds order with `isNew: true`), `ORDER_STATUS_CHANGED` (updates status; clears `isNew` on Pending → Preparing), and `TABLE_CLOSED` (removes table). Returns `{ ordersByTable: Map<number, Order[]>, loading: boolean }`.

- `src/client/hooks/useMenuAvailability.ts` — Fetches menu items on mount, provides `toggleAvailability(id, available)` which sends `POST /api/menu/items/:id/availability` with optimistic update and rollback on error. Syncs from `MENU_AVAILABILITY_CHANGED` SSE events.

### Components

- `src/client/components/staff/NewHighlight.tsx` — Wrapper that shows an accent ring, glow, and "★ New" label when `active=true`. 150 ms ease-out transition; suppressed under `prefers-reduced-motion`. `data-testid="new-highlight"`, `data-active={active}`.

- `src/client/components/staff/OrderCard.tsx` — Renders an order card with order number, status pill (⏳ Pending / 🔥 Preparing / ✓ Completed), placed timestamp, line items, and action buttons. "Start preparing" transitions Pending → Preparing; "Mark completed" transitions Preparing → Completed via `POST /api/orders/:n/transition`. A "Cancel" button (Pending and Preparing orders) asks "Cancel order #N?" and then moves the order to Cancelled. Buttons are disabled while a request is in flight, and a refused move shows an inline error. Every Pending order is wrapped in `NewHighlight`, so it shows "★ New" until it moves to Preparing or is cancelled.

- `src/client/components/staff/MenuAvailabilityPanel.tsx` — Modal dialog (`role="dialog"`, `aria-label="Menu availability"`) listing all menu items with a "Sold out" switch each (`role="switch"`) and a Done button. Uses the `useMenuAvailability` hook; shows optimistic updates and an inline error on failure. `data-testid="availability-toggle-{id}"`.

### Screen and routing

- `src/client/screens/staff/KitchenBoardScreen.tsx` — Main screen using `useBoardOrders`. Renders a `BoardShimmer` while loading, `BoardEmptyState` ("No open orders right now. Orders will appear here within 2 seconds of placement.") when no table has an open order, and sorted `TableSection` groups per table. A table card shows only while the table has a Pending or Preparing order; it lists that table's orders newest first, Completed ones included and Cancelled ones left out. A "Reconnecting… Updates will resume shortly." banner appears when the live-update stream has been down for more than 3 seconds. Opens `MenuAvailabilityPanel` via a "Menu availability" button. `data-testid="kitchen-board"`, `data-testid="table-section-{tableId}"`.

- `src/client/views/StaffView.tsx` — Rewritten from stub to render nested Routes: index → `KitchenBoardScreen`; `tables/:id` → `TableBillPlaceholder` (U4 scope).

- `src/client/App.tsx` — `/staff` route changed to `/staff/*` to support nested routing in `StaffView`.

### Configuration

No shared configuration is changed by this Unit. `playwright.config.ts` and the `test:e2e` script are as the walking skeleton left them (an earlier attempt changed their defaults, which would have clashed with the other parallel Bolt; that was removed). This Bolt runs its browser tests on its own port with `E2E_PORT=5100`; the test server uses an in-memory database.

## Tests

### Unit/component tests (vitest + React Testing Library)

| File | Tests |
|---|---|
| `src/client/hooks/__tests__/useBoardOrders.test.ts` | 6 |
| `src/client/hooks/__tests__/useMenuAvailability.test.ts` | 5 |
| `src/client/components/staff/__tests__/NewHighlight.test.tsx` | 5 |
| `src/client/components/staff/__tests__/OrderCard.test.tsx` | 14 |
| `src/client/components/staff/__tests__/MenuAvailabilityPanel.test.tsx` | 6 |
| `src/client/screens/staff/__tests__/KitchenBoardScreen.test.tsx` | 9 |
| **Total** | **45** |

All 45 pass (77 across the whole worktree, with the walking skeleton's tests).

### Playwright E2E tests

| File | Tests |
|---|---|
| `e2e/u3-kitchen-board/kitchen-board.spec.ts` | 5 flows |
| `e2e/u3-kitchen-board/mockup-match.spec.ts` | 8 tests: header and ★ New on a Pending order, a Preparing order, a Completed order beside an open one, the Cancel confirmation, the empty state, the disconnect banner, the Menu availability panel, and the mockup's own screenshot saved beside the app's in `test-results/mockup-match/u3-kitchen-board/` |
| **Total** | **13** |

All 13 pass (18 across the whole worktree, with the walking skeleton's 5). The availability flow also checks that the server stored the change, and puts the item back afterwards.

## Bugs found by the tests and fixed

### Bug 1 — "★ New" showed only for orders that arrived while the board was open
- **What went wrong:** the design says every Pending order shows "★ New" until it moves to Preparing or is cancelled. `OrderCard` highlighted only orders flagged as arriving live, so Pending orders already waiting when the board loaded had no highlight.
- **Fix location:** `src/client/components/staff/OrderCard.tsx` line 64 — the highlight is on whenever the status is Pending.
- **Regression test:** `src/client/components/staff/__tests__/OrderCard.test.tsx` — "regression: a Pending order already on the board when it loads is highlighted "★ New"". Checked to fail without the fix. The browser mockup-match test for the Pending order checks it too.

### Bug 2 — Completed orders were hidden from a table's card, and the list was not newest first
- **What went wrong:** the mockup and design show a Completed order on a table's card beside its open orders, newest first. `TableSection` listed only Pending and Preparing orders, in the order the server sent them.
- **Fix location:** `src/client/screens/staff/KitchenBoardScreen.tsx`, `TableSection` (lines 147–158) — a card shows while the table has an open order, lists every order except Cancelled, newest first by `placed_at`.
- **Regression test:** `src/client/screens/staff/__tests__/KitchenBoardScreen.test.tsx` — "regression: a Completed order stays on its table card while the table has an open order, newest first". Checked to fail without the fix.

### Bug 3 — button labels did not match the mockup
- **What went wrong:** the Preparing button read "Mark complete" and the cancel button read "Cancel order"; the mockup says "Mark completed" and "Cancel".
- **Fix location:** `src/client/components/staff/OrderCard.tsx` (the two button labels).
- **Regression test:** `OrderCard.test.tsx` — '"Mark completed" button present for Preparing orders' (checks the label text), and the browser mockup-match tests check both labels. These checks were added with the fix; the label test was seen failing on the old label while the browser tests ran against the old build.

### Bug 4 — a table left the board when its last open order was completed, so it could not be closed (found by Build and Test)
- **What went wrong:** the board kept a table only while it had a Pending or Preparing order. The only link to a table's bill is that card's "Table N →" header, so once the last order was completed the link was gone and staff could not open the bill or close the table from the screens (FR3.1, FR3.3, FR3.5 and the keyboard journey, NFR6).
- **Fix location:** `src/client/screens/staff/KitchenBoardScreen.tsx` lines 67–72 (a table stays while its current visit has any order and leaves only when it is closed) and lines 163–164 (`TableSection` lists every order, hiding Cancelled ones only while the table still has an open order); `src/client/hooks/useBoardOrders.ts` (the table is removed on the table-closed event, and a board read that started before the close cannot bring it back).
- **Regression tests:** `src/client/screens/staff/__tests__/KitchenBoardScreen.test.tsx` — "regression: a table with only completed orders stays on the board with its bill link until it is closed"; `src/client/hooks/__tests__/useBoardOrders.test.ts` — the same-named regression; in the browser `e2e/build-and-test/board-bill-link.spec.ts` — "regression: a table whose orders are all completed stays on the board until it is closed, so staff can open its bill" and `e2e/build-and-test/keyboard-journey.spec.ts`. The first two were checked to fail on the old filter; the browser specs failed in Chromium, Chrome and WebKit before the fix and pass after it.

### Bug 5 — the Menu availability panel did not look like the mockup (found by the mockup match in Build and Test)
- **What went wrong:** each row showed plain "Available" text with no switch and no item picture; the mockup shows a switch labelled "On" or "Sold out" and the item's picture.
- **Fix location:** `src/client/components/staff/MenuAvailabilityPanel.tsx`, `AvailabilityRow` — a switch track and knob, the label "On" / "Sold out", and the item picture.
- **Regression test:** `src/client/components/staff/__tests__/MenuAvailabilityPanel.test.tsx` — "regression: each row shows the item picture and "On" or "Sold out" beside its switch, as the mockup does". Checked to fail with the old "Available" label and to pass with the fix. The look itself is also in the screenshot pair `test-results/mockup-match/u3-kitchen-board/menu-availability-panel.png`, looked at by hand.

### Test-code problems fixed along the way (not product bugs)

- **`placeOrder` helper returning `undefined` order_number**: The E2E helper used destructuring against a `Promise<number>` return type. Fixed by returning the number directly and updating all call sites from `const { order_number } = await placeOrder(...)` to `const order_number = await placeOrder(...)`.

- **U1 mockup-match checking for placeholder text**: `e2e/u1-walking-skeleton/mockup-match.spec.ts` asserted `body.toContainText('Orders will appear here')`. U3 replaces the stub so the placeholder is gone. Fixed by removing that assertion and adding a comment that U3 owns the full Kitchen Board UI.

- **Flow 5 `toBeChecked()` failure**: Playwright's `toBeChecked()` was unreliable against a React-controlled checkbox after an optimistic update. Fixed by recording initial checked state with `toggle.isChecked()` before click, waiting 500 ms for React re-render, then asserting `isCheckedNow !== wasChecked`.

## Swarm convergence

`E2E_PORT=5100 aidlc engine swarm check u3-kitchen-board` returns `"converged":true`: 77 unit tests and 18 browser tests pass.

## Files outside this Unit's own folders

This Unit also edits `src/client/App.tsx` (route `/staff/*`), `src/client/views/StaffView.tsx` (nested routes) and the walking skeleton's browser test `e2e/u1-walking-skeleton/mockup-match.spec.ts` (the placeholder text it checked is gone). The other parallel Bolt edits other files, so the merge of the two Bolts should be checked against these.

## Review findings fixed (replay)

Step 0 and Step 17a were added after Build and Test's loop-back and two reviews. They were built in the main folder.

### Step 0: the walking skeleton's four Minor review findings

- **Keep-alive.** `src/server/sse.ts` writes a comment line (`: keep-alive`, then a blank line) to every subscriber of every channel every 20 seconds (`KEEP_ALIVE_INTERVAL_MS`). One shared timer, started with the first subscriber and stopped when the last one leaves. It is `unref`'d, so it never keeps the process or a test run alive. A subscriber whose write fails is dropped without breaking the others.
- **Event ids across a restart.** The id counter starts from the server's start time in milliseconds. `_resetForTest()` still resets it to 0, so the existing tests keep their ids (1, 2, ...).
- **Table ids.** New helper `src/server/routes/tableId.ts`: a table id in a URL must match `^[1-9]\d*$`. `5abc`, `0`, `-1`, `1e1` and `5.0` answer 404 `UNKNOWN_TABLE` in the error envelope on `POST /api/tables/:id/orders`, `GET /api/tables/:id/orders`, `GET /api/tables/:id` and `GET /sse/tables/:id` (the stream is refused and never opened). The check comes before the body check. The billing routes already refused non-numeric ids and were not touched.
- **Tests.** `sse.test.ts` has 12 tests (was 4): 5 for keep-alive (fake timers), 3 for ids across a restart (a faked restart a minute later, a client reconnecting with an id from before it, `_resetForTest` still starting at 1). `api.test.ts` has 44 (was 18): includes "regression: a table id with trailing text is refused, not read as the number in front of it" (it fails on the old `parseInt`) and the six bad ids on all four routes.

### Step 0: the diner screens' three Minor findings

- **(a) Decide after the answer.** The first-visit "quiet clear" used a yes-or-no taken before the server answered. `TableView` now notes which cart lines exist when the check starts and, once the answer is in, removes only those lines from the cart as it is then (`removeLines` in `useCart.ts`). A line added while the request is in flight stays. Tests: "a line added while the first answer is on its way is kept; only the lines that were there before go" (fails on the old code) and "an item added to an empty cart while the first answer is on its way is not dropped".
- **(b) A stale answer is ignored.** Each check of the table's last-closed value takes a sequence number, and a live `TABLE_CLOSED` takes one too. Only the newest check may act on its answer, so an older answer can no longer overwrite the newer marker. Test: "regression: an older server answer that arrives after a live TABLE_CLOSED cannot overwrite the newer marker" (checked to fail with the guard switched off).
- **(c) Deploy trade-off, recorded.** A saved cart that has no stored `cart-closed-marker:<table>` is cleared quietly on the first visit (no message). That is the rule for a cart whose origin cannot be trusted, and it also empties the cart of a diner who is mid-meal at the moment this version is deployed (their device has no marker yet). The cost is a one-time empty cart for people already ordering at the switch-over; the benefit is that an old cart can never reach the next party. The team accepted this by approving the plan.
- `useCart.test.ts` has 17 tests (2 new for `removeLines`); `TableView.test.tsx` has 12 (3 new for the races).

### Step 0: bookkeeping about the walking skeleton's plan (the plan itself is not edited, it is approved)

- Its prose says the transition request body field is `status`. The code and the contract use `to` (`POST /api/orders/:order_number/transition` with `{ "to": ..., "by": ... }`).
- Four of its steps are left unticked although their work exists and its browser specs (`e2e/u1-walking-skeleton/`) pass.

### Step 17a: a table stays on the board until it is closed

- **Reading of FR2.2.** FR2.2 says "a card per table with its open orders". This Unit now reads it as "a card per table with an open visit". The reason: staff close a table from its bill, and the only way to the bill is the "Table N →" link on the card. When the last open order was completed the old rule removed the card, so staff could not reach the bill from the screens (FR3.1, FR3.3, FR3.5, NFR6). A card therefore stays while the current visit has any order, whatever its status, and leaves on `TABLE_CLOSED`.
- **Behaviour.** `useBoardOrders.ts` no longer removes a table when its orders are all Completed or Cancelled. `KitchenBoardScreen.tsx` shows every table that has any order. A card with no Pending or Preparing order shows its orders as they are, keeps the bill link, and shows "No open orders. Open the bill to close this table." (`table-ready-to-close-<id>`). While a card has an open order, cancelled orders stay off it as before. "No open orders right now." still shows for a board with no table. The new-order highlight, the buttons (Pending and Preparing only), the loading shimmer and the reconnect banner are unchanged. `OrderCard.tsx` gives the Cancelled pill its own colours (it used the Completed green).
- **Tests.** `KitchenBoardScreen.test.tsx` has 13 tests (was 10), including "regression: a table with only completed orders stays on the board with its bill link until it is closed" (fails on the old filter). `useBoardOrders.test.ts` has 11 (was 9), with the same-named regression. In the browser, Flow 3 in `kitchen-board.spec.ts` now expects the card to stay, marked Completed, with the bill link. `mockup-match.spec.ts` needed no change (no checked word changed).
- **The two Build and Test specs.** The two `test.fail(...)` lines (and their comments) are removed from `e2e/build-and-test/board-bill-link.spec.ts` and `e2e/build-and-test/keyboard-journey.spec.ts`. Both now pass in Chromium.

### Test results

- Unit tests: 30 files, 298 tests, all passed (U3's scoped command: 80 tests in 9 files, all passed).
- Browser tests (Chromium, `E2E_PORT=3100`): 47 passed in the whole suite, with U4's and the diner specs unchanged and green.
- `npx tsc --noEmit -p .`: no errors.
