# Contract Summary: Table Order v2

The agreements U5, U6 and U7 must keep so U6 and U7 can be built at the same time, each in its own copy of the project with only v1 and U5 in it. Built from the Units and their dependencies (`inception/units-generation/unit-of-work.md`, `unit-of-work-dependency.md`), the component catalogue (`inception/domain-design/components.md`), the requirements (`inception/requirements-analysis/requirements.md`) and your two answers: the staff sign-in is a cookie the server sets that page scripts cannot read (Q1), and v1's tests that call staff actions are updated to sign in, each listed under "v1 tests changed" (Q2).

There are no outside systems or public APIs. The only boundary that reaches outside the app is the table address a QR code points to (contract 8). v1's routes and fields are never removed or renamed; all changes below are additive, except the staff guard, which is on the "Changes to v1" list.

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| 1 | U5 | U6 (diner screens) | Synchronous REST (diner routes, open to everyone) | U5 |
| 2 | U5 | U7 (staff screens) | Synchronous REST (staff sign-in and the shared staff routes, behind the staff session) | U5 |
| 3 | U7 | U7's own staff pages | Synchronous REST (staff-only routes that only U7 uses, behind the staff session); listed so U5 knows what it must leave alone | U7 |
| 4 | U5 | U6 and U7 | Live events (Server-Sent Events, named events) | U5 |
| 5 | U5 | U6 and U7 | Shared database schema (additive) | U5 |
| 6 | U5 | U6 and U7 | Shared design tokens and theme switch | U5 |
| 7 | U5 | U6 and U7 | Code seams: registries and folders each Unit fills | U5 |
| 8 | U7 | External: a phone's camera app | The table address a QR code holds | U7 |
| 9 | U5 | U6 and U7 | Test helpers that let each Unit drive the other's side | U5 |
| 10 | U6 and U7 | each other | No code. They meet only through contracts 1, 2, 4 and 5 (see "How U6 and U7 Meet") | U5 |

## Contract 1: Diner routes (U5 to U6), OpenAPI

Open to everyone (no staff session). Every response keeps v1's error shape `{ "error": { "code", "message", "details"? } }`. New fields and routes are additive; a consumer ignores fields it does not know.

