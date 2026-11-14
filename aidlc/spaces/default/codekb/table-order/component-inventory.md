# Component Inventory: table-order

Each heading below is a component name. Dependencies name other components in this list.

## Server

### Server Entry and Route Registry
- **Files**: `src/server/index.ts`, `src/server/routes/registry.ts`
- **Responsibility**: Build the Express app, mount every route module in a fixed order (staff login and guard before staff modules, all before the SPA fallback), serve `dist/`, start background jobs when run as the entry
- **Depends on**: Configuration, Database and Schema Upgrade, Background Jobs, every route module

### Configuration
- **Files**: `src/server/config.ts`, `src/server/routes/u7/constants.ts`
- **Responsibility**: Ports and DB file from the environment; every tunable number (idle time, lockout, presence, keep-alive, estimate allowance, limits, list lengths); station and allergen lists
- **Depends on**: none

### Database and Schema Upgrade
- **Files**: `src/server/db.ts`
- **Responsibility**: One better-sqlite3 handle (WAL, foreign keys); v1 schema; additive named upgrade steps; seed of 10 tables, 4 categories, 12 items; one-time seed backfill; visit helpers; order number counter
- **Tables**: `tables`, `categories`, `items`, `visits`, `orders`, `order_items`, `order_counter`, `option_groups`, `option_choices`, `order_item_options`, `station_done`, `chef_specials`, `service_calls`, `dish_ratings`, `visit_feedback`, `seed_backfill`
- **Depends on**: Configuration, Shared Time and Wait Helpers

### Error Envelope
- **Files**: `src/server/errors.ts`, `src/server/routes/u7/errors.ts`, `src/server/routes/tableId.ts`
- **Responsibility**: `AppError`, status maps, the `{ error: { code, message, details? } }` envelope, logged 500s, strict path-id parsing
- **Depends on**: none

### Staff Access
- **Files**: `src/server/staffAccess.ts`, `src/server/routes/staff.ts`
- **Responsibility**: Staff PIN from `STAFF_PIN` (or random, printed once); constant-time compare; per-address lockout; in-memory sessions with 12-hour idle end; cookie; `requireStaff` guard; login, logout, session routes
- **Depends on**: Configuration, Error Envelope, Live Event Hub

### Live Event Hub
- **Files**: `src/server/sse.ts`, `src/server/routes/sse.ts`, `src/server/menuEvents.ts`
- **Responsibility**: Channels `staff` and `table:<id>`; publish, subscribe, 60-event replay buffer, keep-alive, closing staff streams with their session; menu and special fan-out helpers
- **Depends on**: Staff Access (session validator, registered at load), Presence Tracker, Table Repository, Specials Repository

### Presence Tracker
- **Files**: `src/server/presence.ts`, `src/server/routes/presence.ts`
- **Responsibility**: Count open diner pages per table (5-minute window, caps, sweep); debounced `TABLE_PRESENCE_CHANGED`; heartbeat route
- **Depends on**: Configuration, Live Event Hub

### Order Repository
- **Files**: `src/server/repositories/orderRepo.ts`, `src/server/routes/orders.ts`
- **Responsibility**: Place orders in one transaction (option checks, frozen price and station, special stock); the single legal-transition table; read orders by visit and by last closed visit; order routes
- **Depends on**: Database and Schema Upgrade, Table Repository, Specials Repository, Wait Estimation, Live Event Hub, Staff Access

### Table Repository
- **Files**: `src/server/repositories/tableRepo.ts`
- **Responsibility**: Table existence and status, current and last closed visit, close visit, add table (max 50), archive table (refused while guests have orders)
- **Depends on**: Database and Schema Upgrade, Error Envelope

### Billing Repository
- **Files**: `src/server/repositories/billingRepo.ts`, `src/server/routes/billing.ts`
- **Responsibility**: Live bill of a table's current visit (Cancelled left out), receipt of a closed visit, close table (refused while any order is open; answers open calls)
- **Depends on**: Order Repository, Table Repository, Service Call Repository, Live Event Hub, Staff Access

### Menu Repository
- **Files**: `src/server/repositories/menuRepo.ts`, `src/server/routes/menu.ts`
- **Responsibility**: Diner menu (hidden filtered), staff menu (all), options per item, availability toggle
- **Depends on**: Database and Schema Upgrade, Live Event Hub, Staff Access

### Menu Administration
- **Files**: `src/server/routes/staff-menu.ts`, `src/server/routes/u7/menuAdmin.ts`, `src/server/routes/u7/validation.ts`
- **Responsibility**: Create and edit items and categories, replace option groups, all checks, publish `MENU_CHANGED`
- **Depends on**: Menu Repository, Specials Repository, Live Event Hub, Error Envelope

### Specials Repository
- **Files**: `src/server/repositories/specialsRepo.ts`, `src/server/routes/specials.ts`
- **Responsibility**: Launch (one live), current, end, expiry, guarded stock reduction
- **Depends on**: Database and Schema Upgrade, Live Event Hub, Staff Access

