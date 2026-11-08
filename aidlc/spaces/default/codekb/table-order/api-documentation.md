# API Documentation

All endpoints are internal to the app (same origin, no CORS, no authentication, no rate limiting, JSON bodies via `express.json()`). Errors always use `{ "error": { "code": "...", "message": "...", "details"?: {...} } }`. Source: `src/server/routes/*.ts` and `src/server/repositories/*.ts`.

## REST Endpoints (mounted at `/api`)

| # | Method and path | Purpose | Request | Success | Errors |
|---|---|---|---|---|---|
| 1 | `GET /api/menu` | Whole menu | none | 200 `{ categories:[{id,name,order}], items:[{id,category_id,name,description,image,price_cents,available:boolean}] }` (categories by `sort_order`, items by category then id) | 500 `INTERNAL_ERROR` |
| 2 | `POST /api/menu/items/:id/availability` | Mark an item sold out or back | `{ available: boolean }` | 200 the updated item | 400 `INVALID_REQUEST`; 404 `UNKNOWN_ITEM`. Publishes `MENU_AVAILABILITY_CHANGED` to `staff` and every `table:<n>`. No staff check. |
| 3 | `POST /api/tables/:id/orders` | Place an order | `{ placement_key: string (non-empty), lines: [{ menu_item_id: string, quantity: integer 1..20 }] }` (non-empty array) | 201 `{ order_number, status:'Pending', placed_at, lines:[{menu_item_id,name,quantity,price_cents_each,subtotal_cents}], dropped_lines:[{menu_item_id,reason:'SOLD_OUT_AT_SUBMIT'}] }`; 200 same shape when the placement key was already used in this visit (nothing published) | 400 `INVALID_REQUEST`, `EMPTY_ORDER` (also when every line was sold out), `INVALID_QUANTITY`, `UNKNOWN_ITEM`; 404 `UNKNOWN_TABLE`; 500. A closed table accepts the order and opens a new visit. |
| 4 | `GET /api/tables/:id/orders?visit=current` | Orders of the table's open visit | query `visit=current` (any other value or no open visit returns an empty list) | 200 `{ orders:[{order_number,status,placed_at,table_id,visit_id,lines[],subtotal_cents}] }` ordered by `placed_at` | 404 `UNKNOWN_TABLE`; 500 |
| 5 | `POST /api/orders/:order_number/transition` | Change an order's status | `{ to: 'Preparing'|'Completed'|'Cancelled', by: 'diner'|'staff' }` | 200 `{ order_number, status }`; publishes `ORDER_STATUS_CHANGED` | 400 `INVALID_ACTOR` (missing or unknown `by`), 400 `INVALID_REQUEST` (missing `to`); 404 `UNKNOWN_ORDER`; 422 `ILLEGAL_TRANSITION`; 500 |
| 6 | `GET /api/tables/:id` | Table status | none | 200 `{ id, visit_id|null, has_open_orders, has_any_orders, state:'active'|'closed', last_closed_visit_id|null }` | 404 `UNKNOWN_TABLE` |
| 7 | `GET /api/tables/:id/bill` | Bill for the open visit | none | 200 `{ table_id, orders:[{order_number,status,placed_at,lines:[... + image?],subtotal_cents}] (non-cancelled, placement order), combined_total_cents, close_available, blocking_orders:[n] }`; with no open visit: empty orders, total 0, `close_available:false` | 404 `UNKNOWN_TABLE`; 500 |
| 8 | `POST /api/tables/:id/close` | Close the table (archive the visit) | `{}` | 200 `{ closed:true, archived_visit_id }`; publishes `TABLE_CLOSED` | 404 `UNKNOWN_TABLE`; 409 `TABLE_ALREADY_CLOSED`; 422 `CLOSE_BLOCKED` (`details.blocking_orders:[n]`) or `TABLE_EMPTY`; 500 |

Path ids: `:id` and `:order_number` must match `^[1-9]\d*$`, otherwise 404 (`UNKNOWN_TABLE` / `UNKNOWN_ORDER`). Valid table ids in the seed are 1 to 10; any other number is 404 on routes that check the table (note `GET /api/tables/:id/orders` returns an empty list for an unseeded id because it does not check the table exists).