```yaml
openapi: 3.0.3
info: { title: "Table Order v2, diner routes", version: "2.0" }
paths:
  /api/menu:
    get:
      summary: The menu the diner sees (v1 route, extended). Hidden items and categories are left out.
      responses:
        "200":
          description: categories and items
          content:
            application/json:
              schema:
                type: object
                properties:
                  categories: { type: array, items: { type: object, properties: { id: {type: string}, name: {type: string}, order: {type: integer} } } }
                  items:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        category_id: { type: string }
                        name: { type: string }
                        description: { type: string }
                        image: { type: string }
                        price_cents: { type: integer }
                        available: { type: boolean }
                        station: { type: string, enum: [Grill, Cold, Bar, Desserts], description: "NEW; Grill when none set" }
                        allergens: { type: array, nullable: true, items: { type: string, enum: [gluten, dairy, eggs, peanuts, tree_nuts, fish, shellfish, soy, sesame] }, description: "NEW; null means not set, [] means none" }
                        options:
                          type: array
                          description: "NEW; option groups"
                          items:
                            type: object
                            properties:
                              id: { type: string }
                              name: { type: string }
                              kind: { type: string, enum: [one, any, leave_out] }
                              required: { type: boolean }
                              choices: { type: array, items: { type: object, properties: { id: {type: string}, label: {type: string}, price_delta_cents: {type: integer} } } }
  /api/tables/{id}/orders:
    post:
      summary: Place an order (v1 route, extended). Idempotent by placement_key, as v1.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [placement_key, lines]
              properties:
                placement_key: { type: string }
                lines:
                  type: array
                  items:
                    type: object
                    required: [menu_item_id, quantity]
                    properties:
                      menu_item_id: { type: string }
                      quantity: { type: integer, minimum: 1, maximum: 20 }
                      option_ids: { type: array, items: { type: string }, description: "NEW; chosen option choice ids" }
                      special_id: { type: string, description: "NEW; present when the line is the Chef's special" }
      responses:
        "201":
          description: placed (200 with the same body when the placement_key was used before)
          content:
            application/json:
              schema:
                type: object
                properties:
                  order_number: { type: integer }
                  status: { type: string, enum: [Pending] }
                  placed_at: { type: string }
                  estimate_minutes: { type: integer, description: "NEW; the estimate shown at placement, kept on the order" }
                  lines: { type: array, items: { type: object, properties: { menu_item_id: {type: string}, name: {type: string}, quantity: {type: integer}, price_cents_each: {type: integer, description: "item price plus chosen options"}, subtotal_cents: {type: integer}, station: {type: string}, options: { type: array, items: { type: object, properties: { label: {type: string}, price_delta_cents: {type: integer} } } } } } }
                  dropped_lines: { type: array, items: { type: object, properties: { menu_item_id: {type: string}, reason: { type: string, enum: [SOLD_OUT_AT_SUBMIT, SPECIAL_SOLD_OUT, OPTION_UNAVAILABLE] } } } }
        "400": { description: "INVALID_REQUEST, EMPTY_ORDER, INVALID_QUANTITY, UNKNOWN_ITEM, and NEW: INVALID_OPTIONS (a required group missing, a choice that does not belong to the item, or two choices in a choose-one group)" }
        "404": { description: UNKNOWN_TABLE }
    get:
      summary: Orders of the open visit (v1 route, extended)
      parameters: [ { name: visit, in: query, schema: { type: string, enum: [current] } } ]
      responses:
        "200":
          description: "each order gains estimate_minutes (nullable), completed_at (nullable) and, per line, station and options"
  /api/tables/{id}:
    get:
      summary: Table status (v1 route, unchanged shape; last_closed_visit_id is used by Rate your meal)
      responses: { "200": { description: ok } }
  /api/estimate:
    get:
      summary: NEW. The estimated wait for an order about to be placed
      parameters: [ { name: table, in: query, required: true, schema: { type: integer } } ]
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  estimate_minutes: { type: integer, description: "whole minutes, at least 1" }
                  basis: { type: string, enum: [today, default], description: "default means no order has completed today; the starting value is 15" }
                  open_orders: { type: integer }
  /api/specials/current:
    get:
      summary: NEW. The live Chef's special, or null
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  special:
                    nullable: true
                    type: object
                    properties: { id: {type: string}, item_id: {type: string}, name: {type: string}, special_price_cents: {type: integer}, stock_left: {type: integer}, ends_at: {type: string, description: "ISO 8601 UTC"} }
  /api/tables/{id}/calls:
    get:
      summary: NEW. Open and answered requests of the table's current visit
      responses: { "200": { description: "{ calls: [{ id, kind, status: open|responded, opened_at }] }" } }
    post:
      summary: "NEW. Call the waiter or ask for the bill. Idempotent per kind (a second press while one is open returns 200 with the same call). With no open visit the answer is 409 NO_OPEN_VISIT."
      requestBody: { content: { application/json: { schema: { type: object, required: [kind], properties: { kind: { type: string, enum: [waiter, bill] } } } } } }
      responses:
        "201": { description: "{ id, kind, status: open }" }
        "200": { description: "an open request of that kind already existed" }
        "400": { description: INVALID_KIND }
        "404": { description: UNKNOWN_TABLE }
  /api/tables/{id}/ratings:
    post:
      summary: "NEW. Rate dishes of the table's last closed visit. One rating per dish per visit; a later post changes it until a post with done true locks the ratings that exist. AMENDED by Functional Design U5 (BR7.1, BR7.2): the done field and the check order."
      requestBody: { content: { application/json: { schema: { type: object, required: [visit_id, ratings], properties: { visit_id: {type: string}, done: { type: boolean, description: "AMENDED. true saves the ratings and locks the ratings of the visit that exist" }, ratings: { type: array, items: { type: object, required: [item_id, thumb], properties: { item_id: {type: string}, thumb: { type: string, enum: [up, down] } } } } } } } } }
      responses:
        "200": { description: "{ saved: n }" }
        "400": { description: "INVALID_RATING, or ITEM_NOT_IN_VISIT" }
        "409": { description: "VISIT_NOT_CLOSED (visit_id is not the table's most recent closed visit), or RATING_LOCKED (a post that would change a locked rating). Checks run in the order visit, thumb, items, lock." }
        "404": { description: UNKNOWN_TABLE }
  /api/tables/{id}/presence:
    post:
      summary: "AMENDED (BR8.1). A diner page's heartbeat, sent when it opens and about every 60 seconds. The same page_id is sent as the page query parameter on GET /sse/tables/{id}."
      requestBody: { content: { application/json: { schema: { type: object, required: [page_id], properties: { page_id: { type: string, pattern: "^[A-Za-z0-9-]{8,64}$" } } } } } }
      responses:
        "204": { description: recorded }
        "400": { description: INVALID_REQUEST (a bad page_id) }
        "404": { description: UNKNOWN_TABLE }
  /api/orders/{order_number}/transition:
    post:
      summary: v1 route. With by=diner it stays open and allows only Pending to Cancelled of that order, as v1. With by=staff it needs the staff session (contract 2).
      responses: { "200": { description: "{ order_number, status }" }, "401": { description: "UNAUTHORIZED (by=staff without a session)" }, "422": { description: ILLEGAL_TRANSITION } }
```

