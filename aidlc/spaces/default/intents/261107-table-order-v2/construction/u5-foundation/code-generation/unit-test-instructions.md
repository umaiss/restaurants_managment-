# Unit Test Instructions: u5-foundation

How to run the tests for U5, the foundation Unit of Table Order v2. The strategy is Standard (5 to 8 tests per component, plus integration tests for key boundaries), the method is test-after, and the scope adds no new-test floor. v1's tests stay in the suite and must keep passing.

## Test framework and setup

- **Unit and integration tests:** Vitest 1.x with `@testing-library/react` and jsdom for client code, `supertest` for the server. The runner and its configuration already exist from v1 (`vitest.config.ts`); nothing new is installed.
- **Browser tests:** Playwright with Chromium (`playwright.config.ts`). The installed Chrome and WebKit are checked at Build and Test with `playwright.cross-browser.config.ts`. Firefox is not installed or tested.
- **Environment (no value is written in code):** `PORT` (the app, default 3000), `E2E_PORT` (browser tests, default 3100; specs that need their own server use +100 and +200), `DB_FILE` (the database file; tests use `:memory:`), `STAFF_PIN` (the test setup sets `4242`).
- **Before a build:** stop the app on port 3000. Start it again only after the tests and the mockup match pass.

## How to run this Unit's tests

The runner is ready before the first test (Step 2 of the plan checks it). Run these from the main folder, each as its own command.

1. **New server tests** (database upgrade, repositories, business logic, routes, timing):

   ```
   npx vitest run src/server/__tests__/foundation --coverage.enabled=false
   ```

2. **New client tests** (design tokens, shared components, preferences, alerts, staff shell, diner mount points, live hooks):

   ```
   npx vitest run src/client/design src/client/components/ui src/client/alerts src/client/staff src/client/diner src/client/hooks --coverage.enabled=false
   ```

3. **v1 regression** (U5 changes v1 files, so v1's server and client tests all run again and must stay green):

   ```
   npx vitest run src/server/__tests__ src/client/components src/client/screens src/client/views --coverage.enabled=false
   ```

4. **Browser tests for this Unit** (starts its own server on `E2E_PORT` with an in-memory database):

   ```
   npx playwright test e2e/u5-foundation
   ```

   This runs the main-flow spec and the mockup-match spec. The mockup-match spec saves its screenshot pairs in `test-results/mockup-match/u5-foundation/`; look at every pair.

5. **v1's browser tests** (they now sign in as staff through `e2e/helpers/`):

   ```
   npx playwright test e2e/u1-walking-skeleton e2e/u2-diner-screens e2e/u3-kitchen-board e2e/u4-bill-and-close
   ```

The full check for the project, run at the Unit checkpoint and at Build and Test, is `npm test && npm run test:e2e`.

## What is tested, by component

| Component | Tests (about) | What they check |
|---|---|---|
| Database upgrade and seed (TableSessions, MenuCatalog) | 7 | v1 file upgraded with all rows kept; second run changes nothing; seed counts 10 / 4 / 12; Grilled Salmon allergens not set; half-upgraded file finishes |
| MenuCatalog and OrderManagement repositories | 18 | hidden items, options, allergens, stations; the checks of BR3.1 in order; frozen price, station and options; dropped lines; repeated key; all or nothing |
| ChefSpecials | 8 | launch validation, one live special, guarded stock, last one to one diner, expiry |
| ServiceCalls and DishRatings | 12 | one open call per kind, respond, cleared at close; rating order of checks, replace until Done, RATING_LOCKED |
| StaffAccess | 10 | PIN source, session cookie, lockout by address, 12-hour idle end, random PIN printed once |
| WaitEstimation and transitions | 12 | formula, both timestamp formats, "Running late"; every legal and illegal move per actor, `completed_at` |
| LiveEvents (presence, streams) | 10 | 5-minute window, sweep, caps, one event per second, session streams closed on sign-out |
| ApiRoutes | 18 | every staff route 401 without a session, diner routes open, stubs 401 then 501, route order, 300 ms timing |
| Design system, preferences, alerts | 14 | tokens in both themes, contrast, saved theme / sound / allergies with blocked storage, alert once per event |
| Staff and diner shells, live hooks | 12 | PIN screen, return to PIN on 401, navigation registry, mount points, event names registered, heartbeat |
| Restyled screens | v1's existing tests plus about 6 new | shared components on every screen, theme control, Cart count |

## Browser tests (Playwright, `e2e/u5-foundation/`)

About 25 tests for the main flows: PIN screen and lockout, return to the PIN screen without a session, the theme control and its saved choice, an order with options reaching the staff board within 2 seconds, the last special going to one diner, calls and ratings through the helpers, presence, the kept parts of v1's look (tab bar, category pills, 44 px touch areas), and reduced motion. The mockup-match spec compares `design-system`, `staff-pin` and the U5 parts of `diner-menu`, `diner-cart`, `diner-orders`, `staff-board` and `staff-bill` in both themes, and lists the parts U6 and U7 own.

## Expected coverage targets

No coverage threshold is set in the project and none is added or lowered. The scope's floor adds nothing beyond the strategy. Build and Test measures any floor the project defines on the full suite of the assembled project; a Unit-scoped run does not judge it. Every command above runs with coverage off, so a threshold exit can never stop a later step.

## Mocking and stubbing guidance

- Server tests use the real SQLite engine with `DB_FILE=:memory:` and reset the database between tests (`resetDb`), never a mocked database.
- Time: use Vitest fake timers for the 12-hour idle end, the 5-minute presence window, the sweeps and the special's expiry. Never wait in real time.
- Client tests mock `fetch` and `EventSource` (v1's tests already do) and use `localStorage` stubs for blocked storage.
- Staff routes are tested with a signed-in `supertest` agent from `src/server/__tests__/helpers/`; the lockout reset helper keeps parallel files on one address from locking each other out.

## Test data management

- The seed's 10 tables, 4 categories and 12 items are the base data. Helpers in `src/server/__tests__/helpers/` and `e2e/helpers/` place orders with options, move orders, launch and end specials, open and respond to calls, close a table and rate dishes, change a menu item directly and publish `MENU_CHANGED`, and set a table's presence. None of them is reachable from a route.
- A v1-shaped database for the upgrade test is built in the test from v1's exact schema and a few rows; no database file is committed.
- Browser tests use their own server and in-memory database, and clean up nothing because the server is fresh for each run.