### Order status rules (`LEGAL_TRANSITIONS`)

| From | staff may go to | diner may go to |
|---|---|---|
| Pending | Preparing, Cancelled | Cancelled |
| Preparing | Completed, Cancelled | none |
| Completed | none | none |
| Cancelled | none | none |

### Order-number and idempotency rules

`order_number` comes from the global `order_counter` row. The pair `(table_id, visit_id, placement_key)` is unique; the client reuses its placement key across retries and gets a fresh key after a placed order or a table close.

## Live Event Streams (SSE, mounted at `/sse`)

| Path | Channel | Notes |
|---|---|---|
| `GET /sse/staff` | `staff` | every table's order, status, close and availability events; sends `HELLO {message:'Connected to staff channel'}` on connect |
| `GET /sse/tables/:id` | `table:<id>` | that table's order, status, close events and all availability events; 404 `UNKNOWN_TABLE` for a bad id; `HELLO {message:'Connected to table <id> channel'}` |

Each event is `id: <n>\nevent: <TYPE>\ndata: <json>\n\n`. Replay: send `Last-Event-ID` (header) or `?lastEventId=<n>` (the browser hooks use the query form because `EventSource` cannot set headers). Payloads are listed in `architecture.md` under Live Events. Only the browser's named-event listeners receive typed events.

## Client Routes (served by the SPA catch-all)

| Path | Screen |
|---|---|
| `/table/:id` | Diner: Menu, Cart, My orders tabs |
| `/staff` | Kitchen Board (with Menu availability panel) |
| `/staff/tables/:id` | Table Bill and Close table |
| `/` and unknown paths | redirect to `/staff` |

## Static Serving

`express.static(dist/)` then `GET *` -> `res.sendFile('index.html', { root: distDir })`. The catch-all returns HTML for any unmatched method-GET path, including mistyped `/api/...` GETs that no router handled (they return the SPA page, not a 404 JSON error).

## Test Hooks Exposed in the UI (`data-testid`, used by unit and e2e tests; v2 changes must keep or deliberately update them)

- App shell/diner: `tab-bar`, `tab-menu`, `tab-cart`, `tab-orders`, `cart-badge`, `menu-cart-summary`, `menu-view-cart`, `menu-place-order`, `reconnect-banner`, `order-success-banner`, `order-partial-banner`, `table-closed-takeover`
- Menu: `menu-screen`, `menu-loading`, `menu-error`, `menu-retry`, `category-pill-bar`, `category-pill-<lowercase name>`, `item-emoji-<id>`, `add-item-<id>`
- Cart/orders: `cart-screen`, `cart-empty`, `back-to-menu`, `clear-cart`, `cart-refresh-notice`, `order-error-banner`, `orders-screen`, `orders-loading`, `orders-empty`, `cancel-notice`
- Staff: `staff-view`, `kitchen-board` (attribute `data-sse` = connected/disconnected), `board-loading`, `board-empty`, `board-grid`, `table-section-<n>`, `table-ready-to-close-<n>`, `order-card-<n>`, `btn-preparing-<n>`, `btn-complete-<n>`, `btn-cancel-<n>`, `cancel-confirm-<n>`, `btn-cancel-confirm-<n>`, `btn-cancel-keep-<n>`, `table-bill-screen`, `bill-loading`, `bill-back-link`, `bill-order-<n>`, `bill-combined-total`, `btn-close-table`, `open-orders-note`
- Visible text that mockup-match specs check (changing it breaks v1 specs): tab labels "Menu", "Cart", "My orders"; "Kitchen Board", "Menu availability", "Updated live"; "Table <n> — Bill", "← Board", "Close table", "Combined total"; "Sold out"; "Order #<n> placed"; "Reconnecting… Updates will resume shortly."; "Your cart is empty"; "No orders yet"; "No open orders right now. Orders will appear here within 2 seconds of placement."