Error codes added: `INVALID_OPTIONS`, `INVALID_KIND`, `INVALID_RATING`, `ITEM_NOT_IN_VISIT`, `VISIT_NOT_CLOSED`, `RATING_LOCKED`, `SPECIAL_SOLD_OUT` (as a dropped-line reason), `OPTION_UNAVAILABLE` (as a dropped-line reason).

Behaviour U6 can rely on: the line price is the item price plus the chosen options, frozen on the order line; the estimate returned at placement is the one the order keeps; a Chef's special line reduces the special's stock inside the same transaction as the order, and a lost race is returned as a `dropped_lines` entry with reason `SPECIAL_SOLD_OUT`, never as a failure of the whole order (v1's behaviour for sold-out items).

## Contract 2: Staff session and the shared staff routes (U5 to U7), OpenAPI

Every staff route and the staff live stream need the staff session cookie (Q1). Without it the answer is `401 { "error": { "code": "UNAUTHORIZED" } }` and nothing changes.

```yaml
openapi: 3.0.3
info: { title: "Table Order v2, staff routes provided by U5", version: "2.0" }
components:
  securitySchemes:
    staffSession: { type: apiKey, in: cookie, name: staff_session }
paths:
  /api/staff/login:
    post:
      summary: Open a staff session. The server sets the staff_session cookie (HttpOnly, SameSite=Strict, Path=/, no Max-Age, so it ends when the browser closes).
      requestBody: { content: { application/json: { schema: { type: object, required: [pin], properties: { pin: { type: string, pattern: "^[0-9]{4}$" } } } } } }
      responses:
        "204": { description: signed in }
        "401": { description: "INVALID_PIN, details.tries_left" }
        "429": { description: "LOCKED, details.retry_after_seconds (60)" }
  /api/staff/logout:
    post: { security: [ { staffSession: [] } ], responses: { "204": { description: "signed out, cookie cleared, the session's open staff streams closed" } } }
  /api/staff/session:
    get:
      summary: Is the browser signed in? Used by the shell before it shows any staff page.
      responses: { "200": { description: "{ signed_in: true }" }, "401": { description: UNAUTHORIZED } }
  /api/orders/{order_number}/transition:
    post: { security: [ { staffSession: [] } ], summary: "by=staff (v1 route; see contract 1 for by=diner)", responses: { "200": { description: ok }, "401": { description: UNAUTHORIZED } } }
  /api/menu/items/{id}/availability:
    post: { security: [ { staffSession: [] } ], summary: "v1 sold-out toggle, now guarded", responses: { "200": { description: ok }, "401": { description: UNAUTHORIZED } } }
  /api/tables/{id}/bill:
    get: { security: [ { staffSession: [] } ], summary: "v1 route, now guarded; each line gains options and station", responses: { "200": { description: ok }, "401": { description: UNAUTHORIZED } } }
  /api/tables/{id}/close:
    post: { security: [ { staffSession: [] } ], summary: "v1 route, now guarded; also clears the visit's open service calls", responses: { "200": { description: ok }, "401": { description: UNAUTHORIZED } } }
  /api/specials:
    post:
      security: [ { staffSession: [] } ]
      summary: Launch a Chef's special; ends the current one
      requestBody: { content: { application/json: { schema: { type: object, required: [item_id, special_price_cents, stock, minutes], properties: { item_id: {type: string}, special_price_cents: {type: integer, minimum: 1}, stock: {type: integer, minimum: 1, maximum: 999}, minutes: {type: integer, minimum: 1, maximum: 720} } } } } }
      responses: { "201": { description: "the special" }, "400": { description: "INVALID_REQUEST with details.field" }, "401": { description: UNAUTHORIZED } }
  /api/specials/current:
    delete: { security: [ { staffSession: [] } ], summary: End the special now, responses: { "204": { description: ended }, "401": { description: UNAUTHORIZED } } }
  /api/service-calls/{id}/respond:
    post: { security: [ { staffSession: [] } ], summary: Respond to a call, responses: { "200": { description: "{ id, status: responded }" }, "404": { description: UNKNOWN_CALL }, "401": { description: UNAUTHORIZED } } }
  /sse/staff:
    get: { security: [ { staffSession: [] } ], summary: "v1 stream, now guarded (cookie is sent by the browser automatically)", responses: { "200": { description: event stream }, "401": { description: UNAUTHORIZED } } }
```

Rules of the staff session:
- The cookie value is a random 128-bit hex string; sessions are held in server memory; a restart signs everyone out.
- The PIN comes from `STAFF_PIN`; when it is not set the server makes a random 4-digit PIN at start and prints it once. The PIN is compared in constant time and is never logged.
- Wrong tries are counted by **client address alone** (not by session), so dropping the cookie does not reset the count. Five wrong tries in a row lock that address for 60 seconds. The counts are in memory, cleared by a restart, expire after 10 minutes without a try, and hold at most 1,000 addresses (the oldest is dropped). This tightens ADR-005, which counted by address plus session; a restaurant that shares one address between phones can lock itself out for 60 seconds, which is accepted.
- Only the `by` value `staff` needs the session; a request with `by: diner` is treated as a diner action and allows only Pending to Cancelled. The request names only the order number, so, as in v1, any caller who knows an order number can cancel that Pending order; this exposure is accepted (amended by Functional Design U5, BR1.6).
- A session also ends after 12 hours without staff action, and when it ends, sign-out or the idle end closes that session's open staff streams, re-checked at every 20-second keep-alive (amended, BR1.3, BR1.9). The server sends no separate sign-out notice; a closed stream is the signal. A refused request or a closed staff stream sends the staff screen back to the PIN screen (BR1.7).
- A staff request that needs a session and a route that is still a stub: the guard answers 401 first, then the stub answers 501 NOT_BUILT (BR14.1).

## Contract 3: Routes only U7 uses (inside U7)

These are U7's to design and own; U5 must not register anything at these paths except an empty stub that answers `501 NOT_BUILT`, so U7 replaces the stub without touching U5's code. All need the staff session.

| Route | Purpose |
|---|---|
| `GET /api/staff/menu` | AMENDED (BR2.7). The whole menu including hidden items and categories, with options, allergens, stations and hidden flags; U5 provides the data function, U7 mounts the route |
| `GET /api/staff/tables` | The table list with each table's floor state, plus the table list the QR page uses |
| `GET /api/staff/stations/{station}/board` | One station's lines of the open orders |
| `POST /api/staff/orders/{order_number}/stations/{station}/done` | Mark a station's part done; completes the order when every station with lines is done |
| `POST /api/staff/menu/items`, `PATCH /api/staff/menu/items/{id}` | Add and edit an item (name, description, price, image, category, station, allergens, hidden) |
| `PUT /api/staff/menu/items/{id}/options` | Replace an item's option groups |
| `POST /api/staff/menu/categories`, `PATCH /api/staff/menu/categories/{id}` | Add, rename, reorder, hide a category |
| `GET /api/staff/sales?from=&to=` | Closed visits by day with totals, best sellers, average time to Completed |
| `GET /api/staff/ratings?day=` | Best and worst rated dishes of a day |

After any menu write U7 calls U5's `publishMenuChange()` (contract 4). Station completion changes the order through U5's order transition function and then publishes `STATION_DONE` and, when the order completes, `ORDER_STATUS_CHANGED`.

## Contract 4: Live events (U5 to U6 and U7), AsyncAPI

Channels are v1's: `staff` (every table) and `table:<id>` (one table). Event names are the SSE `event:` field; the payload is the JSON `data:`. A browser only receives events it registered a listener for, so U5 registers every name below in `useTableSSE` and `useStaffSSE`; U6 and U7 never edit those lists. Existing events keep their payloads; added fields are additive.

```yaml
asyncapi: 2.6.0
info: { title: Table Order v2 live events, version: "2.0" }
channels:
  staff:
    subscribe:
      message:
        oneOf:
          - { $ref: "#/components/messages/ORDER_PLACED" }
          - { $ref: "#/components/messages/ORDER_STATUS_CHANGED" }
          - { $ref: "#/components/messages/TABLE_CLOSED" }
          - { $ref: "#/components/messages/MENU_AVAILABILITY_CHANGED" }
          - { $ref: "#/components/messages/MENU_CHANGED" }
          - { $ref: "#/components/messages/SPECIAL_CHANGED" }
          - { $ref: "#/components/messages/SERVICE_CALL_OPENED" }
          - { $ref: "#/components/messages/SERVICE_CALL_RESPONDED" }
          - { $ref: "#/components/messages/STATION_DONE" }
          - { $ref: "#/components/messages/TABLE_PRESENCE_CHANGED" }
  "table:{id}":
    subscribe:
      message:
        oneOf:
          - { $ref: "#/components/messages/ORDER_PLACED" }
          - { $ref: "#/components/messages/ORDER_STATUS_CHANGED" }
          - { $ref: "#/components/messages/TABLE_CLOSED" }
          - { $ref: "#/components/messages/MENU_AVAILABILITY_CHANGED" }
          - { $ref: "#/components/messages/MENU_CHANGED" }
          - { $ref: "#/components/messages/SPECIAL_CHANGED" }
          - { $ref: "#/components/messages/SERVICE_CALL_OPENED" }
          - { $ref: "#/components/messages/SERVICE_CALL_RESPONDED" }
components:
  messages:
    ORDER_PLACED:
      summary: "v1 event; payload gains estimate_minutes and, per line, station and options"
    ORDER_STATUS_CHANGED:
      summary: "v1 event; payload gains completed_at (set when status is Completed)"
    TABLE_CLOSED:
      summary: "v1 event, unchanged; open service calls of the visit are cleared when it is published"
    MENU_AVAILABILITY_CHANGED:
      summary: "v1 event, unchanged; sent to staff and every table channel"
    MENU_CHANGED:
      summary: NEW. An item, category or option changed or was hidden. Sent to staff and every table channel. Consumers reload the menu.
      payload: { type: object, properties: { reason: { type: string, enum: [item, category, options] }, ids: { type: array, items: { type: string } } } }
    SPECIAL_CHANGED:
      summary: NEW. The Chef's special was launched, its stock changed, or it ended (special is null). Sent to staff and every table channel.
      payload: { type: object, properties: { special: { type: object, nullable: true, properties: { id: {type: string}, item_id: {type: string}, name: {type: string}, special_price_cents: {type: integer}, stock_left: {type: integer}, ends_at: {type: string} } } } }
    SERVICE_CALL_OPENED:
      summary: NEW. A diner called the waiter or asked for the bill. Sent to staff and that table's channel.
      payload: { type: object, properties: { call_id: {type: string}, table_id: {type: integer}, kind: { type: string, enum: [waiter, bill] }, opened_at: {type: string} } }
    SERVICE_CALL_RESPONDED:
      summary: NEW. Staff responded. Sent to staff and that table's channel.
      payload: { type: object, properties: { call_id: {type: string}, table_id: {type: integer}, kind: { type: string }, responded_at: {type: string} } }
    STATION_DONE:
      summary: NEW. A station finished its part of an order. Staff channel only.
      payload: { type: object, properties: { order_number: {type: integer}, table_id: {type: integer}, station: {type: string}, remaining: { type: array, items: {type: string} } } }
    TABLE_PRESENCE_CHANGED:
      summary: NEW. The number of diner pages connected for a table changed. Staff channel only.
      payload: { type: object, properties: { table_id: {type: integer}, connected: {type: integer}, last_activity_at: {type: string} } }
```

Rules: events are published after the database write succeeds (as v1). A consumer that reconnects reloads its data; U5's alert logic never raises the same event twice. The wait estimate has no event of its own: the screens re-read `/api/estimate` when an `ORDER_PLACED` or `ORDER_STATUS_CHANGED` event arrives.

U5 provides these functions, which U6's and U7's tests and U7's routes call: `publishMenuChange(reason, ids)`; `transitionOrder(order, to, actor)` with actor staff, diner or station (the one place an order's status changes; it sets `completed_at`; the caller publishes the event); and a presence service, `getPresence(table_id)`, returning the number of present diner pages and the time of the latest sign of life. AMENDED (Functional Design U5, BR8.1 to BR8.3): a diner page opens `GET /sse/tables/{id}?page=<page_id>` and posts a heartbeat to `POST /api/tables/{id}/presence` with the same page id when it opens and about every 60 seconds; a page is present while its connection is open and its last sign of life is under 5 minutes old; a sweep every 30 seconds drops pages quiet for more than 10 minutes and recounts; U5 publishes `TABLE_PRESENCE_CHANGED` (at most once a second per table). U5 owns the 5-minute rule inside `getPresence`; U7 only works out the floor state from it. This keeps the connection tracking in U5 (the live-events machinery), so U7 never edits U5's live-events file.

