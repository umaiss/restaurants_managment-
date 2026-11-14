# Contract Summary — Manager TV Wall

These are the contracts between U8 `u8-tv-foundation` and U9 `u9-tv-wall-screen`, and between U8 and the existing v1/v2 code. They come from `inception/units-generation/unit-of-work.md` and `unit-of-work-dependency.md`, the shapes in `inception/domain-design/components.md`, and the targets in `inception/requirements-analysis/requirements.md`.

Nothing here is consumed outside the app: there is no public or external API. Both Units ship in the same process and the same browser bundle.

Earlier answers already settle every contract point, so this stage asked no questions:
- One summary read (domain-design Q1).
- A restaurant-wide setting stored on the server (requirements Q3).
- The TV's reads keep it signed in (requirements Q2).

This document also pins down the review points accepted at Domain Design and Units Generation:
- the new repository reads, by name;
- a route to read the setting;
- the payload of the setting event;
- the shared Sales rule and its tests;
- open orders listed whatever day they were placed;
- the midnight refresh, which follows the server's time.

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | U8 `u8-tv-foundation` | U9 `u9-tv-wall-screen` (and U8's plain page) | Synchronous HTTP JSON: `GET /api/staff/tv/summary` | U8 |
| C2 | U8 `u8-tv-foundation` | U8's takings switch on every staff page | Synchronous HTTP JSON: `GET` and `PUT /api/staff/tv/settings` | U8 |
| C3 | U8 `u8-tv-foundation` (new event) and v1/v2 (existing events) | U8's switch, U8's plain page, U9's screen | Server-Sent Events on the existing `staff` channel | U8 for the new event; existing owners for the rest |
| C4 | U8 `u8-tv-foundation` | U9 `u9-tv-wall-screen` | Shared client code: the `useTvWall()` data hook and its TypeScript types | U8 |
| C5 | U8 `u8-tv-foundation` | v2 Sales route (`src/server/routes/u7/sales.ts`) and U8's summary | Shared server module and schema: the closed-day takings rule, the new repository reads and the `tv_settings` table | U8 |

## C1 — TV wall summary

```yaml
openapi: 3.0.3
info:
  title: TV wall summary
  version: "1"
paths:
  /api/staff/tv/summary:
    get:
      summary: Everything the TV wall shows, worked out on the server for today
      description: >
        Staff only (mounted after the staff guard). This read refreshes the staff session's idle timer
        (requireStaff({ refresh: true })), so an open TV wall is never signed out by the 12-hour idle limit.
        "Today" is the server's local calendar day (the same rule as the Sales page).
        Open orders are listed whatever day they were placed; counts and money are for today only.
        When show_takings is false the takings object is absent: no amount is sent.
      responses:
        "200":
          description: The summary
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TvSummary" }
        "401":
          description: No staff session (UNAUTHORIZED)
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "500":
          description: Unexpected failure (INTERNAL_ERROR); logged on the server
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
components:
  schemas:
    TvSummary:
      type: object
      required: [server_time, day, show_takings, orders, busiest_table, top_dish, requests]
      properties:
        server_time: { type: string, format: date-time, description: "Server clock now, ISO 8601 with offset; the TV counts waits and the midnight refresh from this" }
        day: { type: string, pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "The server-local day the figures are for" }
        show_takings: { type: boolean }
        orders:
          type: array
          description: "Every Pending or Preparing order, oldest placed_at first, ties by order_number ascending"
          items:
            type: object
            required: [order_number, table_id, status, placed_at, portions]
            properties:
              order_number: { type: integer, minimum: 1 }
              table_id: { type: integer, minimum: 1 }
              status: { type: string, enum: [Pending, Preparing] }
              placed_at: { type: string, format: date-time }
              portions: { type: integer, minimum: 0, description: "Sum of line quantities" }
        takings:
          type: object
          description: "Present only when show_takings is true"
          required: [closed_cents, open_cents]
          properties:
            closed_cents: { type: integer, minimum: 0, description: "Tables closed today; exactly the Sales page's total_cents for today" }
            open_cents: { type: integer, minimum: 0, description: "Sum of live bills of open visits, cancelled orders left out" }
        busiest_table:
          nullable: true
          description: "null when no order was placed today"
          type: object
          required: [table_id, orders]
          properties:
            table_id: { type: integer }
            orders: { type: integer, minimum: 1, description: "Non-cancelled orders placed today; ties go to the lower table_id" }
        top_dish:
          nullable: true
          description: "null when no dish was ordered today"
          type: object
          required: [item_id, name, portions]
          properties:
            item_id: { type: string }
            name: { type: string }
            portions: { type: integer, minimum: 1, description: "Portions in non-cancelled orders placed today; ties go to the name first in the alphabet" }
        requests:
          type: array
          description: "Open waiter and bill requests, oldest first"
          items:
            type: object
            required: [call_id, table_id, kind, opened_at]
            properties:
              call_id: { type: string }
              table_id: { type: integer }
              kind: { type: string, enum: [waiter, bill] }
              opened_at: { type: string, format: date-time }
    ErrorEnvelope:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code: { type: string }
            message: { type: string }
            details: { type: object }
```

## C2 — TV settings

```yaml
openapi: 3.0.3
info:
  title: TV settings
  version: "1"
paths:
  /api/staff/tv/settings:
    get:
      summary: Current show-takings setting
      description: Staff only. A missing row reads as show_takings false.
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TvSettings" }
        "401": { description: UNAUTHORIZED }
    put:
      summary: Change the show-takings setting
      description: >
        Staff only. Saved first, then TV_SETTINGS_CHANGED is published on the staff channel (C3).
        Idempotent: sending the current value saves nothing new but still answers 200 with the current setting.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [show_takings]
              additionalProperties: false
              properties:
                show_takings: { type: boolean }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/TvSettings" }
        "400": { description: "INVALID_REQUEST: body missing, not an object, extra fields, or show_takings not a boolean" }
        "401": { description: UNAUTHORIZED }
        "500": { description: INTERNAL_ERROR }
components:
  schemas:
    TvSettings:
      type: object
      required: [show_takings, updated_at]
      properties:
        show_takings: { type: boolean }
        updated_at: { type: string, format: date-time, nullable: true, description: "null until first changed" }
```

## C3 — Live events the TV wall and the switch use

```yaml
asyncapi: 2.6.0
info:
  title: Staff live events used by the TV wall
  version: "1"
channels:
  /sse/staff:
    description: >
      The existing shared staff stream (one EventSource per staff page, rising ids, 60-event replay).
      TV_SETTINGS_CHANGED is new and is added to STAFF_EVENT_NAMES in src/client/hooks/eventNames.ts
      (browsers ignore unregistered names). The other events already exist and are unchanged.
    subscribe:
      message:
        oneOf:
          - $ref: "#/components/messages/TvSettingsChanged"
          - $ref: "#/components/messages/ExistingRefreshTrigger"
components:
  messages:
    TvSettingsChanged:
      name: TV_SETTINGS_CHANGED
      summary: The show-takings setting was saved (published after the write)
      payload:
        type: object
        required: [show_takings, updated_at]
        properties:
          show_takings: { type: boolean }
          updated_at: { type: string, format: date-time }
    ExistingRefreshTrigger:
      name: "ORDER_PLACED | ORDER_STATUS_CHANGED | STATION_DONE | TABLE_CLOSED | SERVICE_CALL_OPENED | SERVICE_CALL_RESPONDED"
      summary: >
        Existing events, payloads unchanged. The TV wall does not read their payloads: each one only
        triggers a re-read of C1. The switch listens only to TV_SETTINGS_CHANGED and sets its position from the payload.
```

**Consumer behaviour, which both U8's plain page and U9's screen follow:**
- **Re-read triggers:** the page re-reads C1 on any trigger event above, on TV_SETTINGS_CHANGED, on every stream reconnect, at least every 5 minutes, and when `server_time` (plus the time since it was read) passes the next local midnight.
- **Burst handling:** a burst of events causes at most one read in flight and one waiting read.
- **Stale answers:** an answer older than the newest request is ignored (latest-wins, as `useLiveRead` does today).

## C4 — Shared client hook (U8 provides, U9 consumes)

```yaml
shared-schema: "src/client/staff/pages/tv/useTvWall.ts (TypeScript, U8)"
exports:
  useTvWall:
    returns:
      status: "loading | ready | error"          # error only when no read has ever succeeded
      connection: "live | reconnecting"
      lastUpdatedAt: "Date | null"                 # when the last successful read arrived
      summary: "TvSummary | null"                  # exactly C1's body
      now: "Date"                                   # server time estimate: server_time + elapsed, ticking every 15 s
  types:
    TvSummary: "C1 TvSummary, as a TypeScript type in src/shared/tvWall.ts"
  helpers:
    waitMinutes(placedAt, now): "whole minutes, floor, never negative"
    waitLevel(minutes): "none below 8; 'slow' 8 to 14; 'late' 15 and above"
rule: "U9 renders from useTvWall() only and makes no other request; U9 may not change the hook's return shape."
```

## C5 — Shared server code and schema (U8)

```yaml
shared-schema: "server (U8)"
tables:
  tv_settings:
    added_by: "new named upgradeSchema step 'tv-settings' in src/server/db.ts (additive)"
    columns:
      key: "TEXT PRIMARY KEY  -- always 'show_takings'"
      value: "INTEGER NOT NULL DEFAULT 0  -- 0 hidden, 1 shown"
      updated_at: "TEXT NULL  -- ISO 8601"
    seed: "none: a missing row reads as hidden"
modules:
  src/server/salesRules.ts:
    closedDayTakingsCents(day: "YYYY-MM-DD"): "integer; tables closed on that server-local day, frozen prices, cancelled left out; reads only that day's closed visits"
    used_by: ["src/server/routes/u7/sales.ts (getSales per day, output unchanged)", "TvWallSummary"]
  src/server/repositories/orderRepo.ts (extended):
    getOpenOrdersAllTables(): "Pending and Preparing orders with table_id, placed_at, portions"
    getTodayOrderCountsByTable(day): "non-cancelled orders placed that day, per table"
    getTodayPortionsByItem(day): "non-cancelled portions placed that day, per item, with name"
  src/server/repositories/serviceCallRepo.ts (extended):
    listOpenCallsAllTables(): "open waiter and bill calls, oldest first"
  src/server/repositories/billingRepo.ts (extended):
    openVisitsBillTotalCents(): "sum of live bills of open visits, cancelled left out (same rule as buildBill)"
  src/server/tvSettings.ts:
    getShowTakings(): boolean
    setShowTakings(value: boolean): "{ show_takings, updated_at }"
  src/server/tvWallSummary.ts:
    buildTvSummary(now: Date): TvSummary
routes:
  registry_entry: "{ name: 'staff-tv', mount: '/api', router: staffTvRouter, owner: 'U8' }, listed after 'staff'"
required_tests:
  - "Sales route output for a fixed dataset is identical before and after salesRules.ts is extracted (regression, written before the move)"
  - "TV summary closed_cents equals getSales() total_cents for today, with one table closed today and one closed yesterday"
  - "With show_takings false the summary JSON has no 'takings' key"
  - "Summary reads only today's rows: with 10,000 past closed visits it still answers in under 300 ms in the test environment"
```

These changes go into U8's `code-summary.md` under "v1/v2 changes":
- the three repositories gain new read functions, so the repository entries in `components.md` that say "unchanged" no longer hold;
- `getSales` calls the shared rule;
- the route registry gains one entry;
- `STAFF_EVENT_NAMES` gains one name.

## Contract Ownership Rules

- U8 owns C1, C2, C4 and C5, and the new TV_SETTINGS_CHANGED event in C3. The existing events keep their v1/v2 owners and are not changed.
- Both Units ship together, so there is no API versioning. A breaking change to C1 or C4 needs the team's agreement at a gate, and both Units' tests updated in the same change.
- Changes that only add fields are safe: consumers ignore fields they do not know.
- U9 never calls the server directly. It reads only through `useTvWall()` (C4).
- Money is integer cents end to end, formatted only in the browser with the existing `formatMoney`.

## Error, Timeout and Retry Behaviour

| Boundary | Failure | Behaviour |
|---|---|---|
| C1 read | 401 | The page shows the staff PIN screen (existing `staffFetch` behaviour) |
| C1 read | 500 or no answer within 10 s | The page keeps the last summary and shows "Reconnecting…". Before any success it shows "Can't reach the restaurant server. Trying again…" and retries every 10 s |
| C2 change | 400, 500 or no answer within 10 s | The switch returns to its previous position and the existing "Server did not answer, Try again" message shows. No automatic retry |
| C3 stream | Drops | The existing reconnect with `Last-Event-ID` replay applies, then the page re-reads C1 |

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| — | None | — |
