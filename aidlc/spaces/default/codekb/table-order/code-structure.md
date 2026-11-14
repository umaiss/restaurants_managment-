# Code Structure: table-order

## Repository layout

```
./
  index.html                 Vite entry page (loads src/client/main.tsx)
  package.json               one npm package, ESM; scripts start, dev, build, test, test:e2e
  tsconfig.json              strict TS, noEmit, bundler resolution
  vite.config.ts             client build to dist/; dev proxy /api and /sse to PORT
  vitest.config.ts           node env for server, jsdom for src/client/**, v8 coverage
  playwright.config.ts       e2e on E2E_PORT, in-memory DB, global staff sign-in
  playwright.cross-browser.config.ts   Chrome + WebKit run (mockup-match specs left out)
  .env.example               PORT, E2E_PORT, DB_FILE, STAFF_PIN (commented)
  README.md                  setup, settings, tests, layout, known limits
  unit-test-instructions.md  leftover note from the parallel U2 build
  ideas/                     product briefs (v1 IDEA.md + QUESTIONS.md, v2 IDEA.md)
  V2 Scope/                  v2 brief, guide and setup notes for the workshop
  src/
    server/                  Express API, SQLite, SSE, staff access
    client/                  React SPA (diner and staff)
    shared/                  pure helpers used by both sides
    test-setup.ts            Vitest setup (jest-dom matchers, test STAFF_PIN)
    test-types.d.ts          test type shim
  e2e/                       Playwright specs, one folder per Unit plus build-and-test/ and helpers/
```

## Server (`src/server/`)