## Contract 5: Shared database schema (U5), additive

U5 alone changes the schema, in the existing start-up step, with `CREATE TABLE IF NOT EXISTS` and guarded `ALTER TABLE ... ADD COLUMN` (checked with `PRAGMA table_info`), so running it twice changes nothing and a v1 database file keeps all its data. U6 and U7 never change the schema; their tests use the helpers in contract 9.

```yaml
shared-schema:
  existing_tables_gain_columns:
    categories: [ "hidden INTEGER NOT NULL DEFAULT 0" ]
    items:
      - "hidden INTEGER NOT NULL DEFAULT 0"
      - "station TEXT NOT NULL DEFAULT 'Grill'   # Grill | Cold | Bar | Desserts"
      - "allergens TEXT NULL                      # JSON array of the nine allergen keys; NULL means not set"
    orders:
      - "completed_at TEXT NULL                   # ISO 8601 UTC, set when status becomes Completed; NULL on v1-era orders"
      - "estimate_minutes INTEGER NULL            # the estimate shown at placement"
    order_items:
      - "station TEXT NOT NULL DEFAULT 'Grill'    # frozen at placement"
      - "special_id TEXT NULL"
  new_tables:
    option_groups: "id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('one','any','leave_out')), required INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0"
    option_choices: "id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES option_groups(id), label TEXT NOT NULL, price_delta_cents INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0"
    order_item_options: "id INTEGER PRIMARY KEY AUTOINCREMENT, order_item_id INTEGER NOT NULL REFERENCES order_items(id), label TEXT NOT NULL, price_delta_cents INTEGER NOT NULL DEFAULT 0"
    station_done: "order_number INTEGER NOT NULL REFERENCES orders(order_number), station TEXT NOT NULL, done_at TEXT NOT NULL, PRIMARY KEY (order_number, station)"
    chef_specials: "id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), special_price_cents INTEGER NOT NULL, stock_total INTEGER NOT NULL, stock_left INTEGER NOT NULL, ends_at TEXT NOT NULL, ended_at TEXT NULL"
    service_calls: "id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(id), table_id INTEGER NOT NULL REFERENCES tables(id), kind TEXT NOT NULL CHECK (kind IN ('waiter','bill')), opened_at TEXT NOT NULL, responded_at TEXT NULL"
    dish_ratings: "id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id TEXT NOT NULL REFERENCES visits(id), item_id TEXT NOT NULL REFERENCES items(id), thumb TEXT NOT NULL CHECK (thumb IN ('up','down')), rated_at TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0, UNIQUE (visit_id, item_id)"
  indexes:
    - "CREATE UNIQUE INDEX IF NOT EXISTS one_open_call ON service_calls(visit_id, kind) WHERE responded_at IS NULL"
    - "CREATE INDEX IF NOT EXISTS orders_completed ON orders(completed_at)"
  rules:
    - "Special stock is reduced by one guarded statement inside the order's transaction: UPDATE chef_specials SET stock_left = stock_left - :qty WHERE id = :id AND ended_at IS NULL AND ends_at > :now AND stock_left >= :qty; no row changed means the line is dropped with SPECIAL_SOLD_OUT"
    - "At most one special is live: launching ends any special with ended_at IS NULL in the same transaction"
    - "Timestamps written by v2 are ISO 8601 UTC text; readers also accept v1's datetime('now') text"
    - "Seed: the 10 tables, 4 categories and 12 items of v1 are unchanged. v2 seed data adds option groups, allergens and stations to existing items only; Grilled Salmon keeps allergens NULL so 'Allergens not set' can be shown"
```

