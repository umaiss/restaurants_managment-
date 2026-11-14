# Developer Code Scan: table-order

Repo: `table-order` (unrecorded project-root repo). Breadth: full rescan of `./`. Depth: Standard.
Snapshot head commit: `49b31b1cddc50bd3f1bbb4447fcedc24c0d8faf4`. Scan date: 2026-11-10. Read only: no tests, builds or programs were run.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `./` (whole repo, full rescan; every tracked source file was listed and classified)
  - `src/server/` (every production file read in full: entry, config, db, errors, time, sse, presence, staffAccess, menuEvents, background, all `repositories/`, all `routes/` including `routes/u7/`, `services/`)
  - `src/shared/` (`time.ts`, `wait.ts`, read in full)
  - `src/client/staff/` (shell, PIN screen, session hook, `staffAuth.ts`, page registry, `useLiveRead.ts`, `board/`, `pages/floor/`, `pages/sales/`, `pages/qr/`, `pages/stations/`, `staff-u7.css`)
  - `src/client/design/` (`tokens.css`, `components.css`, `screens.css`)
  - `src/client/components/ui/` (all primitives, `Icon.tsx`, `SideNav.tsx`)
  - `src/client/hooks/` (`useStaffSSE.ts`, `eventNames.ts`, `useBoardOrders.ts`, `useTheme.ts`, `useSoundPreference.ts`; others opened at the top)
  - `src/client/App.tsx`, `src/client/main.tsx`, `src/client/index.css`, `src/client/views/StaffView.tsx`, `src/client/screens/staff/KitchenBoardScreen.tsx`, `src/client/lib/safeStorage.ts`, `src/client/components/staff/money.ts`
  - Root config: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `playwright.cross-browser.config.ts`, `index.html`, `.env.example`, `.gitignore`, `README.md`
- **Skimmed only**:
  - `src/client/screens/diner/`, `src/client/views/TableView.tsx`, `src/client/diner/features/` (opened at the top, structure and contracts noted)
  - `src/client/staff/pages/menu/`, `src/client/staff/pages/special/`, `src/client/screens/staff/TableBillScreen.tsx`, `src/client/components/staff/`, `src/client/alerts/`
  - `src/server/__tests__/`, `src/client/**/__tests__/` (helpers read; test bodies sampled)
  - `e2e/` (helpers and global setup read; specs listed and sampled)
  - `ideas/`, `V2 Scope/` (product briefs; first pages read)
- **Left out**:
  - `node_modules/` (dependencies)
  - `dist/` (build output)
  - `coverage/` (coverage output)
  - `test-results/` (test output)
  - `table-order.db`, `table-order.db-shm`, `table-order.db-wal` (SQLite data, ignored)
  - `.DS_Store` files (ignored)
  - AI-DLC's own install: `.claude/`, `.aidlc/`, `aidlc/`, `aidlc.settings.json`, the AI-DLC block of `.gitignore`

### Packages Found
- `table-order` 1.0.0 — single npm package, ESM (`"type": "module"`) — TypeScript — restaurant table ordering app: React SPA (`src/client`) and Express + SQLite API with Server-Sent Events (`src/server`), shared pure helpers (`src/shared`)

### Build System
- **Type**: npm scripts; Vite 5 for the client bundle; `tsx` runs the server TypeScript directly (no server compile step)
- **Config Files**: `package.json`, `package-lock.json`, `tsconfig.json` (strict, `noEmit`, bundler resolution, path aliases `@server/*`, `@client/*` declared but not used in imports), `vite.config.ts` (dev proxy `/api` and `/sse` to `PORT`), `vitest.config.ts`, `playwright.config.ts`, `playwright.cross-browser.config.ts`
- **Build Dependencies**: `npm run build` (vite) writes `dist/`; `npm start` (tsx `src/server/index.ts`) serves `dist/` as static files plus the SPA fallback; `npm run dev` runs `tsx watch` and Vite together; the browser tests need `dist/` built first

### APIs Discovered
- REST (JSON) — `src/server/routes/*.ts`, mounted at `/api` through `routes/registry.ts` — 36 method+path routes: 14 open (diner routes, staff login and logout, and the order transition, whose `by=staff` form needs a session) and 22 behind the staff session (1 of them a leftover 501 stub)
- Server-Sent Events — `src/server/routes/sse.ts`, mounted at `/sse` — 2 streams: `/sse/staff` (staff session required) and `/sse/tables/:id` (open); 10 published event types plus a per-connection `HELLO`
- SPA routes — `src/client/App.tsx` — `/table/:id` (diner), `/staff/*` (staff shell with 9 registered pages)

