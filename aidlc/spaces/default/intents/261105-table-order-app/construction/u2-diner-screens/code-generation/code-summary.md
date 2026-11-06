# Code Summary — U2 `u2-diner-screens`

## What was built

### Hooks
- **`src/client/hooks/useCart.ts`** — cart management hook. Persists items to `localStorage` under `cart:table:<tableId>` and the placement_key to `sessionStorage` under `cart-placement-key:<tableId>`. Generates placement_key lazily on the first `addItem` call. Dispatches a `CustomEvent('cart-updated')` after every write so other `useCart` instances in the same tab (e.g. `TableView` reading the badge count) stay in sync without a React context.
- **`src/client/hooks/useTableSSE.ts`** — SSE hook (created by previous agent in Steps 1–4; verified green).

### Screens
- **`src/client/screens/diner/MenuScreen.tsx`** — fetches `GET /api/menu`, shows a loading shimmer and an error+Retry state. Sticky category pill bar (Starters, Mains, Desserts, Drinks) driven by `IntersectionObserver`; active pill filled when its section is on screen. Each `MenuItemCard` shows image, name, description, price, and a `+ Add` pill that shows the in-cart count as a badge.
- **`src/client/screens/diner/CartScreen.tsx`** — lists cart items with `−`/`+` quantity controls and line subtotals. Sticky bottom bar contains the Place order button (disabled when empty). Tapping it opens `ConfirmModal` from U1. On confirm: `POST /api/tables/:id/orders` with `placement_key` and line items. On success it clears the cart and hands the order number (and any dropped lines) to `TableView`, which shows the "Order #N placed" toast for 3 seconds and switches to My orders. A repeated `placement_key` is answered by the server with 200 and the existing order (the contract), so it is shown the same way; there is no separate "already placed" state. Other errors show an inline banner and keep the cart.
- **`src/client/screens/diner/MyOrdersScreen.tsx`** — fetches `GET /api/tables/:id/orders?visit=current`, re-fetches on `ORDER_STATUS_CHANGED` SSE event (passed as `lastSSEEvent` prop). Shows status pills: Pending (clock icon), Preparing (flame icon), Completed (tick icon). Hides Cancelled orders. Line prices come from the contract's `subtotal_cents`. Loading shimmer and "No orders yet" empty state.

### Components
- **`src/client/components/diner/DinerTabBar.tsx`** — fixed bottom tab bar with Menu, Cart, and Orders tabs. Cart tab shows a count badge (capped at `9+`). Active tab is highlighted with accent colour. Each tab has a `data-testid`.
- **`src/client/components/diner/TableClosedTakeover.tsx`** — full-screen overlay (`role="alertdialog"`, `data-testid="table-closed-takeover"`) shown when the SSE stream emits `TABLE_CLOSED`. 300 ms fade-in; motion suppressed when `prefers-reduced-motion: reduce`.

### Routing
- **`src/client/views/TableView.tsx`** (modified) — wires the tab bar and screens; passes `tableId` and `visitId` from URL params and sessionStorage; listens for `TABLE_CLOSED` via `useTableSSE` and shows `TableClosedTakeover`. After an order is placed it shows the "Order #N placed" toast (or, when some items sold out, a banner naming each removed item) for 3 seconds on the My orders tab.

### Changes to the walking skeleton's server (U1-owned files)
This Unit edited four files that belong to the walking skeleton. U3 is built in parallel against the same server, so the merge of the two Bolts must be checked against these files.
- **`src/server/routes/orders.ts` and `src/server/repositories/orderRepo.ts`** — a repeated `placement_key` within the same visit now returns **200 with the existing order and publishes no event**, as `contract-summary.md` requires. Before, it returned 201 and published `ORDER_PLACED` again, so the kitchen board could show the same order twice. `orderRepo.ts` marks that case with `isDuplicate`.
- **`src/server/sse.ts`** — the live-update stream also accepts the last event id as a `?lastEventId=` query parameter (besides the `Last-Event-ID` header). The diner hook needs it to replay missed events after it reconnects, because it opens a new `EventSource` on reconnect and cannot set that header. This is an **additive extension** to the contract, decided by the team at the Unit's review; it is noted in `contract-summary.md`.
- **`src/server/__tests__/api.test.ts`** — the repeated-order test now asserts 200 with the same `order_number` (see Bug 7).

### Tests
- **Unit tests:** 78 passing across 11 test files in this worktree (vitest + React Testing Library); 51 of them are this Unit's client tests.
- **E2E tests:** `e2e/u2-diner-screens/diner.spec.ts` — 6 flows (browse+add, place order, repeated placement_key shows the existing order, status updates, TABLE_CLOSED, keyboard navigation). `e2e/u2-diner-screens/mockup-match.spec.ts` — 4 mockup-match checks (the tab-bar check also asserts the Cart count badge) with screenshots saved to `test-results/mockup-match/u2-diner-screens/`.

## Bugs found by the tests and fixed

### Bug 1 — `@testing-library/jest-dom` v7 not extending vitest's `expect`
- **What went wrong:** `src/test-setup.ts` imported jest-dom as a side effect (`import '@testing-library/jest-dom'`). v7 calls the global `expect.extend()` which does not exist in vitest's Node environment, so all matcher assertions threw `ReferenceError: expect is not defined`.
- **Fix location:** `src/test-setup.ts` — replaced the side-effect import with an explicit extend: `import { expect } from 'vitest'; import * as matchers from '@testing-library/jest-dom/matchers'; expect.extend(matchers);`
- **Regression test:** `src/client/hooks/__tests__/useTableSSE.test.ts` — first test (`connects and updates lastEvent`) uses `toBeInTheDocument()` and would fail without the fix.