## Contract 6: Design tokens and theme (U5 to U6 and U7)

- The tokens live in one stylesheet U5 owns (`src/client/design/tokens.css`) using the names in `inception/refined-mockups/mockups/design-system.css` (`--bg`, `--bg-raised`, `--text`, `--accent`, `--pending`, `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`). v1's token names stay as aliases until nothing uses them.
- The theme is the `data-theme` attribute on the page root: absent means follow the device, `light` or `dark` forces it. The saved choice is under the browser storage key `table-order.theme` (values `light` or `dark`; absent means Follow device); sound under `table-order.sound` (`muted` or absent); allergies under `table-order.allergies` (a JSON array of allergen keys).
- U5 provides the shared components (button, pill, chip, badge, timer, banner, sheet, form fields, segmented control, tracker, side navigation) and the hooks `useTheme`, `useSoundPreference` and `useAllergies`. U6 and U7 build their screens from these and add components only inside their own feature folders.

## Contract 7: Code seams (U5 to U6 and U7)

U5 creates these so the parallel Units never change the same lines. A Unit edits only its own folders and its own line in a registry file that U5 pre-fills with one line per Unit (so there is nothing to merge).

| Seam | U5 provides | U6 owns | U7 owns |
|---|---|---|---|
| Server route registry (`src/server/routes/registry.ts`) | The list with one entry per module, all pre-filled | none (U6 uses U5 routes only) | `routes/staff-stations.ts`, `staff-menu.ts`, `staff-floor.ts`, `staff-sales.ts`, `staff-qr.ts` (U5 creates each as a stub that answers `501 NOT_BUILT`) |
| Staff page registry (`src/client/staff/pages/registry.tsx`) | The shell, the navigation, and one placeholder per page | none | `src/client/staff/pages/<page>/` for floor, menu, special, sales, qr, and the station boards |
| Diner feature folders (`src/client/diner/features/`) | The shell and the three tabs, with a mount point per feature | `options/`, `allergies/`, `estimate/`, `tracker/`, `ready-banner/`, `same-again/`, `help-card/`, `special-card/`, `rating/`, `settings/` | none |
| Live event hooks (`useTableSSE`, `useStaffSSE`) | Every event name in contract 4, registered once | none | none |
| Database upgrade and seed (`src/server/db.ts`) | All of it | none | none |
| Package, build and test configuration (`package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright*.ts`, `tsconfig.json`) | All of it; test files are found by folder pattern | none | none |
| Shared stylesheet entry and shared components | All of it | none | none |
| Tests | `e2e/u5-foundation/` and `src/**/__tests__` for U5 code | `e2e/u6-diner-features/` | `e2e/u7-staff-kitchen-features/` |

