# Code Summary — u1-walking-skeleton

## Unit

U1 `u1-walking-skeleton` — the foundation all other Bolts build on. Delivers the SQLite data model, the full HTTP + SSE API, and the React SPA shell with routing.

## Files created

### Configuration
- `package.json` — scripts (`start`, `build`, `test`, `test:e2e`, `dev`), runtime and dev dependencies
- `tsconfig.json` — strict TypeScript, ESM module resolution (bundler mode)
- `vite.config.ts` — React plugin, outDir `dist`, dev-server proxies `/api` and `/sse` to Express
- `vitest.config.ts` — pool: forks (file-level isolation), JSON reporter to `test-results/unit.json`, v8 coverage to `coverage/`
- `playwright.config.ts` — Chromium project only, webServer on `E2E_PORT` (default 3100), JSON reporter to `test-results/e2e.json`
- `index.html` — Vite entry point
- `.env.example` — `PORT=3000`, `E2E_PORT=3100`, `DB_FILE=table-order.db`

### Server
- `src/server/db.ts` — SQLite singleton via `better-sqlite3`; lazy open from `process.env.DB_FILE`; schema init; `seedIfEmpty()` (10 tables, 4 categories, 12 items); `openVisit()`, `getCurrentVisit()`, `nextOrderNumber()`, `resetDb()` (test helper)
- `src/server/sse.ts` — in-memory SSE channel manager; per-channel ring buffer (60 events); `Last-Event-ID` replay; `subscribe()`, `publish()`, `_resetForTest()`
- `src/server/repositories/menuRepo.ts` — `getMenu()`, `updateItemAvailability()`
- `src/server/repositories/orderRepo.ts` — `placeOrder()` (idempotency on `(table_id, visit_id, placement_key)`), `transitionOrder()` (legal-transition matrix, INVALID_ACTOR guard), `getOrdersByVisit()`, `getOrderByNumber()`, `getOrOpenVisit()`
- `src/server/repositories/tableRepo.ts` — `getTableStatus()`, `openVisit()`, `closeVisit()`
- `src/server/routes/menu.ts` — `GET /api/menu`, `POST /api/menu/items/:id/availability`
- `src/server/routes/orders.ts` — `POST /api/tables/:id/orders`, `GET /api/tables/:id/orders`, `POST /api/orders/:order_number/transition`, `GET /api/tables/:id`
- `src/server/routes/sse.ts` — `GET /sse/staff`, `GET /sse/tables/:id` (each sends HELLO immediately)
- `src/server/index.ts` — Express app; SPA fallback with `res.sendFile('index.html', { root: distDir })` (never absolute path); exports `app` for supertest

### Client
- `src/client/main.tsx` — React root render
- `src/client/App.tsx` — BrowserRouter; routes `/table/:id` → `TableView`, `/staff` → `StaffView`
- `src/client/views/TableView.tsx` — dark-themed shell with fixed bottom tab bar (`data-testid="tab-bar"`); tabs: Menu, Cart (badge), My orders — each with `data-testid="tab-{name}"`; real screen content owned by U2
- `src/client/views/StaffView.tsx` — dark-themed shell with `data-testid="staff-view"` and "Kitchen Board" heading; real board owned by U3
- `src/client/index.css` — CSS custom properties for dark theme

### Tests
- `src/server/__tests__/db.test.ts` — 6 tests covering seed, openVisit, getCurrentVisit, UNIQUE constraint
- `src/server/__tests__/orderRepo.test.ts` — 9 tests covering placeOrder idempotency (same table, different table), unavailable item drop, all legal/illegal status transitions, INVALID_ACTOR
- `src/server/__tests__/sse.test.ts` — 4 tests covering no-subscriber publish, SSE format, ring-buffer replay, dead-subscriber cleanup
- `src/server/__tests__/api.test.ts` — 7 integration tests via supertest covering menu shape, order placement idempotency (same table / cross-table), status transitions, error codes
- `e2e/u1-walking-skeleton/skeleton.spec.ts` — 3 Playwright tests: /table/5 loads, /staff loads, EventSource receives HELLO event within 2s
- `e2e/u1-walking-skeleton/mockup-match.spec.ts` — 2 Playwright tests: tab bar visible at /table/5, staff-view visible at /staff; screenshots saved to `test-results/mockup-match/u1-walking-skeleton/`

