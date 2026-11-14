# API Documentation: table-order

All JSON routes are mounted at `/api`; streams at `/sse`. Errors always use the envelope:

```json
{ "error": { "code": "UNKNOWN_TABLE", "message": "Table 99 not found", "details": { } } }
```

**Auth**: "Staff" means the `staff_session` cookie (HttpOnly, SameSite=Strict, Path=/, no expiry) must name a live session, else `401 UNAUTHORIZED`. A staff request refreshes the session's 12-hour idle timer, except opening `/sse/staff`. There is no rate limiting besides the PIN lockout, no CORS setup (same origin), and no roles.

Path ids: table ids and order numbers must be plain positive integers (`/^[1-9]\d*$/`); anything else is answered `404 UNKNOWN_TABLE` or `404 UNKNOWN_ORDER`.

## Staff sign-in (`routes/staff.ts`)

| Method and path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/staff/login` | open | `{ pin: "1234" }` | `204`, `Set-Cookie: staff_session=...` | `401 INVALID_PIN` (`details.tries_left`), `429 LOCKED` (`details.retry_after_seconds`, `Retry-After` header) |
| `POST /api/staff/logout` | open | none | `204`, cookie cleared, session's streams closed | `401 UNAUTHORIZED` when the session had already ended (cookie still cleared) |
| `GET /api/staff/session` | staff | none | `200 { signed_in: true }` | `401` |

The guard `router.use('/staff', requireStaff())` in this module protects every later `/api/staff/*` route.

## Menu (`routes/menu.ts`, `routes/staff-menu.ts`)

| Method and path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/menu` | open | none | `{ categories: [{id,name,order}], items: [{id,category_id,name,description,image,price_cents,available,station,allergens,options}] }` (hidden left out) | `500` |
| `POST /api/menu/items/:id/availability` | staff | `{ available: boolean }` | the item | `400 INVALID_REQUEST`, `404 UNKNOWN_ITEM` |
| `GET /api/staff/menu` | staff | none | as `/api/menu` plus `hidden` on items and categories, hidden ones included | |
| `POST /api/staff/menu/items` | staff | `{ name, price_cents, category_id, description?, image?, station?, allergens?, hidden? }` | `201` item | `400 INVALID_REQUEST` with `details.field` |
| `PATCH /api/staff/menu/items/:id` | staff | any item fields, optional `options` groups | item | `400`, `404 UNKNOWN_ITEM` |
| `PUT /api/staff/menu/items/:id/options` | staff | `{ groups: [{id?, name, kind: one\|any\|leave_out, required?, choices: [{id?, label, price_delta_cents}]}] }` | `{ item_id, options }` | `400`, `404` |
| `POST /api/staff/menu/categories` | staff | `{ name }` | `201` category | `400` |
| `PATCH /api/staff/menu/categories/:id` | staff | `{ name?, hidden?, move?: up\|down }` | category | `400`, `404 UNKNOWN_CATEGORY` |

Events: `MENU_AVAILABILITY_CHANGED { menu_item_id, available }`, `MENU_CHANGED { reason: item|category|options, ids }`, and `SPECIAL_CHANGED` when the live special changes as a side effect.

## Orders (`routes/orders.ts`)

| Method and path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/tables/:id/orders` | open | `{ placement_key, lines: [{ menu_item_id, quantity 1-20, option_ids?, special_id? }] }` (max 50 lines, 20 option ids per line) | `201 { order_number, status, placed_at, estimate_minutes, lines, dropped_lines }`; `200` same body for a repeated placement key | `400 INVALID_REQUEST`, `EMPTY_ORDER`, `INVALID_QUANTITY`, `UNKNOWN_ITEM`, `INVALID_OPTIONS`; `404 UNKNOWN_TABLE` |
| `GET /api/tables/:id/orders?visit=current\|last_closed` | open | none | `{ orders: [{ order_number, status, placed_at, table_id, visit_id, estimate_minutes, completed_at, lines, subtotal_cents }] }`; empty list without a visit | `404`, `500` |
| `POST /api/orders/:order_number/transition` | `by=diner` open; `by=staff` staff | `{ to, by: diner\|staff }` | `{ order_number, status }` | `400 INVALID_ACTOR` / `INVALID_REQUEST`, `401`, `404 UNKNOWN_ORDER`, `422 ILLEGAL_TRANSITION` |
| `GET /api/tables/:id` | open | none | `{ id, visit_id, has_open_orders, has_any_orders, state: active\|closed, last_closed_visit_id }` | `404` |

Line shape: `{ menu_item_id, name, quantity, price_cents_each, subtotal_cents, station, options: [{label, price_delta_cents}], special_id? }`. `dropped_lines[].reason`: `SOLD_OUT_AT_SUBMIT`, `SPECIAL_SOLD_OUT`, `OPTION_UNAVAILABLE`.

Events: `ORDER_PLACED { order_number, table_id, visit_id, status, placed_at, estimate_minutes, lines, total_cents }`; `ORDER_STATUS_CHANGED { order_number, table_id, status, completed_at? }`.

## Billing and receipts (`routes/billing.ts`)

| Method and path | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/tables/:id/bill` | staff | `{ table_id, orders: [{order_number,status,placed_at,lines,subtotal_cents}], combined_total_cents, close_available, blocking_orders, payment_method, receipt_requested }` (Cancelled left out; current visit only) | `404`, `500` |
| `POST /api/tables/:id/close` | staff | `200 { closed: true, archived_visit_id }` | `404`, `409 TABLE_ALREADY_CLOSED`, `422 CLOSE_BLOCKED` (`details.blocking_orders`), `422 TABLE_EMPTY` |
| `GET /api/visits/:visitId/receipt` | staff | `{ visit_id, table_id, table_label, opened_at, closed_at, orders, total_cents, payment_method, receipt_requested }` | `404 UNKNOWN_VISIT`, `409 VISIT_NOT_CLOSED` |
| `GET /api/tables/:id/receipt` | open | receipt of the table's last closed visit | `404 NO_CLOSED_VISIT` |

Event: `TABLE_CLOSED { table_id, archived_visit_id }`.

## Service calls (`routes/calls.ts`)

| Method and path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/tables/:id/calls` | open | none | `{ calls: [{id,kind,status,opened_at,responded_at,payment_method,wants_receipt}] }` | `404` |
| `POST /api/tables/:id/calls` | open | `{ kind: waiter\|bill, payment_method?: cash\|card, wants_receipt?: boolean }` | `201` new or `200` existing open call | `400 INVALID_KIND`, `INVALID_PAYMENT_METHOD`, `INVALID_WANTS_RECEIPT`; `404`; `409 NO_OPEN_VISIT` |
| `POST /api/service-calls/:id/respond` | staff | none | `{ id, status }` (repeat is `200` unchanged) | `404 UNKNOWN_CALL` |

Events: `SERVICE_CALL_OPENED { call_id, table_id, kind, opened_at, payment_method?, wants_receipt? }`, `SERVICE_CALL_RESPONDED { call_id, table_id, kind, responded_at }`.

## Chef's special (`routes/specials.ts`)

| Method and path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/specials/current` | open | none | `{ special: {id,item_id,name,special_price_cents,stock_left,ends_at} \| null }` | `500` |
| `POST /api/specials` | staff | `{ item_id, special_price_cents, stock 1-999, minutes 1-720 }` | `201` special (ends any live one) | `400 INVALID_REQUEST` (`details.field`) |
| `DELETE /api/specials/current` | staff | none | `204` | |

Event: `SPECIAL_CHANGED { special | null }` to staff and every table.

## Ratings, presence, estimate

| Method and path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/tables/:id/ratings` | open | `{ visit_id, ratings: [{item_id, thumb: up\|down}], done?, comment? }` | `{ saved }` | `400 INVALID_REQUEST`, `INVALID_RATING`, `INVALID_COMMENT`, `ITEM_NOT_IN_VISIT`; `404`; `409 VISIT_NOT_CLOSED`, `RATING_LOCKED` |
| `POST /api/tables/:id/presence` | open | `{ page_id }` (8-64 letters, digits, hyphens) | `204` | `400`, `404` |
| `GET /api/estimate?table=<n>` | open | none | `{ estimate_minutes, basis: today\|default, open_orders }` | `404` |

## Staff operations (U7 modules, all staff)

| Method and path | Success | Errors |
|---|---|---|
| `GET /api/staff/stations/:station/board` | `{ station, orders: [{ order_number, table_id, status, placed_at, lines: [{menu_item_id,name,quantity,options}], other_stations: [{station, state: done\|waiting}] }] }` (open orders with lines for the station and no done mark) | `404 UNKNOWN_STATION` |
| `POST /api/staff/orders/:order_number/stations/:station/done` | `{ order_number, status, stations_done, stations_remaining }` | `404 UNKNOWN_STATION`, `UNKNOWN_ORDER`; `422 NO_LINES_FOR_STATION`, `ILLEGAL_TRANSITION` |
| `GET /api/staff/tables` | `{ tables: [{ id, label, state: needs_bill\|waiting\|eating\|browsing\|empty, connected, last_activity_at, open_calls: [{id,kind,opened_at}] }] }` (archived tables left out) | |
| `POST /api/staff/tables` | `201 { id, label }` (body `{ label? }`, at most 30 characters) | `400 INVALID_LABEL`, `409 TOO_MANY_TABLES` (50) |
| `DELETE /api/staff/tables/:id` | `{ id, label }` (archived) | `400`, `404 UNKNOWN_TABLE`, `409 TABLE_IN_USE` |
| `GET /api/staff/sales?from=YYYY-MM-DD&to=YYYY-MM-DD` | `{ days: [{ day, visits, orders, total_cents, average_minutes \| null, average_per_visit_cents, best_sellers: [{item_id,name,quantity}] (top 5) }] }` newest first | `400 INVALID_REQUEST` (`details.field`) |
| `GET /api/staff/ratings?day=YYYY-MM-DD` | `{ day, best: [...], worst: [...], tie_rule }` (top 3 each; default today) | `400` |
| `GET /api/staff/qr/:table` | always `501 NOT_BUILT` (dead stub) | `401` |

Event: `STATION_DONE { order_number, table_id, station, remaining }`.

### Sales semantics (important for any takings figure)

`getSales()` (`src/server/routes/u7/sales.ts`):
- Only visits with `closed_at` set count; the day is the server-local calendar day of `closed_at`
- Every line of every non-Cancelled order of those visits counts at its frozen price (`quantity * unit_price_cents`)
- `orders` counts distinct non-Cancelled orders, including orders with no lines
- `average_minutes` is the mean of `completed_at - placed_at` over Completed orders, rounded to 0.1, or `null`
- `best_sellers` ranks by quantity, ties by name, top 5
- Open tables contribute nothing until they are closed

## Live event streams (`routes/sse.ts`, `sse.ts`)

| Stream | Auth | Notes |
|---|---|---|
| `GET /sse/staff` | staff (does not refresh idle) | Closed on sign-out, idle end, or at the next keep-alive after the session is gone |
| `GET /sse/tables/:id[?page=<id>]` | open | Counts as a present diner page for a known table |

Wire format: `retry: 2000` once, then `id: <n>\nevent: <TYPE>\ndata: <json>\n\n`; a per-connection `HELLO` without id; `: keep-alive` comment every 20 s. Each channel keeps its last 60 events; a reconnect with `Last-Event-ID` (header or `lastEventId` query) replays newer ones. Ids start from the server start time in milliseconds, so they keep rising across restarts.

| Event | Channels | Payload |
|---|---|---|
| `ORDER_PLACED` | staff, `table:<id>` | see Orders |
| `ORDER_STATUS_CHANGED` | staff, `table:<id>` | `{ order_number, table_id, status, completed_at? }` |
| `TABLE_CLOSED` | staff, `table:<id>` | `{ table_id, archived_visit_id }` |
| `MENU_AVAILABILITY_CHANGED` | staff, every table | `{ menu_item_id, available }` |
| `MENU_CHANGED` | staff, every table | `{ reason, ids }` |
| `SPECIAL_CHANGED` | staff, every table | `{ special \| null }` |
| `SERVICE_CALL_OPENED` | staff, `table:<id>` | see Service calls |
| `SERVICE_CALL_RESPONDED` | staff, `table:<id>` | see Service calls |
| `STATION_DONE` | staff | `{ order_number, table_id, station, remaining }` |
| `TABLE_PRESENCE_CHANGED` | staff | `{ table_id, connected, last_activity_at }` |

The browser registers listeners only for names in `src/client/hooks/eventNames.ts` (`EVENT_NAMES`, plus `TABLE_STATUS_CHANGED` for staff, which nothing publishes). A new event type must be added there.

## Internal (in-process) interfaces worth knowing

| Function | File | Use |
|---|---|---|
| `publish(channel, type, data)` | `src/server/sse.ts` | Fan an event out; call after the write |
| `requireStaff({ refresh })` | `src/server/staffAccess.ts` | Guard a route outside `/api/staff` |
| `transitionOrder(n, to, by)` | `src/server/repositories/orderRepo.ts` | The only status change |
| `getCurrentVisit(tableId)` | `src/server/db.ts` | Newest open visit by parsed time |
| `parseStoredTime(text)` | `src/shared/time.ts` | Read either stored time format |
| `localDayBounds(now)` / `localDay(date)` | `src/server/time.ts`, `routes/u7/sales.ts` | Server-local day |
| `computeEstimate()` | `src/server/services/waitEstimation.ts` | Current wait estimate |
| `staffFetch(url, init)` | `src/client/staff/staffAuth.ts` | Every browser staff request |
| `useLiveRead(url, events)` | `src/client/staff/pages/useLiveRead.ts` | Read and re-read on events and reconnect |
| `useStaffSSE()` | `src/client/hooks/useStaffSSE.ts` | Shared staff stream |