Every port and the database file come from `PORT`, `E2E_PORT` and `DB_FILE`. Page routes serve `index.html` with `res.sendFile('index.html', { root: distDir })`, and U5 mounts all routes before the page catch-all.

## Contract 8: The table address in a QR code (U7 to a phone camera)

The QR code for table `n` holds exactly `<origin>/table/<n>`, where `<origin>` is the address the staff page was opened on (scheme, host and port, no trailing slash). The diner page at `/table/<n>` is v1's route and does not change. The codes are made inside the app, with no outside service. A change to this address format is a breaking change for printed codes and needs the team's agreement.

## Contract 9: Test helpers (U5 to U6 and U7)

Because a Unit is built and tested with only v1 and U5, U5 provides helpers in `e2e/helpers/` and `src/server/__tests__/helpers/` that make the other side's effect without the other Unit's code:
- sign in as staff (`signInAsStaff(page, request)`, using the test PIN `STAFF_PIN` set in the test setup);
- place an order with options for a table; move an order to Preparing or Completed;
- launch, change and end a special; open and respond to a service call; close a table and rate dishes;
- change a menu item, an option or a hidden flag directly in the database and call `publishMenuChange()`, so U6 can test a live menu change and the cart refresh notice without U7's Menu management;
- set a table's presence to a given number of connections, so U7's floor map tests do not need diner pages open.