### Service Call Repository
- **Files**: `src/server/repositories/serviceCallRepo.ts`, `src/server/routes/calls.ts`
- **Responsibility**: Open (one per kind per visit), respond, list, clear on close; payment method and receipt wish on bill calls
- **Depends on**: Database and Schema Upgrade, Live Event Hub, Staff Access

### Rating Repository
- **Files**: `src/server/repositories/ratingRepo.ts`, `src/server/routes/ratings.ts`
- **Responsibility**: Save, change and lock thumbs per dish per closed visit, plus one comment
- **Depends on**: Table Repository, Database and Schema Upgrade

### Wait Estimation
- **Files**: `src/server/services/waitEstimation.ts`, `src/server/routes/estimate.ts`
- **Responsibility**: Estimate = today's mean minutes to Completed (by `placed_at` in the server-local day; 15 when none) + 2 per open order, at least 1
- **Depends on**: Database and Schema Upgrade, Shared Time and Wait Helpers, Configuration

### Kitchen Stations
- **Files**: `src/server/routes/staff-stations.ts`, `src/server/routes/u7/stations.ts`
- **Responsibility**: A station's board of open tickets; the done mark that moves orders to Preparing and Completed
- **Depends on**: Order Repository, Live Event Hub, Error Envelope

### Floor State
- **Files**: `src/server/routes/staff-floor.ts`, `src/server/routes/u7/floor.ts`
- **Responsibility**: Table list with state (needs bill, waiting, eating, browsing, empty), presence and open calls; add and archive tables
- **Depends on**: Database and Schema Upgrade, Presence Tracker, Table Repository

### Sales and Ratings Reports
- **Files**: `src/server/routes/staff-sales.ts`, `src/server/routes/u7/sales.ts`
- **Responsibility**: Sales by local day of close (closed visits only, Cancelled excluded, frozen prices, best sellers top 5, average minutes); best and worst rated dishes of a day
- **Depends on**: Database and Schema Upgrade, Shared Time and Wait Helpers, Error Envelope

### Background Jobs
- **Files**: `src/server/background.ts`
- **Responsibility**: Staff session sweep (10 min), presence sweep (30 s), special expiry check (5 s); all timers unref'd
- **Depends on**: Staff Access, Presence Tracker, Specials Repository, Live Event Hub

### Guarded Stub Router
- **Files**: `src/server/routes/stubs.ts`, `src/server/routes/staff-qr.ts`
- **Responsibility**: Leftover guarded `501 NOT_BUILT` for `GET /api/staff/qr/:table` (QR codes are drawn in the browser); dead code kept by tests
- **Depends on**: Staff Access, Error Envelope

## Shared

### Shared Time and Wait Helpers
- **Files**: `src/shared/time.ts`, `src/shared/wait.ts`, `src/server/time.ts`
- **Responsibility**: Read both stored time formats as UTC instants; ISO writing; server-local day bounds; "Running late" or minutes remaining for an order
- **Depends on**: none

## Client

### Client App Router
- **Files**: `src/client/main.tsx`, `src/client/App.tsx`, `index.html`
- **Responsibility**: Apply saved theme before first paint; route `/table/:id` to the diner app and `/staff/*` to the staff app; everything else to `/staff`
- **Depends on**: Design System, Staff Session and PIN Gate, Diner Table View

### Staff Session and PIN Gate
- **Files**: `src/client/views/StaffView.tsx`, `src/client/staff/useStaffSession.ts`, `src/client/staff/PinScreen.tsx`, `src/client/staff/staffAuth.ts`
- **Responsibility**: Ask the server for the session before showing any staff page; PIN keypad with tries left and lockout countdown; `staffFetch` returns to the PIN screen on any 401
- **Depends on**: Design System

### Staff Shell and Page Registry
- **Files**: `src/client/staff/StaffShell.tsx`, `src/client/staff/pages/registry.tsx`, `src/client/components/ui/SideNav.tsx`, `src/client/staff/pages/PagePlaceholder.tsx` (unused)
- **Responsibility**: Side navigation at 1024 px and wider, menu button below; theme switch; sign out; renders every page from `STAFF_PAGES` (`inNav` decides the nav link)
- **Depends on**: Design System, every staff page

### Staff Live Stream Hook
- **Files**: `src/client/hooks/useStaffSSE.ts`, `src/client/hooks/eventNames.ts`
- **Responsibility**: One shared `EventSource('/sse/staff')` per page; numbered event list (last 200); connected flag; session check when the stream is refused
- **Depends on**: Staff Session and PIN Gate

### Live Read Hook
- **Files**: `src/client/staff/pages/useLiveRead.ts`
- **Responsibility**: Latest-wins read of a staff route, kept on failure with an error flag; re-read on listed event types and on every reconnect
- **Depends on**: Staff Live Stream Hook, Staff Session and PIN Gate