### Frameworks & Libraries
- react / react-dom — ^18.3.1 — UI
- react-router-dom — ^6.22.3 — client routing
- express — ^4.18.3 — HTTP API
- better-sqlite3 — ^13.0.0 — synchronous SQLite access, WAL mode
- qrcode — ^1.5.4 — QR codes drawn in the browser
- @fontsource-variable/inter — ^5.3.0 — self-hosted Inter font
- vite — ^5.1.6 with @vitejs/plugin-react ^4.2.1 — bundler and dev server
- typescript — ^5.4.2; tsx — ^4.7.1 — type checking and server runtime
- vitest — ^1.4.0 with @vitest/coverage-v8 — unit and integration tests
- @testing-library/react ^16.3.3, @testing-library/user-event ^14.6.8, @testing-library/jest-dom ^7.0.1, jsdom ^29.1.1 — component tests
- supertest — ^6.3.4 — HTTP tests against the Express app
- @playwright/test — ^1.42.1 — browser tests (Chromium, Chrome, WebKit; never Firefox)
- concurrently — ^8.2.2 — dev script

### Test Coverage
- **Test Directories**: `src/server/__tests__/` (with `foundation/`, `u6/`, `u7/`, `integration/`, `helpers/`), `src/client/**/__tests__/`, `e2e/` (one folder per Unit `u1-walking-skeleton` to `u7-staff-kitchen-features`, plus `build-and-test/` and `helpers/`)
- **Test Frameworks**: Vitest (node environment for server, jsdom for `src/client/**`), Testing Library, supertest, Playwright
- **Coverage Config**: present (`vitest.config.ts`: v8 provider, `coverage/coverage-summary.json`); no threshold is set in config. README reports 1,485 unit and integration tests and about 94.6% line coverage, 170 Chromium browser tests and 212 Chrome and WebKit runs (not re-run in this scan)

### Code Quality Indicators
- **Linting**: no ESLint or Prettier config in the repo, although source carries `eslint-disable` comments (7 occurrences). Type checking through `npx tsc --noEmit` (strict)
- **CI/CD**: none (no `.github/workflows`, no pipeline files); README says there is no deployment setup and the app runs on one machine on the restaurant network
- **Documentation**: README is thorough (setup, settings, tests, layout, known limits). Source files carry header comments naming the business rules they implement (BR/FR ids from the AI-DLC records) and explain non-obvious decisions

### Technical Debt Signals
- Leftover guarded stub: `src/server/routes/staff-qr.ts` still registers `GET /api/staff/qr/:table` answering 501 `NOT_BUILT` (QR codes are drawn in the browser); tests assert the stub (`guard.test.ts`, `routeOrder.test.ts`)
- Unused component: `src/client/staff/pages/PagePlaceholder.tsx` is imported nowhere
- Inconsistent error mapping: `routes/orders.ts` and `routes/billing.ts` build error envelopes by hand with per-code `if/else`, while U5 and U7 routes use `AppError` with `sendIfAppError` / `sendU7Error`; two status maps exist (`errors.ts` `STATUS_BY_CODE`, `routes/u7/errors.ts` `U7_STATUS_BY_CODE`)
- `getSales()` (`routes/u7/sales.ts:49`) reads every closed visit and every order line in the database on each call and filters days in memory; cost grows with history
- `getRatings()` (`routes/u7/sales.ts:172`) reads every rating ever made, then filters by local day in memory
- `useBoardOrders` (`src/client/hooks/useBoardOrders.ts:131`) fetches each listed table's orders with its own request (one request per table, up to 50 tables) on load and on each reconnect
- Two stored time formats (v1 `YYYY-MM-DD HH:MM:SS`, v2 ISO) are mixed in the same columns; every reader must go through `parseStoredTime`. `buildBill` sorts by `placed_at.localeCompare`, which mis-orders across the two formats
- Large screen files with inline styles: `MenuScreen.tsx` (623 lines), `CartScreen.tsx` (495), `MyOrdersScreen.tsx` (393), `TableView.tsx` (386); `screens.css` overrides their inline styles with attribute selectors and `!important`
- Duplicate helpers: `formatPrice` in diner screens vs `formatMoney` in `components/staff/money.ts`; `formatTime` in `OrderCard.tsx` vs `formatPlacedTime` in `money.ts`
- Kitchen Board table header shows `Table {id}` rather than the table's label (`KitchenBoardScreen.tsx:244`)
- `--ease-spring` is defined twice (`tokens.css` and `index.css`)
- Staff sessions and login lockouts live only in server memory (`staffAccess.ts`): a restart signs every device out
- No linter config despite lint-disable comments; no CI