## Contract 10: How U6 and U7 meet (no code)

U6 and U7 share no code. They meet only through contracts 1, 2, 4 and 5, listed in the next section.

## How U6 and U7 Meet

| What | Made by | Seen by | Through |
|---|---|---|---|
| An order | U6 (diner places it) | U7 (board, tickets, bill, sales) | Contract 1 `POST /orders`, contract 4 `ORDER_PLACED`, contract 5 `orders` |
| A status change or station done | U7 (staff) | U6 (tracker, ready banner, estimate) | Contract 4 `ORDER_STATUS_CHANGED`, `STATION_DONE` |
| A menu change | U7 (Menu management) | U6 (Menu, cart refresh) | Contract 3 routes, contract 4 `MENU_CHANGED` |
| A Chef's special | U7 (launch) | U6 (Menu card, ordering) | Contract 2 `POST /api/specials`, contract 4 `SPECIAL_CHANGED` |
| A service call | U6 (diner buttons) | U7 (board pulse, floor map) | Contract 1 `POST /calls`, contract 4 `SERVICE_CALL_OPENED`, `SERVICE_CALL_RESPONDED` |
| A rating | U6 (diner thumbs) | U7 (best and worst rated) | Contract 1 `POST /ratings`, contract 5 `dish_ratings` |
| A diner page open | U6 (the diner page); U5 (the page id and heartbeat inside the table stream hook) | U7 (floor map Browsing) | Contract 4 `TABLE_PRESENCE_CHANGED`, U5's presence service |