### Kitchen Board
- **Files**: `src/client/screens/staff/KitchenBoardScreen.tsx`, `src/client/hooks/useBoardOrders.ts`, `src/client/staff/board/*`, `src/client/components/staff/OrderCard.tsx`, `NewHighlight.tsx`, `MenuAvailabilityPanel.tsx`, `src/client/hooks/useMenuAvailability.ts`, `src/client/hooks/useSoundPreference.ts`
- **Responsibility**: Live table cards with orders, status buttons and ticket timers (8 min Slow, 15 min Late); station tabs and boards; new-order and call banners with sound; pulsing calling tables; menu availability panel
- **Depends on**: Staff Live Stream Hook, Alerts, Design System, Staff Session and PIN Gate

### Floor Map Page
- **Files**: `src/client/staff/pages/floor/*`
- **Responsibility**: Live grid of tables with state word and colour; link to each bill
- **Depends on**: Live Read Hook, Design System

### Sales Page
- **Files**: `src/client/staff/pages/sales/*`
- **Responsibility**: Day cards (total, average minutes, average per visit, best sellers), month filter and month total, today's best and worst rated
- **Depends on**: Live Read Hook, Design System

### Menu Management Page
- **Files**: `src/client/staff/pages/menu/*`
- **Responsibility**: Item and category editor with option groups, allergens, stations, hide and show
- **Depends on**: Live Read Hook, Staff Session and PIN Gate, Design System

### Chef Special Page
- **Files**: `src/client/staff/pages/special/index.tsx`
- **Responsibility**: Live special with countdown and stock; launch form; end now
- **Depends on**: Staff Live Stream Hook, Live Read Hook, Design System

### QR Codes Page
- **Files**: `src/client/staff/pages/qr/*`
- **Responsibility**: Printable QR code per table (drawn in the browser); add and remove tables
- **Depends on**: Live Read Hook, Design System

### Station Page
- **Files**: `src/client/staff/pages/stations/index.tsx`
- **Responsibility**: One station's board by address (`/staff/stations/:station`), not in the nav
- **Depends on**: Kitchen Board, Staff Live Stream Hook

### Table Bill and Receipt
- **Files**: `src/client/screens/staff/TableBillScreen.tsx`, `ReceiptScreen.tsx`, `src/client/hooks/useBill.ts`, `src/client/components/staff/BillOrderCard.tsx`, `BillTotal.tsx`, `CloseTableSection.tsx`, `src/client/components/ReceiptCard.tsx`, `ConfirmModal.tsx`, `src/client/components/staff/money.ts`
- **Responsibility**: Live bill, close table with confirmation, receipt page to print; money and time formatting
- **Depends on**: Staff Live Stream Hook, Staff Session and PIN Gate, Design System

### Alerts
- **Files**: `src/client/alerts/*`
- **Responsibility**: Fire an alert once per event id and never for events older than the page; sound only after a tap and when not muted; vibration where supported
- **Depends on**: none

### Design System
- **Files**: `src/client/design/tokens.css`, `components.css`, `screens.css`, `src/client/index.css`, `src/client/staff/staff-u7.css`, `src/client/components/ui/*`, `src/client/hooks/useTheme.ts`, `src/client/lib/safeStorage.ts`
- **Responsibility**: Paprika tokens (dark default, light, follow device), type scale 12 to 40 px, spacing, radius, shadows, motion (stopped under reduced motion); UI primitives; staff stat tiles, floor tiles, data tables; theme choice saved per device
- **Depends on**: none

### Diner Table View
- **Files**: `src/client/views/TableView.tsx`, `src/client/screens/diner/*`, `src/client/components/diner/*`, `src/client/hooks/useTableSSE.ts`, `useCart.ts`, `useAllergies.ts`
- **Responsibility**: Diner app: Menu, Cart and My orders tabs, table stream with backoff and heartbeats, cart in storage, table-closed takeover
- **Depends on**: Diner Feature Modules, Design System, Alerts

### Diner Feature Modules
- **Files**: `src/client/diner/features/*`
- **Responsibility**: Options sheet, allergies, estimate, tracker, ready banner, same again, help card (calls), special card, rating, receipt, settings; `api.ts` calls; `cartModel.ts` pure cart rules
- **Depends on**: Design System, Alerts, Shared Time and Wait Helpers

## Tests

### Unit and Integration Test Suite
- **Files**: `src/server/__tests__/**`, `src/client/**/__tests__/**`, `src/test-setup.ts`, `vitest.config.ts`
- **Responsibility**: Vitest tests for every server module and client component; helpers `requestAsStaff`, `freshApp`, `makeClosedVisit`, `localIso`, `localSqlite`, `addRating`
- **Depends on**: all server and client components

### Browser Test Suite
- **Files**: `e2e/**`, `playwright.config.ts`, `playwright.cross-browser.config.ts`
- **Responsibility**: Playwright specs per Unit (`u1` to `u7`) and `build-and-test/`, each Unit with a `mockup-match.spec.ts`; global staff sign-in; helpers that place orders, move them, close tables, set presence
- **Depends on**: the built app in `dist/`, Server Entry and Route Registry