| Path | Classification | Role |
|---|---|---|
| `index.ts` | Configuration / entry | Creates the Express app, mounts `routeModules`, serves `dist/` with SPA fallback (`sendFile('index.html', { root })`), starts listening and background jobs only when run as the entry |
| `config.ts` | Configuration | `getPort`, `getDbFile`, `getStaffPinSetting`; every tunable constant (idle time, lockout, presence windows, keep-alive, estimate allowance, stations, allergens) |
| `db.ts` | Repository / migration | Singleton better-sqlite3 handle (WAL, foreign keys), v1 `initSchema`, additive `upgradeSchema` with named steps, `seedIfEmpty`, one-time seed backfill, `openVisit`, `getCurrentVisit`, `nextOrderNumber` |
| `errors.ts` | Utility | `AppError`, `STATUS_BY_CODE`, `sendApiError`, `sendIfAppError`, `sendInternalError` |
| `time.ts` | Utility | `toIso`, `localDayBounds` (server-local midnight to midnight), `minutesBetween`; re-exports `parseStoredTime` |
| `sse.ts` | Service (event hub) | Channels, subscribers, 60-event ring buffer per channel, `publish`, `subscribe` with `Last-Event-ID` replay, 20 s keep-alive, closing streams by staff session |
| `presence.ts` | Service | Diner page presence per table (5-minute window, caps, sweep), debounced `TABLE_PRESENCE_CHANGED` |
| `staffAccess.ts` | Middleware / service | PIN resolution, constant-time compare, per-address lockout, in-memory sessions with 12-hour idle end, cookie read/write, `requireStaff({ refresh })` guard |
| `menuEvents.ts` | Service | `publishMenuChange`, `publishSpecialChanged`, `watchSpecial` (fan-out to staff and every table channel) |
| `background.ts` | Configuration | Starts the staff session sweep, presence sweep and 5-second special expiry check |
| `repositories/orderRepo.ts` | Repository | Place order (option checks, frozen price, station, special stock), `transitionOrder` (single legal-transition table), order reads by visit |
| `repositories/tableRepo.ts` | Repository | Table existence and status, last closed visit, close visit, add and archive tables |
| `repositories/billingRepo.ts` | Repository | Live bill of the current visit, receipt of a closed visit, `closeTable` |
| `repositories/menuRepo.ts` | Repository | Diner menu (hidden filtered), staff menu (everything), availability toggle |
| `repositories/specialsRepo.ts` | Repository | Launch, current, expiry, guarded stock reduction for Chef's specials |
| `repositories/serviceCallRepo.ts` | Repository | Open, respond, list and clear waiter and bill calls |
| `repositories/ratingRepo.ts` | Repository | Save and lock dish ratings and a visit comment |
| `services/waitEstimation.ts` | Service | `computeEstimate` (today's average minutes to Completed plus 2 per open order) |
| `routes/registry.ts` | Configuration | Ordered list of route modules and their mount points |
| `routes/staff.ts` | Controller + middleware | Login, logout, then `router.use('/staff', requireStaff())`, then `GET /staff/session` |
| `routes/menu.ts`, `orders.ts`, `billing.ts`, `calls.ts`, `ratings.ts`, `presence.ts`, `estimate.ts`, `specials.ts`, `sse.ts` | Controller | v1 and U5 routes |
| `routes/staff-stations.ts`, `staff-menu.ts`, `staff-floor.ts`, `staff-sales.ts` | Controller | U7 staff routes (thin; logic in `routes/u7/`) |
| `routes/staff-qr.ts`, `stubs.ts` | Controller (dead) | Guarded 501 stub for `/staff/qr/:table` |
| `routes/tableId.ts` | Utility | Strict positive-integer parsing of path ids; 404 helpers |
| `routes/u7/stations.ts` | Service | Station board read; `markStationDone` transaction |
| `routes/u7/floor.ts` | Service | Floor state per table (`decideFloorState`) |
| `routes/u7/sales.ts` | Service | `getSales` (days of closed visits), `getRatings` (best and worst rated of a day), `localDay`, `readDay` |
| `routes/u7/menuAdmin.ts`, `validation.ts` | Service / validation | Menu item, category and option-group writes and their checks |
| `routes/u7/constants.ts`, `errors.ts` | Configuration / utility | U7 limits and list lengths; U7 error status map |
| `__tests__/**` | Test | Vitest server tests (`foundation/`, `u6/`, `u7/`, `integration/`, `helpers/`) |

## Shared (`src/shared/`)

| Path | Role |
|---|---|
| `time.ts` | `parseStoredTime`: reads v1's `YYYY-MM-DD HH:MM:SS` (UTC) and ISO text as instants |
| `wait.ts` | `waitDisplay`: none, late, or minutes remaining for an order with a stored estimate |

## Client (`src/client/`)

| Path | Classification | Role |
|---|---|---|
| `main.tsx`, `App.tsx` | Configuration | Applies saved theme before first paint; routes `/table/:id`, `/staff/*`, everything else to `/staff` |
| `index.css` | Static | Imports Inter, `design/tokens.css`, `components.css`, `screens.css`; base styles, keyframes, motion helpers |
| `design/` | Static (design system) | `tokens.css` (Paprika tokens, dark default, light, follow-device, v1 aliases, reduced motion), `components.css` (buttons, pills, chips, badges, cards, banners, sheets, inputs, segmented control, tracker, timer, staff shell, PIN pad), `screens.css` (screen-level look, many attribute selectors with `!important`) |
| `components/ui/` | Component library | `Button`, `AddPill`, `Pill`, `Chip`, `Badge`, `Timer`, `Banner`, `Sheet`, `Field`, `SegmentedControl`, `Tracker`, `SideNav`, `Icon`, `BrandMark` (barrel `index.ts`) |
| `components/staff/` | Component | `OrderCard`, `NewHighlight`, `MenuAvailabilityPanel`, `BillOrderCard`, `BillTotal`, `CloseTableSection`, `money.ts` (`formatMoney`, `formatPlacedTime`) |
| `components/diner/` | Component | `DinerTabBar`, `TableClosedTakeover` |
| `components/ConfirmModal.tsx`, `ReceiptCard.tsx` | Component | Shared modal and receipt |
| `views/StaffView.tsx` | Controller (view) | Session state machine: checking, unreachable, signed out (PIN), signed in (shell) |
| `views/TableView.tsx` | Controller (view) | Diner app shell: tabs, table stream, cart, table-closed takeover, feature mounts |
| `staff/StaffShell.tsx` | Component | Side navigation (wide) or menu button (narrow), theme switch, `Routes` from `STAFF_PAGES` |
| `staff/pages/registry.tsx` | Configuration | `STAFF_PAGES`: key, path, label, icon emoji, element, `inNav` |
| `staff/pages/useLiveRead.ts` | Hook | `useRead` (latest-wins read) and `useLiveRead` (re-read on listed events and on reconnect) |
| `staff/pages/floor/`, `sales/`, `menu/`, `special/`, `qr/`, `stations/` | Screen | Staff pages; each has its own `__tests__/` |
| `staff/board/` | Component | Station tabs and board, ticket timer, new-order and call banners, call pulse, `useNow`, constants |
| `staff/PinScreen.tsx`, `useStaffSession.ts`, `staffAuth.ts` | Component / hook / utility | PIN keypad; session hook; `staffFetch` and 401 listeners |
| `staff/staff-u7.css` | Static | Staff screen styles: tickets, stats (`.u7-stat`), floor tiles, data tables, QR sheet, tabs, print rules |
| `screens/staff/` | Screen | `KitchenBoardScreen`, `TableBillScreen`, `ReceiptScreen` |
| `screens/diner/` | Screen | `MenuScreen`, `CartScreen`, `MyOrdersScreen` |
| `hooks/` | Hook | `useStaffSSE` (shared staff stream), `useTableSSE` (diner stream with backoff, heartbeats), `eventNames.ts`, `useBoardOrders`, `useBill`, `useCart`, `useMenuAvailability`, `useAllergies`, `useSoundPreference`, `useTheme` |
| `alerts/` | Service | `AlertGate` (fire once, never for pre-load events), sound and vibration decisions, `useAlerts` |
| `diner/features/` | Feature modules | One folder per diner feature (options, allergies, estimate, tracker, ready-banner, same-again, help-card, special-card, rating, receipt, settings), `registry.ts`, `api.ts`, `cartModel.ts` |
| `lib/safeStorage.ts` | Utility | `localStorage` that never throws; keys `table-order.theme`, `.sound`, `.allergies` |

## Code patterns

- **Header comment per file** naming the business rules (BR/FR ids) it implements
- **Write, then publish**: routes publish SSE events only after the repository call returns
- **Immediate transactions** (`db.transaction(...).immediate()`) for every multi-step write
- **Error envelope** `{ error: { code, message, details? } }` everywhere; AppError plus a status map in v2 code, hand-written branches in v1 routes
- **Strict id parsing** (`parseTableId`, `parseOrderNumber`) before any lookup
- **Latest-wins reads** in the browser: a request counter ignores answers older than the newest request
- **Event sequence numbers** (`seq`) on client-side event lists, so hooks process every event once, in order, even when several arrive in one render
- **Registries** for routes, staff pages and diner features
- **Tokens only** in CSS: no colour literal outside `tokens.css` (checked by `design/__tests__/restyle.test.tsx`; `tokens.test.ts` checks the themes, contrast and reduced motion)
- **data-testid** on every element tests touch; e2e specs per Unit folder with `mockup-match.spec.ts`

## Where the Manager TV wall would attach

| Concern | Existing place |
|---|---|
| New staff page and nav link | `src/client/staff/pages/registry.tsx` (`STAFF_PAGES`), icon mapping in `src/client/components/ui/Icon.tsx` (`EMOJI_TO_ICON`, `PATHS`) |
| Full-screen layout without the shell | `src/client/App.tsx` routes and `src/client/views/StaffView.tsx` (the PIN gate wraps all of `/staff/*`) |
| New staff API route | a new module in `src/server/routes/`, listed in `routes/registry.ts` after `staff` |
| Live refresh | `useLiveRead` with an event list, or `useStaffSSE` events directly |
| Money and time formatting | `components/staff/money.ts`, `shared/time.ts`, `staff/board/TicketTimer.tsx` |
| Big-number tiles | `.u7-stat`, `.u7-stats` in `staff/staff-u7.css` |
| Per-device setting | `lib/safeStorage.ts` (add a key next to theme and sound) |
| Server-wide setting | a new `upgradeSchema` step in `src/server/db.ts` |
