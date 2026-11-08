## Developer Code Scan Results

Repo: `table-order` (snapshot paths `./`, head commit 70f4eba6315a5fbbd8347c7109d1b908167af2d3). Depth: Standard. Read-only scan: no tests, builds or app were run.

### Scan Coverage
- **Analyzed deeply**:
  - `src/server/` (db.ts, index.ts, sse.ts, routes/*, repositories/*)
  - `src/client/` (main.tsx, App.tsx, index.css, views/*, screens/*, components/*, hooks/*): the app shell, router, global stylesheet, every hook, and the server-facing parts of every screen. The long render sections of MenuScreen, CartScreen, MyOrdersScreen, OrderCard, BillOrderCard and MenuAvailabilityPanel were read in part (state, fetches, test ids, accessibility hooks), not line by line.
  - Root config: `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `playwright.cross-browser.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `.gitignore`, `aidlc.settings.json`, `unit-test-instructions.md`
  - `e2e/build-and-test/helpers.ts`, `e2e/u1-walking-skeleton/skeleton.spec.ts`, and the header and first tests of `e2e/u4-bill-and-close/mockup-match.spec.ts` and `e2e/build-and-test/motion.spec.ts`
  - `src/test-setup.ts`, `src/test-types.d.ts`, `src/server/__tests__/db.test.ts` (head)
- **Skimmed only**:
  - `src/server/__tests__/` (other 9 files): names, counts and sizes only
  - `src/client/**/__tests__/`: names and counts only
  - `e2e/u2-diner-screens/`, `e2e/u3-kitchen-board/`, remaining `e2e/build-and-test/` specs, other mockup-match specs: names, sizes and heads only
  - `package-lock.json`: not read, only its existence noted
  - `test-results/unit.json`, `coverage/coverage-summary.json`: totals only (stale build artifacts, read for the figures v1 last reported)
- **Left out**:
  - `node_modules/`, `dist/`, `coverage/` (contents), `test-results/` (screenshots and reports), `playwright-report/`
  - `table-order.db`, `table-order.db-shm`, `table-order.db-wal` (local SQLite files, ignored by `.gitignore`)
  - `.DS_Store`
  - AI-DLC's own install and workspace: `.claude/`, `.aidlc/`, `aidlc/`, and AI-DLC's marked section in `.gitignore`
  - `ideas/`, `V2 Scope/`, `.git/`

### Packages Found
- `table-order` — single npm package (ESM, `"type": "module"`), not a workspace — TypeScript — Express API + SSE server and a React single-page app in one repo
- `src/server` — Node/Express server — TypeScript — REST API, Server-Sent Events hub, SQLite persistence, serves the built SPA
- `src/client` — React SPA — TypeScript/TSX — diner screens (`/table/:id`) and staff screens (`/staff`)
- `e2e` — Playwright suites — TypeScript — browser tests per unit plus Build and Test specs

### Build System
- **Type**: npm scripts; Vite 5 for the client bundle; `tsx` runs the server directly from TypeScript (no server compile step); Vitest for unit tests; Playwright for browser tests
- **Config Files**: `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `playwright.cross-browser.config.ts`, `tsconfig.json` (strict, `noEmit`, path aliases `@server/*` and `@client/*` declared but not used by the code read), `.env.example`
- **Scripts**: `start` = `tsx src/server/index.ts`; `dev` = `concurrently "tsx watch src/server/index.ts" "vite"`; `build` = `vite build` (to `dist/`); `test` = `vitest run --reporter=verbose --reporter=json --outputFile=test-results/unit.json --coverage`; `test:e2e` = `playwright test --reporter=json --output=test-results/e2e.json`; `preview` = `vite preview`
- **Verification command**: `npm test && npm run test:e2e`
- **Build Dependencies**: the server serves `dist/` (output of `vite build`); the Playwright web server runs `tsx src/server/index.ts` against whatever `dist/` already exists, so e2e needs a prior `npm run build`. If `dist/index.html` is missing the server returns a minimal placeholder page.
- **Environment variables**: `PORT` (default 3000), `E2E_PORT` (default 3100, read when `PORT` is unset: `PORT ?? E2E_PORT ?? 3000`), `DB_FILE` (default `table-order.db`, relative to the working folder; `:memory:` for e2e and unit tests). `CI` toggles Playwright retries and `forbidOnly`.

### APIs Discovered
- REST (Express, JSON) — `src/server/routes/*.ts`, mounted at `/api` — 8 endpoints:
  - `GET /api/menu`
  - `POST /api/menu/items/:id/availability` body `{available: boolean}`
  - `POST /api/tables/:id/orders` body `{placement_key, lines:[{menu_item_id, quantity 1..20}]}`; 201 new order, 200 repeated placement_key (nothing published), 400 `INVALID_REQUEST`/`EMPTY_ORDER`/`INVALID_QUANTITY`/`UNKNOWN_ITEM`, 404 `UNKNOWN_TABLE`
  - `GET /api/tables/:id/orders?visit=current`
  - `POST /api/orders/:order_number/transition` body `{to, by: "diner"|"staff"}`; 400, 404 `UNKNOWN_ORDER`, 422 `ILLEGAL_TRANSITION`
  - `GET /api/tables/:id` (table status incl. `last_closed_visit_id`)
  - `GET /api/tables/:id/bill`
  - `POST /api/tables/:id/close`; 409 `TABLE_ALREADY_CLOSED`, 422 `CLOSE_BLOCKED` (with `details.blocking_orders`) or `TABLE_EMPTY`
- Error envelope everywhere: `{ error: { code, message, details? } }`. No authentication, authorization, rate limiting or CORS configuration of any kind.
- SSE — `src/server/routes/sse.ts`, mounted at `/sse` — 2 streams: `GET /sse/staff` (channel `staff`) and `GET /sse/tables/:id` (channel `table:<id>`). Event types: `ORDER_PLACED`, `ORDER_STATUS_CHANGED`, `TABLE_CLOSED`, `MENU_AVAILABILITY_CHANGED` (published); `HELLO` (sent to the opening connection only, no id, not buffered). `TABLE_STATUS_CHANGED` is listened for by `useStaffSSE` but never published by the server. Stream details: `retry: 2000` hint, 20 s `: keep-alive` comments, per-channel ring buffer of 60 events, replay from `Last-Event-ID` header or `?lastEventId=` query value, event ids start at `Date.now()` so they keep rising across a restart.
- Page routes (client router, served by the server's catch-all): `/table/:id` (diner), `/staff` (kitchen board), `/staff/tables/:id` (table bill), `/` and any unknown path redirect to `/staff`.

### Frameworks & Libraries
- express — ^4.18.3 — HTTP server
- better-sqlite3 — ^13.0.0 — synchronous SQLite driver
- react / react-dom — ^18.3.1 — UI
- react-router-dom — ^6.22.3 — client routing
- vite — ^5.1.6 with @vitejs/plugin-react ^4.2.1 — dev server and bundler (dev proxy sends `/api` and `/sse` to `http://localhost:3000`)
- typescript — ^5.4.2; tsx ^4.7.1; concurrently ^8.2.2
- vitest ^1.4.0 with @vitest/coverage-v8 ^1.4.0, jsdom ^29.1.1, @testing-library/react ^16.3.3, @testing-library/user-event ^14.6.8, @testing-library/jest-dom ^7.0.1, supertest ^6.3.4
- @playwright/test — ^1.42.1 — browser tests
- Runtime used without a package: Node `crypto.randomUUID()` (global), browser `EventSource`, `IntersectionObserver`, `localStorage`, `sessionStorage`

### Test Coverage
- **Test Directories**: `src/server/__tests__/` (10 files: api, billing-api, billing, db, menu-availability, orderRepo, sse-hello, sse, tableClose, tableStatus); `src/client/**/__tests__/` (components, hooks, screens, views); `e2e/u1-walking-skeleton`, `e2e/u2-diner-screens`, `e2e/u3-kitchen-board`, `e2e/u4-bill-and-close`, `e2e/build-and-test`
- **Test Frameworks**: Vitest (server tests in `node`, client tests in `jsdom` via `environmentMatchGlobs`, `pool: forks` with isolation, setup file `src/test-setup.ts`); Supertest for API tests; Testing Library for components; Playwright (Chromium only in the default config; `playwright.cross-browser.config.ts` runs Google Chrome and WebKit and ignores mockup-match specs)
- **Last recorded results** (stale files from v1 sign-off, not re-run): 322 unit tests, all passing, 77 suites; coverage total 92.95% lines, 84.55% functions, 86.2% branches. About 50 Playwright tests (grep count of `test(` lines).
- **Coverage Config**: present (v8, reporters `text` and `json-summary`, output `coverage/`); no coverage threshold is set in `vitest.config.ts`.
- **Playwright e2e specifics**: `workers: 1`, `fullyParallel: false` (all specs share one server and one in-memory database); the web server is started with `E2E_PORT=<port> DB_FILE=:memory: tsx src/server/index.ts`; `reuseExistingServer: false`; JSON reporter to `test-results/e2e.json`. Specs use `resetTable()` in `e2e/build-and-test/helpers.ts` (cancel open orders, then close the table) for clean-up.
- **Mockup-match specs**: `e2e/<unit>/mockup-match.spec.ts` for u1 to u4. They open v1's refined-mockup `preview.html` from `aidlc/spaces/default/intents/261105-table-order-app/inception/refined-mockups/` (hard-coded relative path) and save screenshot pairs to `test-results/mockup-match/<unit>/`. They use `test.use({ reducedMotion: 'reduce' })`.
- **Test data conventions**: specs address fixed seeded tables (e.g. table 5) and seeded item ids (`i-01`...`i-12`); unit tests set `process.env.DB_FILE = ':memory:'` before importing the db module and call `resetDb()`.

### Code Quality Indicators
- **Linting**: none found (no ESLint, Prettier or Biome config or dependency). Type checking via `tsc` settings (`strict: true`) exists but there is no `typecheck` script.
- **CI/CD**: none found (no `.github/`, no pipeline files, no Dockerfile)
- **Documentation**: no README in the repo root; `.env.example` explains the three env vars; `unit-test-instructions.md` is a U2-specific note. Source files carry good explanatory comments (race handling, contracts, rationale).

### Technical Debt Signals
- No authentication or authorization anywhere: staff screens (`/staff`, kitchen board, bill, close table, menu availability toggle) and every staff API (`/api/orders/:n/transition` with `by:"staff"`, `/api/tables/:id/close`, `/api/menu/items/:id/availability`) are open to any caller; the actor in a transition (`by`) is trusted from the request body. Directly relevant to the v2 Staff PIN feature.
- Schema is created with `CREATE TABLE IF NOT EXISTS` in `src/server/db.ts` `initSchema` on every start. There is no migration framework or schema-version table: an existing database file would NOT get new columns from an edited `CREATE TABLE`. v2 additions need `ALTER TABLE ... ADD COLUMN` with defaults (guarded by `PRAGMA table_info`) or new `CREATE TABLE IF NOT EXISTS` statements. The `tables.status` column exists but is not used (state is derived from `visits`).
- Seed data runs only when the `tables` table is empty (`seedIfEmpty`, called from `index.ts` only when run as the entry point): 10 tables, 4 categories, 12 items with emoji as `image`. No allergen, option, station, prep-time or rating columns exist.
- Prices are stored per order line (`order_items.unit_price_cents`), not looked up from the menu later. Order numbers come from a one-row `order_counter` table (global, not per table).
- Timestamps are mixed: `orders.placed_at` is an ISO-8601 string written by app code; `visits.opened_at` and `closed_at` use SQLite `datetime('now')` (UTC, `YYYY-MM-DD HH:MM:SS`, no `T` or `Z`). Anything v2 builds over past visits and sales must cope with both formats.
- `TABLE_COUNT = 10` is hard-coded in `useBoardOrders.ts`; the board fetches `/api/tables/1..10/orders?visit=current` (10 requests per board load). There is no "list tables" endpoint, so a live floor map or table management would need one.
- No server-side placement-key comment fix: `orderRepo.placeOrder` comment says "return 409" but the route returns 200 for a duplicate; harmless but misleading.
- SSE: in-process, single-node state (subscriber sets and ring buffers in memory). `MENU_AVAILABILITY_CHANGED` is published to all 10 table channels by querying `tables`. Client hooks keep the newest 200 events; consumers must read `events` by `seq`, never only `lastEvent`.
- Styling: nearly all styling is inline `style={{...}}` objects (183 occurrences in non-test TSX) with about 143 literal colour values (hex or rgba) mixed with CSS variables; a few components inject `<style>` blocks. Only `src/client/index.css` defines tokens, and only for a dark theme. Components fall back to dark hex values inside `var(--x, #...)`. This is the main cost for a design system and Dark mode (light/dark switching).
- Duplicated definitions: `OrderStatus`, `OrderLine`, `Order` types and status icon/colour maps are redeclared across `useBoardOrders`, `useBill`, `MyOrdersScreen`, `BillOrderCard`, `OrderCard`; `formatPrice` is redefined in several screens; `useMenuAvailability` and `MenuScreen` each define menu types.
- Large files: `MenuScreen.tsx` 497 lines, `CartScreen.tsx` 370, `MyOrdersScreen.tsx` 375, `TableView.tsx` 336.
- Hard-coded v1 mockup path in mockup-match specs ties the test suite to the v1 record folder (which must stay in place).
- No TODO/FIXME/HACK or lint/ts suppression comments found in `src` or `e2e`.
- Minor: path aliases in `tsconfig.json` are declared but the build tools (Vite, Vitest) have no matching alias config; the code uses relative imports so nothing breaks. Server files import with `.js` extensions in TS (ESM/tsx style); client files mix `.js` and no extension.

## Handoff Summary
- **Intent-relevant finding**: v1 is a small, clean, well-tested monolith with exactly 4 client areas to extend: diner (`TableView` with 3 tabs), kitchen board, table bill, menu-availability panel. All state flows through 3 repositories over a SQLite file (`src/server/db.ts` `initSchema`), 8 REST endpoints, and two SSE channels (`staff`, `table:<id>`) published from the route handlers (`src/server/routes/orders.ts`, `billing.ts`, `menu.ts`). New v2 live events must be added in three places: the route that publishes, the named-event list in `src/client/hooks/useTableSSE.ts` (lines 94-99) and in `src/client/hooks/useStaffSSE.ts` (lines 47-53); an event type not in those lists is silently ignored by the browser hooks.
- **Risks / follow-up**:
  - Database changes must only add (team rule): there is no migration mechanism, so v2 needs a guarded additive migration step inside `getDb()`/`initSchema` that runs on an existing file; `seedIfEmpty` will not re-run on a populated database, so new seed rows (stations, option sets, allergens, a staff PIN) need their own idempotent seed step.
  - Orders have no per-line options, notes, station, ready/served timestamps or prep times: Make it yours, Allergy shield, Kitchen stations, ticket timers, order tracker and Honest wait time all need new columns or tables. `status` is a free text column with 4 legal values and a fixed transition table (`LEGAL_TRANSITIONS` in `orderRepo.ts`); changing it affects the bill, board, close-table rules and many tests.
  - No auth exists, and the server trusts `by` from the body: Staff PIN will have to protect staff routes and likely the SSE `staff` channel.
  - The v1 tests that most constrain changes: exact seed counts in `db.test.ts` (10 tables, 4 categories, 12 items), mockup-match specs for all four units (text, headings, labels and screenshots), and `e2e/build-and-test` motion, keyboard-journey and timing specs.
  - Styling: dark-only tokens in `index.css` plus inline hex values; a design system with Dark mode must first move literals to tokens in all v1 screens, and keep the bottom tab bar, sticky category pills, 44 px touch areas, reduced motion and keyboard access.
  - Server serves the SPA with `res.sendFile('index.html', { root: distDir })` and `express.static(distDir)`; the catch-all `app.get('*')` is registered after `/api` and `/sse`, so new API/SSE routers must be mounted before it (and new routes need the `/api` or `/sse` prefix, or a client route must be handled by the catch-all, as for QR code landing pages).
  - Pages run only after `npm run build`; `npm run dev` serves the client from Vite with a proxy to port 3000.