### Bug 2 — `MessageEvent.lastEventId` is read-only
- **What went wrong:** `useTableSSE.test.ts` used `Object.assign(ev, { lastEventId })` to set the `lastEventId` property on a `MessageEvent`, which threw `TypeError: Cannot set property lastEventId of #<MessageEvent> which has only a getter`.
- **Fix location:** `src/client/hooks/__tests__/useTableSSE.test.ts` — changed to `new MessageEvent(type, { data: JSON.stringify(data), lastEventId })` so the value is passed through the constructor.
- **Regression test:** `useTableSSE.test.ts` — test "replays from Last-Event-ID on reconnect" exercises this path.

### Bug 3 — Cart badge in `TableView` not updating after `addItem` in `MenuScreen`
- **What went wrong:** `TableView` holds its own `useCart` instance for the badge count. Because `useCart` stores in `localStorage` but React state is per-instance, the `TableView` instance never saw items added by `MenuScreen`'s instance.
- **Fix location:** `src/client/hooks/useCart.ts` `saveItems()` — added `window.dispatchEvent(new CustomEvent('cart-updated', { detail: { tableId } }))` after every write. Each `useCart` instance listens for this event and reloads items from storage.
- **Regression test:** `e2e/u2-diner-screens/diner.spec.ts` — Flow 1 "Browse menu, add item, cart badge updates" asserts the tab badge shows `1` after adding an item.

### Bug 4 — `cart-empty` element hidden after a successful order
- **What went wrong:** `CartScreen` conditionally showed the empty-cart state only when `orderStatus !== 'success'`, so after a successful order (which calls `clearCart()`) the empty state was not rendered, causing the E2E test to time out.
- **Fix location:** `src/client/screens/diner/CartScreen.tsx` — removed the `orderStatus !== 'success'` guard so `cart-empty` renders whenever `items.length === 0`.
- **Regression test:** `src/client/screens/diner/__tests__/CartScreen.test.tsx` — "On POST success: cart cleared, success banner shown" checks both the success banner and that the place-order button is disabled (which requires the empty state to render).

### Bug 5 — Menu items not showing because `category_id` vs category name mismatch
- **What went wrong:** `MenuScreen` filtered items by `item.category === cat.name` (string names). The API returns `category_id` values like `c-01`, `c-02`, not names. No items matched, so all category sections were empty.
- **Fix location:** `src/client/screens/diner/MenuScreen.tsx` — changed filtering to `item.category_id === cat.id || item.category === cat.name` and loads categories from the API response (`data.categories`) instead of using only the hardcoded fallback.
- **Regression test:** `e2e/u2-diner-screens/diner.spec.ts` — Flow 1 looks for `add-item-` buttons; they only appear when items are correctly filtered into their category sections.

### Bug 6 — `placementKey` reset to null in `cart-updated` event handler
- **What went wrong:** The initial `cart-updated` listener also called `setPlacementKey(loadPlacementKey(tableId))`. Because sessionStorage is written asynchronously after the React state update, the listener read `null` from sessionStorage and reset the placement key, causing duplicate-order protection to fail.
- **Fix location:** `src/client/hooks/useCart.ts` event handler — removed the `setPlacementKey` call; the handler only calls `setItems(loadItems(tableId))`.
- **Regression test:** `src/client/hooks/__tests__/useCart.test.ts` — "placement_key is reused on subsequent addItem calls" asserts the key stays the same after a second add.

### Bug 7 — a repeated order was answered 201 and announced twice
- **What went wrong:** the server returned 201 and published `ORDER_PLACED` again when the same `placement_key` came in twice. The contract says 200 with the existing order. An earlier attempt to satisfy a code-review finding switched it to 409, which the contract does not allow and which broke the browser test.
- **Fix location:** `src/server/routes/orders.ts` (200, existing order, no event) and `src/server/repositories/orderRepo.ts`.
- **Regression test:** `src/server/__tests__/api.test.ts` — "regression: duplicate placement_key returns 200 with the existing order, not 409". Checked to fail without the fix.

### Bug 8 — My orders showed "$NaN" for every line
- **What went wrong:** `MyOrdersScreen` read `line.unit_price_cents`, a field the order API does not send. The API sends `price_cents_each` and `subtotal_cents`. The unit tests used the same wrong field name, so they passed.
- **Fix location:** `src/client/screens/diner/MyOrdersScreen.tsx` (lines 7–10 and the price cell) — it now shows `subtotal_cents`. The test data in `MyOrdersScreen.test.tsx` uses the contract's field names.
- **Regression test:** `src/client/screens/diner/__tests__/MyOrdersScreen.test.tsx` — "regression: line prices use the contract fields and never show $NaN".

### Bug 9 — no "Order #N placed" message after placing an order
- **What went wrong:** `TableView` switched to My orders as soon as the order went through, and the success banner lived inside the Cart screen, which disappeared with the switch. The design asks for a toast "Order #N placed" for 3 seconds on the way to My orders.
- **Fix location:** `src/client/screens/diner/CartScreen.tsx` (passes the order number up) and `src/client/views/TableView.tsx` (shows the toast or the sold-out banner for 3 seconds).
- **Regression test:** `e2e/u2-diner-screens/diner.spec.ts` — Flow 2 now checks the toast text and that the diner lands on My orders. These browser flows had been passing against an out-of-date build of the app; they now run against a fresh build.

## Final test counts

| Suite | Files | Tests | Result |
|---|---|---|---|
| Unit (vitest), whole worktree | 11 | 78 | All passed |
| E2E (Playwright), whole worktree | 3 | 15 (10 are this Unit's) | All passed |
| Swarm convergence | — | — | `"converged": true` |