## Key decisions

1. **ESM throughout** — `"type":"module"` in `package.json`. Tests use `pool: forks` with `process.env.DB_FILE = ':memory:'` set at the top of each test file (before any import), so the lazy singleton opens a fresh `:memory:` DB per test file.

2. **`res.sendFile('index.html', { root: distDir })` only** — never `res.sendFile(<absolute path>)`. This is mandatory because parallel Bolts run in worktrees under `.aidlc/worktrees/` (a dot-folder) and Express refuses absolute paths that traverse dot-folders.

3. **Ports and DB from env vars** — `PORT` (default 3000), `E2E_PORT` (default 3100), `DB_FILE` (default `'table-order.db'`). The Playwright webServer uses `E2E_PORT` and `DB_FILE=:memory:`.

4. **`better-sqlite3` v13** — v9 fails to build against Node 24 due to a node-gyp header incompatibility. v13 builds cleanly.

5. **OrderError message includes error code** — `"ILLEGAL_TRANSITION: Transition from..."` so both `toThrow(/ILLEGAL_TRANSITION/)` assertions and HTTP route `error.code` checks work from the same thrown instance.

6. **`order_counter` table** — a single-row table with `next_order_number` incremented atomically via `UPDATE ... RETURNING`. This gives monotonically increasing order numbers without relying on `AUTOINCREMENT` on the orders table.

## Test coverage summary

Unit tests: **27 passed, 0 failed** (`npm test`)

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/server/db.ts` | 98.7% | 88.9% | 100% | 98.7% |
| `src/server/sse.ts` | 94.8% | 84.2% | 100% | 94.8% |
| `src/server/repositories/orderRepo.ts` | 79.9% | 80.8% | 66.7% | 79.9% |
| `src/server/repositories/menuRepo.ts` | 81.0% | 100% | 50% | 81.0% |
| `src/server/repositories/tableRepo.ts` | 84.6% | 75% | 33.3% | 84.6% |
| `src/server/routes/orders.ts` | 64.0% | 50% | 100% | 64.0% |

E2E tests: **5 passed, 0 failed** (`npm run test:e2e`)

- table view shell — tab bar visible at /table/5 ✅
- staff view shell — staff-view visible at /staff ✅
- EventSource /sse/tables/5 — receives an event within 2 seconds ✅
- table view shell — tab bar visible at /table/5 (mockup-match) ✅
- staff view shell — staff-view visible at /staff (mockup-match) ✅

## Bugs found by the tests and fixed

1. **`require()` in ESM project** — Tests initially used `require('../db')` for module isolation. In an ESM project (`"type":"module"`), `require()` is unavailable. Fixed by switching to static ESM imports and setting `process.env.DB_FILE = ':memory:'` before the import declaration, with `pool: forks` in vitest.config.ts for file-level module isolation.

2. **OrderError message did not contain error code** — `toThrow(/ILLEGAL_TRANSITION/)` failed because the error message was `"Transition from Pending to Completed..."` with no code string. Fixed by prepending the code: `super(\`${code}: ${message}\`)`.

3. **`better-sqlite3` v9 build failure on Node 24** — node-gyp headers incompatible. Fixed by upgrading to `better-sqlite3` v13.

4. **Missing `express.static()` middleware** — Express served `dist/index.html` via the wildcard route but had no static handler for `/assets/`. Without it, the browser could not load the React JS bundle so React never mounted and Playwright found no `data-testid` elements. Fixed by adding `app.use(express.static(distDir))` before the wildcard route in `src/server/index.ts`.

## Review findings (advisory — fixed)

Architecture review verdict: **READY**. Two minor findings, both fixed:

- **Minor: transition body field name** — Plan prose said `status`; the actual request body field is `to`. Code and tests are consistent. Fixed by adding a JSDoc comment to the route handler documenting the actual field name, so future Bolt builders are not confused.
- **Minor: port precedence** — `PORT ?? E2E_PORT ?? '3000'` means a globally-set `PORT` env var shadows `E2E_PORT` during E2E runs. Fixed by adding a warning comment in `.env.example` advising against setting `PORT` globally.