## Contract Ownership Rules

- **U5 owns contracts 1, 2, 4, 5, 6, 7 and 9; U7 owns 3 and 8; contract 10 has no owner of its own and follows 1, 2, 4 and 5 (U5).** A consumer Unit may ask for a change; only the owner makes it.
- **Breaking changes** (removing or renaming a route, a field, an event or a column; changing a meaning; changing the QR address) are not allowed in v2 without the team's agreement and a note in the affected Units' `code-summary.md`. The one chosen exception is the staff guard (401 on staff requests without a session), which changes v1's behaviour and is on the "Changes to v1" list.
- **Additive changes stay safe:** a new field, route, event or column with a default is allowed; every consumer ignores fields and events it does not know.
- **v1's tests** that call staff actions without signing in are updated to sign in (Q2), and each is listed under "v1 tests changed" in U5's `code-summary.md`.
- **Errors and timeouts:** every route keeps v1's error shape and status codes; the browser treats a network error as "try again" with v1's retry banner, and an order is retried safely because placement is idempotent by `placement_key`. Staff actions are not retried automatically.

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| 1 | ANSWERED in Functional Design U5 (BR4.1): average of today's placed-to-Completed minutes (15 when none) plus 2 minutes per open order, at least 1; "Running late" when the wait passes the stored estimate (BR4.2) | none |
| 2 | ANSWERED (BR1.9): no separate notice; the server closes the session's staff streams and the client returns to the PIN screen | none |
| 3 | The exact validation limits for category names and image web addresses (names at most 60 characters is already set in the requirements) | U7 |
| 4 | ANSWERED (BR8.1, BR8.2): a heartbeat route, about once a minute, tied to the stream by a page id | none |

## Assumptions

- The cookie name is `staff_session` and the path is `/`; the staff pages and the staff API are on the same address, so no cross-site rules apply.
- Sessions in memory are enough for one restaurant; a restart costs staff one PIN entry.
- The numbers in contract 1 (stock 1 to 999, minutes 1 to 720, quantity 1 to 20) are from the requirements; the 720 upper limit on special minutes is mine.
