# Component Inventory

Each heading is a component name; the Scope of Analysis block in `reverse-engineering-timestamp.md` lists these names literally.

## Server

### Express App Entry
`src/server/index.ts` (57 lines). Builds and exports `app`; mounts `/api` routers and `/sse`; serves `dist/`; SPA catch-all; starts listening only as the process entry point (after `seedIfEmpty()`). Depends on: Database Module, Menu Router, Orders Router, Billing Router, SSE Router.

### Database Module
`src/server/db.ts` (155 lines). SQLite singleton `getDb()` (file from `DB_FILE`, WAL, foreign keys), `resetDb()` for tests, `initSchema` (7 tables), `seedIfEmpty`, `openVisit`, `getCurrentVisit`, `nextOrderNumber`. Depends on: better-sqlite3, Node `crypto`.

### SSE Hub
`src/server/sse.ts` (171 lines). `subscribe(channel, res)`, `publish(channel, type, data)`, `sendEvent` (single connection), ring buffers (60), replay, keep-alive timer (20 s), `_resetForTest`. In-memory only. Depends on: Express types.

### Menu Router
`src/server/routes/menu.ts`. `GET /api/menu`, `POST /api/menu/items/:id/availability`; publishes availability to every table channel and `staff`. Depends on: Menu Repository, SSE Hub, Database Module.

### Orders Router
`src/server/routes/orders.ts` (214 lines). Place order, list orders of the current visit, transition, table status. Validates input and maps error codes. Depends on: Order Repository, Table Repository, Database Module, SSE Hub, Route Param Helpers.

### Billing Router
`src/server/routes/billing.ts`. `GET /api/tables/:id/bill`, `POST /api/tables/:id/close`; publishes `TABLE_CLOSED`. Depends on: Billing Repository, SSE Hub, Route Param Helpers.

### SSE Router
`src/server/routes/sse.ts`. `GET /sse/staff`, `GET /sse/tables/:id`. Depends on: SSE Hub, Route Param Helpers.

### Route Param Helpers
`src/server/routes/tableId.ts`. `parseTableId`, `parseOrderNumber`, `unknownTable`, `unknownOrder`.

### Order Repository
`src/server/repositories/orderRepo.ts` (261 lines). `placeOrder` (idempotency, sold-out dropping, price freezing), `transitionOrder` with `LEGAL_TRANSITIONS`, `getOrdersByVisit`, `getOrderByNumber`, `getOrOpenVisit`; `OrderError`. Depends on: Database Module.

### Billing Repository
`src/server/repositories/billingRepo.ts`. `buildBill` (read only), `closeTable` (immediate transaction), `BillingError`. Depends on: Database Module, Order Repository, Table Repository.

### Table Repository
`src/server/repositories/tableRepo.ts`. `getTableStatus`, `openVisit`, `closeCurrentVisit`, `hasClosedVisit`, `closeVisit`. Depends on: Database Module.

### Menu Repository
`src/server/repositories/menuRepo.ts`. `getMenu`, `updateItemAvailability`. Depends on: Database Module.

## Client

### App Router
`src/client/main.tsx` and `src/client/App.tsx`. React 18 root in StrictMode, imports `index.css`, `BrowserRouter` with routes `/table/:id`, `/staff/*`, redirects to `/staff`. Depends on: TableView, StaffView.

### Global Stylesheet
`src/client/index.css` (331 lines). Dark-only design tokens in `:root`, reduced-motion block, body background, button feedback, keyframes and utility classes (see `architecture.md` Styling Approach).

### TableView
`src/client/views/TableView.tsx` (336 lines). Diner shell: header with live dot, tab state, order confirmation banners, sticky "View cart" bar, table-closed handling (live event plus on-load and on-reconnect check of `last_closed_visit_id`), reconnect banner. Depends on: useTableSSE, useCart, DinerTabBar, TableClosedTakeover, MenuScreen, CartScreen, MyOrdersScreen.

### StaffView
`src/client/views/StaffView.tsx`. Staff layout and nested routes: index = Kitchen Board, `tables/:id` = Table Bill. No access control.

### MenuScreen
`src/client/screens/diner/MenuScreen.tsx` (497 lines). Fetches `/api/menu`, sticky category pills with IntersectionObserver highlight, item cards (emoji or image URL, "+ Add" pill with 44 px target, "Sold out"), live availability updates, cart price refresh. Depends on: useCart.

### CartScreen
`src/client/screens/diner/CartScreen.tsx` (370 lines). Cart lines with quantity controls, Clear all, price refresh notice on open, confirm modal, order submit with placement key, error banner, empty state. Depends on: useCart, ConfirmModal.

