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

### Test-code problems fixed along the way (not product bugs)

- **`placeOrder` helper returning `undefined` order_number**: The E2E helper used destructuring against a `Promise<number>` return type. Fixed by returning the number directly and updating all call sites from `const { order_number } = await placeOrder(...)` to `const order_number = await placeOrder(...)`.

- **U1 mockup-match checking for placeholder text**: `e2e/u1-walking-skeleton/mockup-match.spec.ts` asserted `body.toContainText('Orders will appear here')`. U3 replaces the stub so the placeholder is gone. Fixed by removing that assertion and adding a comment that U3 owns the full Kitchen Board UI.

- **Flow 5 `toBeChecked()` failure**: Playwright's `toBeChecked()` was unreliable against a React-controlled checkbox after an optimistic update. Fixed by recording initial checked state with `toggle.isChecked()` before click, waiting 500 ms for React re-render, then asserting `isCheckedNow !== wasChecked`.

## Swarm convergence

`E2E_PORT=5100 aidlc engine swarm check u3-kitchen-board` returns `"converged":true`: 77 unit tests and 18 browser tests pass.

## Files outside this Unit's own folders

This Unit also edits `src/client/App.tsx` (route `/staff/*`), `src/client/views/StaffView.tsx` (nested routes) and the walking skeleton's browser test `e2e/u1-walking-skeleton/mockup-match.spec.ts` (the placeholder text it checked is gone). The other parallel Bolt edits other files, so the merge of the two Bolts should be checked against these.
