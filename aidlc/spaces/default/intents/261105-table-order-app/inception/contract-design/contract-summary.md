# Contract Summary — Table Order Web App

**Based on:** `unit-of-work.md` and `unit-of-work-dependency.md` from `inception/units-generation/`, `components.md` from `inception/domain-design/`, `requirements.md` from `inception/requirements-analysis/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Scope and principles

- **No public API.** The server is reachable only from the two screen apps running on the same machine. The contracts here are the internal boundaries between Units that allow parallel builds. [desc], [NFR3]
- **Protocol:** HTTP + JSON for commands and queries; Server-Sent Events for live updates. [desc]
- **Ownership:**
  - U1 `u1-walking-skeleton` owns every HTTP contract, the SSE stream, the error shape, the retry-safe placement key, and reconnect behaviour. These contracts are frozen when U1 is signed off so U2/U3/U4 can build against them without churn.
  - U4 `u4-bill-and-close` owns the Billing endpoints (`GET /api/tables/:id/bill`, `POST /api/tables/:id/close`).
- **Compatibility:** Changes are additive during the workshop. A later Bolt never breaks an earlier Bolt's contract; it only extends it with new fields or new endpoints.
- **Live updates:** Clients subscribe to one channel per URL. Reconnect is automatic via the `EventSource` API, and the server replays events from the ring buffer when the client sends `Last-Event-ID`. [FR4.1], [FR4.2]

---

## Shared shapes

### Error envelope (returned by every failed HTTP call)

```json
{
  "error": {
    "code": "SOLD_OUT_AT_SUBMIT",
    "message": "One or more items sold out before the order was placed.",
    "details": { "dropped_items": ["i-08"] }
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `error.code` | string | SCREAMING_SNAKE_CASE; one per failure mode (see the list per endpoint). |
| `error.message` | string | Human-readable, English. |
| `error.details` | object | Optional, failure-specific payload. Keys are stable per code. |

### Ids

- `table_id`: integer, 1..10 (from seed).
- `menu_item_id`: `i-01` .. `i-12`.
- `category_id`: `c-01` .. `c-04`.
- `order_number`: integer, monotonically increasing from 1, unique across the restaurant. [assumption]
- `visit_id`: UUID v4, opened when the first order at a table is placed, archived on close.

### Order status enum

`Pending` | `Preparing` | `Completed` | `Cancelled`. Forward-only transitions per ADR-003.

### Retry-safe placement key

- The client generates a UUID v4 `placement_key` per **Place order** click and includes it on every retry of the same click.
- The server deduplicates **within the same `(table_id, visit_id)` pair**: a POST with a `placement_key` the server has seen for that table's current visit returns the existing order and `201 Created` → `200 OK`.
- A `placement_key` used against a **different** `table_id` creates a new order. The key's uniqueness scope is `(table_id, visit_id, placement_key)`, so the same UUID is never treated as a duplicate across tables. Keys are purged when the visit is archived at close.

---

## HTTP API (owned by U1 unless noted)

All paths are relative to `http://localhost:<PORT>`. Every request and response body is `application/json`.

### Menu (served by component `Menu`)

#### `GET /api/menu`

Returns the catalogue with current availability.

**Response 200**
```json
{
  "categories": [
    { "id": "c-01", "name": "Starters", "order": 1 }
  ],
  "items": [
    {
      "id": "i-01",
      "category_id": "c-01",
      "name": "House salad",
      "description": "Mixed greens, cherry tomatoes",
      "image": "🥗",
      "price_cents": 450,
      "available": true
    }
  ]
}
```

#### `POST /api/menu/items/:id/availability`

Marks an item sold out or back on sale. U3 owns the staff action; U1 owns the endpoint.

**Request**
```json
{ "available": false }
```

**Response 200** returns the updated item.

**Error codes:** `UNKNOWN_ITEM`.

Publishes `MENU_AVAILABILITY_CHANGED` to the staff channel and every open diner channel.

---

### Tables

#### `GET /api/tables/:id`

**Response 200**
```json
{
  "id": 5,
  "visit_id": "7a7b-...-fe",
  "has_open_orders": true,
  "has_any_orders": true,
  "state": "active"
}
```

`state` is `active` or `closed`. For a closed table, `visit_id` is `null` and the flags are `false`.

---

### Ordering (owned by `Ordering`)

#### `POST /api/tables/:id/orders`

Places a new order at the table.

**Request**
```json
{
  "placement_key": "d02c-...-91",
  "lines": [
    { "menu_item_id": "i-04", "quantity": 2 },
    { "menu_item_id": "i-10", "quantity": 1 }
  ]
}
```

- `lines[].quantity` is 1..20. The server refuses 0 and 21+ with `INVALID_QUANTITY`.
- Sold-out lines are dropped at submit time; the response lists them.

**Response 201**
```json
{
  "order_number": 18,
  "status": "Pending",
  "placed_at": "2026-11-05T19:12:03Z",
  "lines": [
    { "menu_item_id": "i-04", "quantity": 2, "price_cents_each": 1050, "subtotal_cents": 2100 }
  ],
  "dropped_lines": [ { "menu_item_id": "i-08", "reason": "SOLD_OUT_AT_SUBMIT" } ]
}
```

**Response 200** returned for a duplicate `placement_key` within the same visit; body is the existing order.

**Error codes:** `EMPTY_ORDER`, `INVALID_QUANTITY`, `UNKNOWN_ITEM`, `TABLE_CLOSED`.

Publishes `ORDER_PLACED` to the staff channel and the table's channel.

#### `GET /api/tables/:id/orders?visit=current`

Returns every order at the current visit for "My orders" and the Kitchen Board.

#### `POST /api/orders/:order_number/transition`

Transitions an order's status.

**Request**
```json
{ "to": "Preparing", "by": "staff" }
```

- `by` is a required enum: `"diner"` | `"staff"`. The diner client (U2) sends `"diner"`; the staff client (U3) sends `"staff"`.
- Allowed transitions:
  - `by: "staff"`: `Pending → Preparing`, `Preparing → Completed`, `Pending → Cancelled`, `Preparing → Cancelled`.
  - `by: "diner"`: only `Pending → Cancelled`. Every other transition from a diner is refused with `ILLEGAL_TRANSITION`.
- Any transition not in the lists above is refused with `ILLEGAL_TRANSITION`.
- A missing or unrecognised `by` value is refused with `INVALID_ACTOR`.

**Response 200** returns the updated order.

**Error codes:** `UNKNOWN_ORDER`, `ILLEGAL_TRANSITION`, `INVALID_ACTOR`.

Publishes `ORDER_STATUS_CHANGED` to the staff channel and the table's channel.

---

### Billing (owned by U4 `u4-bill-and-close`)

#### `GET /api/tables/:id/bill`

Billing builds the bill by calling `Ordering.getOrdersForVisit(table_id, visit_id)` (an in-process call, not an HTTP round trip). Billing never writes to Ordering; it only reads.

**Response 200**
```json
{
  "table_id": 5,
  "orders": [
    {
      "order_number": 15,
      "status": "Completed",
      "placed_at": "2026-11-05T19:04:00Z",
      "lines": [
        { "menu_item_id": "i-04", "name": "Classic burger", "quantity": 2, "price_cents_each": 1050, "subtotal_cents": 2100 }
      ],
      "subtotal_cents": 2400
    }
  ],
  "combined_total_cents": 3500,
  "close_available": true,
  "blocking_orders": []
}
```

- `orders[].lines[].subtotal_cents` = `quantity * price_cents_each` for that line.
- `orders[].subtotal_cents` = sum of `lines[].subtotal_cents` for that order only.
- `combined_total_cents` = sum of `orders[].subtotal_cents` across every non-cancelled order on the bill.
- Cancelled orders are excluded from `orders[]`, from their order subtotal, and from `combined_total_cents`. [FR3.2]
- `close_available` is `false` when any order is Pending or Preparing, or when the visit has no orders at all. A visit whose orders were all Cancelled still has orders: its bill is empty (total 0) and `close_available` is `true`, so the table can always be closed. `blocking_orders` lists the order numbers that keep Close disabled. [FR3.3], [FR3.4]
- Additive extension (added at U4 Code Generation review, AI decision under the team's review rule): each `orders[].lines[]` entry may carry an optional `image` (the menu item's emoji, read from the catalogue) so the bill shows the same emoji as the S2 mockup. Prices and subtotals still come only from the stored order lines.
- For a table with no open visit, `GET` answers 200 with an empty `orders` list, a combined total of 0, `close_available: false` and no blocking orders; only an unknown table answers `UNKNOWN_TABLE` (404).

#### `POST /api/tables/:id/close`

Closes the table.

**Request**
```json
{}
```

**Response 200** returns `{ "closed": true, "archived_visit_id": "7a7b-...-fe" }`.

**Error codes:** `CLOSE_BLOCKED` (`details.blocking_orders` lists the open orders), `TABLE_EMPTY`, `TABLE_ALREADY_CLOSED`.

Publishes `TABLE_CLOSED` to the staff channel and the table's channel.

---

## Server-Sent Events (owned by `LiveUpdates`)

### Channels

| Channel | URL | Subscribers |
|---|---|---|
| `staff` | `GET /sse/staff` | Staff view at `/staff` and the Table Bill at `/staff/tables/:id`. |
| `table:<id>` | `GET /sse/tables/:id` | Diner views at `/table/:id`. |

### Framing

- `event: <type>` + `data: <json>` + `id: <ulid>`.
- `retry: 2000` is sent once on connection.

### Reconnect and catch-up

- Clients use the browser `EventSource`; the server honours `Last-Event-ID` and replays every event from the per-channel ring buffer since that id.
- Additive extension (added at U2 Code Generation review, team decision): the server also accepts the last event id as a `?lastEventId=<id>` query parameter on the stream URL, with the same replay. A client that opens a fresh `EventSource` after a drop cannot set the `Last-Event-ID` header, so the diner hook sends it this way. The header still works as described above.
- The ring buffer keeps one hour of events per channel. [assumption]
- A client with no `Last-Event-ID` does not receive history; the client is expected to call the matching HTTP endpoints to reconcile on first connect.

### Event types

| Type | Payload | Target channels |
|---|---|---|
| `ORDER_PLACED` | `{ "order_number", "table_id", "status", "placed_at", "lines": [ { "menu_item_id", "name", "quantity", "price_cents_each", "subtotal_cents" } ] }` — full payload, no follow-up fetch needed | staff + `table:<table_id>` |
| `ORDER_STATUS_CHANGED` | `{ "order_number", "table_id", "status" }` | staff + `table:<table_id>` |
| `MENU_AVAILABILITY_CHANGED` | `{ "menu_item_id", "available" }` | staff + every `table:*` |
| `TABLE_CLOSED` | `{ "table_id", "archived_visit_id" }` | staff + `table:<table_id>` |

`ORDER_PLACED` carries the full order payload so U3 (Kitchen Board) and U4 (bill) render from the event without a follow-up HTTP read.

All status words match the Order status enum. [NFR5]

### Delivery timing

- Each event is published to subscribers within **2 seconds** of its triggering HTTP call returning successfully. [FR4.1], [NFR1], [NFR2]

---

## Contract tests (Unit boundary coverage)

Contract tests live in U1 and run in every parallel Bolt against a locally-started server using the Bolt's own `E2E_PORT` and `DB_FILE`. [team: project.md > Testing Posture]

| Test | Boundary |
|---|---|
| `menu_shape.spec` | `GET /api/menu` returns 12 items, 4 categories, each with the fields above. |
| `order_place.spec` | `POST /api/tables/:id/orders` returns a monotonic order number; duplicate `placement_key` returns the same order; `INVALID_QUANTITY` for 0 and 21. |
| `order_transition.spec` | legal transitions succeed; illegal ones return `ILLEGAL_TRANSITION`; a diner cannot cancel a `Preparing` order. |
| `availability.spec` | toggling an item publishes `MENU_AVAILABILITY_CHANGED` and the diner's `GET /api/menu` reflects it. |
| `bill_shape.spec` | the bill groups orders, excludes cancelled, and sets `close_available` correctly. |
| `close.spec` | close succeeds only when no order is Pending or Preparing and at least one order exists; it publishes `TABLE_CLOSED`. |
| `sse_connect.spec` | an EventSource connected to `/sse/tables/5` receives a `ORDER_PLACED` within 2 seconds of a POST. |
| `sse_replay.spec` | reconnect with `Last-Event-ID` replays the missed event. |

## Assumptions

- Order numbers are unique across the restaurant. [assumption]
- Live updates keep one hour of events for catching up. [assumption]
- There is no public API; the server is reachable only on `localhost`. [desc], [NFR3]
- All currency amounts are expressed as integer `*_cents` fields to avoid floating-point drift; the UI formats using the design-system rule `$X.XX`. [Q2 of refined-mockups]