## Handoff Summary
- **Intent-relevant finding**: The Manager TV wall has no single existing source for its numbers. (1) Today's takings: the only sales calculation, `getSales()` in `src/server/routes/u7/sales.ts:49-153` (served at `GET /api/staff/sales`, `routes/staff-sales.ts:12`), counts only CLOSED visits, grouped by the server-local day of `visits.closed_at`, excluding Cancelled orders, at frozen line prices; money on tables still open is not counted anywhere except the per-table bill (`billingRepo.buildBill`, `src/server/repositories/billingRepo.ts:78`). (2) Top dish: `best_sellers` in the same function (top 5 by quantity, ties by name), again closed visits only. (3) Busiest table: no calculation exists. (4) Live orders with waits: no single "all open orders" read exists; the Kitchen Board composes `GET /api/staff/tables` plus one `GET /api/tables/:id/orders?visit=current` per table (`src/client/hooks/useBoardOrders.ts:103-212`); waits are computed in the browser from `placed_at` with `TicketTimer` (green, amber "Slow" at 8 min, red "Late" at 15 min; `src/client/staff/board/constants.ts:4-6`) or from the stored `estimate_minutes` with `waitDisplay` (`src/shared/wait.ts:15`). (5) Staff navigation: pages are added only through `STAFF_PAGES` in `src/client/staff/pages/registry.tsx:29-39`; every page renders inside `StaffShell` (side nav plus top bar, `src/client/staff/StaffShell.tsx:36-74`), so a full-screen wall needs either a new layout path or a page that accepts the shell; nav icons map emoji to SVG through `EMOJI_TO_ICON` (`src/client/components/ui/Icon.tsx:29-32`). (6) Staff API protection: any new `/api/staff/*` route is guarded automatically as long as its module is listed after `staff` in `routeModules` (`src/server/routes/registry.ts:38-54`; guard at `src/server/routes/staff.ts:53`). (7) Live updates: one shared `EventSource` to `/sse/staff` per page (`src/client/hooks/useStaffSSE.ts:35-84`); a new event type must be added to `EVENT_NAMES` (`src/client/hooks/eventNames.ts:5-16`) or browsers ignore it; `useLiveRead` (`src/client/staff/pages/useLiveRead.ts:57`) is the established "read, then re-read on these events and on reconnect" pattern. (8) Settings: there is no server-side settings store; per-device preferences (theme, sound) live in `localStorage` through `src/client/lib/safeStorage.ts`.
- **Risks / follow-up**:
  - A wall left open all day can be signed out: staff sessions end after 12 hours without a staff request (`STAFF_IDLE_MS`, `src/server/config.ts:34`), the staff stream deliberately does not refresh the idle time (`requireStaff({ refresh: false })`, `src/server/routes/sse.ts:18`), sessions are lost on server restart, and the cookie has no expiry so closing the browser ends it. Only re-reads through `staffFetch` refresh the session.
  - "Today" has two meanings in the code: sales use the server-local day of `closed_at`; the wait estimate uses the server-local day of `placed_at` (`localDayBounds`, `src/server/time.ts:14`). The wall's takings definition (closed only, or closed plus open tables) must be decided explicitly.
  - Both stored time formats must be read with `parseStoredTime` (`src/shared/time.ts:6`); text comparison of times is unsafe.
  - `getSales()` and `getRatings()` scan all history on each call; a wall that re-reads on every order event multiplies that cost.
  - A hide-takings setting has no existing home: per-device (`localStorage`) vs server-wide (a new additive table through `upgradeSchema` steps, `src/server/db.ts:128`) is a decision for Requirements.
  - Existing tests pin exact lists the wall would extend: `src/client/staff/__tests__/StaffShell.test.tsx:38,52,60` (page keys, nav labels, non-nav keys), `src/client/hooks/__tests__/liveHooksV2.test.ts:53-72` (`EVENT_NAMES`), `src/server/__tests__/foundation/routeOrder.test.ts:65-78` and `src/server/__tests__/u7/routeOrder.test.ts:39-42` (exactly five `owner: 'U7'` modules; `RouteModule.owner` is typed `'v1' | 'U5' | 'U7'`). Adding a nav page changes the first; a new event name changes the second; a new route module needs a new owner value.
  - Project rules apply: v1/v2 behaviour, screens and tests must stay unchanged unless chosen; database changes only add; every port and DB file from env vars; new e2e specs go in `e2e/<unit>/` with a mockup-match spec.