### MyOrdersScreen
`src/client/screens/diner/MyOrdersScreen.tsx` (375 lines). Lists the visit's orders with status pill (icon and word), re-fetches on `ORDER_PLACED` and `ORDER_STATUS_CHANGED`, cancel flow with confirm and 422 notice.

### KitchenBoardScreen
`src/client/screens/staff/KitchenBoardScreen.tsx` (227 lines). Grid of table cards (`TableSection`), shimmer, empty state, reconnect banner, "Menu availability" button, link "Table <n> →" to the bill. Depends on: useBoardOrders, OrderCard, MenuAvailabilityPanel.

### TableBillScreen
`src/client/screens/staff/TableBillScreen.tsx` (210 lines). Bill view, empty, loading and error states, Close table flow with confirm and error mapping, redirect to `/staff` on close. Depends on: useBill, BillOrderCard, BillTotal, CloseTableSection, ConfirmModal, money.

### DinerTabBar
`src/client/components/diner/DinerTabBar.tsx`. Fixed bottom `nav` with Menu, Cart (count badge), My orders; sliding indicator; `aria-label="Diner navigation"`.

### TableClosedTakeover
`src/client/components/diner/TableClosedTakeover.tsx`. Full-screen `alertdialog` with animated check mark, shown on table close.

### ConfirmModal
`src/client/components/ConfirmModal.tsx` (169 lines). Portal modal with focus trap, Escape to cancel, focus restore. Used by CartScreen (place order, clear cart), MyOrdersScreen (cancel), TableBillScreen (close table).

### OrderCard
`src/client/components/staff/OrderCard.tsx` (248 lines). Kitchen order card with status pill, lines, Start preparing, Complete, Cancel with inline confirm; posts transitions with `by: 'staff'`.

### BillOrderCard
`src/client/components/staff/BillOrderCard.tsx`. One order on the bill with status pill, placed time, lines and subtotal.

### BillTotal
`src/client/components/staff/BillTotal.tsx`. "Combined total" row.

### CloseTableSection
`src/client/components/staff/CloseTableSection.tsx`. Close table button (44 px min height) and the note naming blocking orders.

### MenuAvailabilityPanel
`src/client/components/staff/MenuAvailabilityPanel.tsx` (227 lines). Slide-in dialog with focus trap and Escape; toggles item availability.

### NewHighlight
`src/client/components/staff/NewHighlight.tsx`. Glow wrapper and "new" label for fresh Pending orders, reduced-motion aware.

### money helpers
`src/client/components/staff/money.ts`. `formatMoney(cents)` and `formatPlacedTime(iso)`. Other screens use their own local `formatPrice`.

### useTableSSE
`src/client/hooks/useTableSSE.ts`. EventSource for `/sse/tables/:id`, backoff 1, 2, 5, 10, 15 s, `lastEventId` query on reconnect, keeps newest 200 events with `seq`.

### useStaffSSE
`src/client/hooks/useStaffSSE.ts`. EventSource for `/sse/staff`; no manual backoff (relies on the browser's reconnect and the server's `retry: 2000`); one instance per consumer hook (the "shared" in its comment is per component tree usage; each hook that calls it opens its own connection).

### useCart
`src/client/hooks/useCart.ts` (314 lines). Cart in `localStorage`, placement key in `sessionStorage`, closed marker, `cart-updated` window event for same-tab sync, price refresh, max quantity 20.

### useBoardOrders
`src/client/hooks/useBoardOrders.ts` (212 lines). Loads tables 1 to 10, merges SSE events with in-flight fetches, "new" flag, removes a table on `TABLE_CLOSED`.

### useBill
`src/client/hooks/useBill.ts`. Loads the bill, re-fetches on this table's order events and on reconnect, flags `closed`.

### useMenuAvailability
`src/client/hooks/useMenuAvailability.ts`. Menu list for the panel, optimistic toggle with rollback, live availability patching.

## Test Assets

### Vitest Unit Suites
`src/server/__tests__/` (api, billing-api, billing, db, menu-availability, orderRepo, sse-hello, sse, tableClose, tableStatus) and `src/client/**/__tests__/` (ConfirmModal, DinerTabBar, TableClosedTakeover, BillOrderCard, BillTotal, CloseTableSection, MenuAvailabilityPanel, NewHighlight, OrderCard, six hooks, three diner screens, two staff screens, TableView). 322 tests passing at v1 sign-off.

### Playwright E2E Suites
`e2e/u1-walking-skeleton`, `u2-diner-screens`, `u3-kitchen-board`, `u4-bill-and-close` (flow specs plus mockup-match per unit), and `e2e/build-and-test` (board-to-bill link, keyboard-only journey, live update timing, motion, shared `helpers.ts`). About 50 tests; Chromium by default, Chrome and WebKit through the cross-browser config.
