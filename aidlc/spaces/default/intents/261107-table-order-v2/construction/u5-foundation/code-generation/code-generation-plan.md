# Code Generation Plan: u5-foundation (Bolt 5)

## Summary

- Builds: v2's foundation: the new look in both themes on all five v1 screens, the Staff PIN, every new table, route and live event that U6 and U7 share, and the seams they build in.
- Touches: `src/server/` (database upgrade, repositories, services, routes, live events), `src/client/` (design system, shared components, staff shell, diner mount points, restyled screens), test configuration, `e2e/u5-foundation/` and `e2e/helpers/`.
- Tests: about 110 unit and integration tests, about 25 Playwright tests, and a mockup-match spec. v1's tests stay in the suite and keep passing; the ones the staff PIN makes out of date are updated and listed.

## What this plan builds on

It builds from the Functional Design of U5 (`functional-design/functional-spec.md`, `rules.md` with BR1.1 to BR14.4, `entities.md`), the contracts (`inception/contract-design/contract-summary.md`, contracts 1, 2, 4, 5, 6, 7 and 9), the Unit definition (`inception/units-generation/unit-of-work.md`) and the finished v1 code in the main folder. The code is written at the workspace root, in the main folder, and Bolt 5 is built on its own (no worktree). The app on port 3000 is stopped before the build and started again only after the tests and the mockup match pass (project rules).

Decisions this plan makes where the design leaves the physical choice open:

- **No new packages.** The staff cookie is read and written by a few lines of our own code, so the build adds no dependency (the QR library is U7's and is asked about in U7's plan).
- **v1's function names are kept.** `transitionOrder(orderNumber, to, actor)` keeps v1's argument order, so v1's `orderRepo` tests still compile; the actor list gains `station` and the function sets `completed_at`.
- **Dates.** One small module, `src/server/time.ts`, reads both stored time formats (BR11.6), writes ISO 8601 UTC, and works out the server's local day (BR4.1).
- **All the numbers** (2 minutes per open order, 15 minutes starting value, 12 hours idle, 5-minute presence, 5-second expiry check, 60-second lockout, 5 tries) live in one file, `src/server/config.ts`, so they are easy to change.
- **Station on v1-era lines:** `order_items.station` is added with default `'Grill'`, so every old line counts as Grill with no data change (BR3.3).

## Test strategy for this plan

Standard strategy, scope `dpl-workshop`, methodology test-after (Testing Contract below). Each layer is built, then its tests are written and run. The scope adds no new-test floor and no coverage threshold exists in the project; the existing suite must stay green. Project rules add Playwright tests for the main flows and a mockup-match spec for every mockup this Unit builds.

## Plan Steps

Dependency order follows the Testing Contract's profile. The tick boxes are for the developer to fill in as each step finishes.

### Project structure and configuration

- [x] **Step 1: Project structure and production configuration skeleton** (BR11.5, BR9.2; US19.1)
  - Create the folders: `src/server/services/`, `src/server/__tests__/foundation/`, `src/server/__tests__/helpers/`, `src/client/design/`, `src/client/components/ui/`, `src/client/staff/pages/`, `src/client/diner/features/`, `src/client/alerts/`, `e2e/helpers/`, `e2e/u5-foundation/`.
  - Add `src/server/config.ts`: reads `PORT`, `E2E_PORT`, `DB_FILE`, `STAFF_PIN` from the environment and holds every number listed above as a named constant. `PORT` first, then `E2E_PORT`, then 3000, as v1 does today.
  - Add `src/server/time.ts` (`parseStoredTime`, `toIso`, `localDayBounds`, `minutesBetween`).
  - Update `.env.example` with `STAFF_PIN` (a comment says it is optional and a random PIN is printed when it is missing). No PIN value is committed.
  - `src/test-setup.ts` sets a test PIN (`STAFF_PIN=4242`) for unit tests; `playwright.config.ts` passes the same PIN to the test server, and sets the dark colour scheme for v1's mockup-match specs only (BR11.3).

### Verify the test runner

- [x] **Step 2: Verify the existing test runner and record the exact unit-scoped command** (Testing Contract runner step)
  - Run v1's suite once before any change (`npx vitest run src/server src/client --coverage.enabled=false`) and record the number of passing tests as the baseline in `code-summary.md`.
  - Confirm `npx playwright test e2e/u1-walking-skeleton` starts the server on `E2E_PORT` with an in-memory database. The exact commands are in `unit-test-instructions.md`.

### Data model and database behaviour

- [x] **Step 3: Data model: the database upgrade and seed, implemented** (BR11.1, BR11.2, BR2.2, BR2.3, BR2.6, BR12.2, BR3.3; US19.1, US6.1, US8.1, US10.1, US13.1)
  - In `src/server/db.ts`: `initSchema` keeps v1's tables, then calls a new `upgradeSchema(db)`: `CREATE TABLE IF NOT EXISTS` for `option_groups`, `option_choices`, `order_item_options`, `station_done`, `chef_specials`, `service_calls`, `dish_ratings`; `addColumnIfMissing` (checked with `PRAGMA table_info`) for `categories.hidden`, `items.hidden`, `items.station`, `items.allergens`, `orders.completed_at`, `orders.estimate_minutes`, `order_items.station`, `order_items.special_id`; the two indexes in contract 5. Every column has a default or allows empty. A failure stops start-up with a message naming the step (BR11.1).
  - `seedIfEmpty` keeps the 10 tables, 4 categories and 12 items and adds options (Classic Burger: Size choose-one required, Extras choose-any, Leave out; Margherita Pizza: Size), allergens (every item except Grilled Salmon, which stays NULL) and stations (Cold: the two salads; Grill: Garlic Bread and the four mains; Desserts: the two desserts; Bar: the three drinks).
  - A v1 database file is only upgraded, never re-seeded.
- [x] **Step 4: Data model: write and run its tests** (US19.1)
  - `src/server/__tests__/foundation/dbUpgrade.test.ts`: a database made with v1's exact schema and rows gets every new table and column, keeps every row, loads twice with no change, and the seed keeps v1's counts (10, 4, 12) with Grilled Salmon's allergens NULL. Edge cases: a half-upgraded file (some columns present) finishes; an unreadable step reports its name.

### Repository and data access

- [x] **Step 5: Repositories, implemented** (BR2.1, BR2.4, BR2.5, BR2.7, BR3.1 to BR3.7, BR3.9, BR5.1 to BR5.5, BR6.1 to BR6.3, BR7.1, BR7.2; US6.1, US8.1, US10.1, US11.1, US17.1, US18.1)
  - `menuRepo.ts`: `getMenu()` leaves out hidden items and the items of hidden categories and returns station, allergens (null when not set) and option groups with choices; `getStaffMenu()` returns everything with the hidden flags (BR2.7); `updateItemAvailability` stays.
  - `orderRepo.ts`: `placeOrder` takes optional `option_ids` and `special_id` per line, runs the checks in the exact order of BR3.1 in one transaction (BR3.10), freezes `unit_price_cents`, `station` and one `order_item_options` row per choice, stores `estimate_minutes`, does the guarded special-stock statement last (BR5.3), and returns `dropped_lines` with `SOLD_OUT_AT_SUBMIT`, `SPECIAL_SOLD_OUT` or `OPTION_UNAVAILABLE`. A repeated placement key returns the same order with nothing dropped and nothing reduced (BR3.7). `getOrdersByVisit` returns per-line `station` and `options` and per-order `estimate_minutes` and `completed_at`.
  - `specialsRepo.ts`: launch (validates BR5.1, ends the live one in the same transaction), `getCurrentSpecial` (BR5.2), end, and `expireSpecials` for the 5-second check.
  - `serviceCallRepo.ts`: open (one per visit and kind, a lost race answers with the existing one), respond, list for the current visit, and `clearOpenCalls(visitId)` used by close (BR6.3).
  - `ratingRepo.ts`: save in the order of BR7.1 (visit, thumb, items, lock), replace until Done, lock on `done: true` (BR7.2).
  - `billingRepo.ts`: `closeTable` also clears the visit's open calls in the same transaction; the bill lines carry station and options.
  - `tableRepo.ts`: close writes ISO 8601 times (BR11.6); a reader for the table's most recent closed visit stays.
- [x] **Step 6: Repositories: write and run their tests** (same rules)
  - `menuRepo.test.ts`, `orderOptions.test.ts`, `specialsRepo.test.ts`, `serviceCallRepo.test.ts`, `ratingRepo.test.ts` in `src/server/__tests__/foundation/`. Includes: a hidden item is not offered but stays on an old bill; a required choice missing, two choices in a choose-one group, and an option of another item are each refused; a removed option drops its line and leaves special stock unchanged; two orders for the last special (one wins, one is dropped, rest of the order placed); an order with nothing left rolls back the stock; a repeated key reduces nothing; one open call per kind; a rating is replaced until Done and then refused with RATING_LOCKED; closing clears calls.

### Business logic

- [x] **Step 7: Business logic, implemented** (BR1.1 to BR1.4, BR1.9, BR3.6, BR3.8, BR4.1, BR4.2, BR8.1 to BR8.3, BR9.1, BR9.2; US3.1, US5.1, US9.1, US12.1 seam)
  - `staffAccess.ts`: PIN from the environment or a random 4-digit one printed once; constant-time compare; sessions in memory (128-bit random value, 12-hour idle end, sweep every 10 minutes); lockout by the connection's address (5 tries, 60 seconds, 1,000 addresses, 10-minute expiry); `signIn`, `signOut`, `getSession`, `requireStaff` middleware (401 UNAUTHORIZED in v1's error shape); `resetStaffAccessForTest`.
  - `services/waitEstimation.ts`: the BR4.1 formula (both timestamp formats, today only, Cancelled and no-`completed_at` orders left out, 15 when none) and the "Running late" decision used by clients (BR4.2) exported from a shared helper.
  - `orderRepo.transitionOrder(orderNumber, to, actor)`: actor `staff`, `diner` or `station` with the rules of BR3.8; sets `completed_at` on Completed (BR3.6).
  - `presence.ts`: page records keyed by page id, 5-minute present rule, connection open/close, 30-second sweep, caps of 500 per table and 5,000 in all, `TABLE_PRESENCE_CHANGED` at most once a second per table, `getPresence(tableId)` (BR8.1 to BR8.3), `setPresenceForTest`.
  - `menuEvents.ts`: `publishMenuChange(reason, ids)` sends `MENU_CHANGED` to staff and every table (BR9.2).
  - `sse.ts`: staff streams are tied to the session that opened them; sign-out and idle end close them; the 20-second keep-alive re-checks the session (BR1.9); `subscribe` accepts the `page` parameter for tables.
- [x] **Step 8: Business logic: write and run its tests** (same rules)
  - `staffAccess.test.ts` (right PIN, wrong PIN, five tries lock, locked even with the right PIN, lock is per address not per cookie, count resets on success, 12-hour idle end with fake timers, cap of 1,000 addresses never lifts an active lock, random PIN printed once and never logged), `waitEstimation.test.ts` (default 15, today's average, both timestamp formats, Cancelled left out, at least 1, "Running late"), `transition.test.ts` (every legal and illegal move per actor, `completed_at` set once), `presence.test.ts` (5-minute rule, close removes at once, sweep, caps, debounce of events), `staffStreams.test.ts` (sign-out closes the session's streams; the keep-alive closes a stream whose session is gone).

### API and endpoint layer

- [x] **Step 9: API and routes, implemented** (BR1.5, BR1.6, BR1.8, BR4.3, BR8.1, BR11.4, BR14.1, BR14.4; contracts 1, 2, 3, 7)
  - New routers: `staff.ts` (login 204 / 401 INVALID_PIN with `tries_left` / 429 LOCKED with `retry_after_seconds`; logout; session), `specials.ts` (launch and end behind the guard; the current special open), `calls.ts` (list and post for a table; respond behind the guard), `ratings.ts`, `presence.ts` (heartbeat with the page id pattern), `estimate.ts` (UNKNOWN_TABLE for a table that does not exist).
  - v1 routers: `menu.ts` guards the sold-out toggle; `billing.ts` guards the bill and Close table; `orders.ts` accepts `option_ids`, `special_id`, asks WaitEstimation for the estimate, publishes the extended `ORDER_PLACED`, `SPECIAL_CHANGED` when stock changed, and guards `by=staff` while leaving `by=diner` open (Pending to Cancelled only); the status route publishes `completed_at`; `sse.ts` guards `/sse/staff` and passes the page id.
  - `routes/registry.ts` lists every module in one place, pre-filled; the five U7 modules (`staff-stations.ts`, `staff-menu.ts`, `staff-floor.ts`, `staff-sales.ts`, `staff-qr.ts`) are created as stubs that answer 401 first and then 501 `NOT_BUILT`, and `GET /api/staff/menu` is the data function plus its stub (BR2.7).
  - `src/server/index.ts` mounts the registry before the page catch-all, keeps `res.sendFile('index.html', { root: distDir })`, starts the 5-second special-expiry timer and the sweeps, and keeps the entry-point check so tests can import the app.
- [x] **Step 10: API and routes: write and run their tests, and update v1's server tests** (BR11.3, BR13.1)
  - `src/server/__tests__/foundation/`: `staffApi.test.ts`, `ordersOptionsApi.test.ts`, `specialsApi.test.ts`, `callsApi.test.ts`, `ratingsApi.test.ts`, `presenceApi.test.ts`, `estimateApi.test.ts`, `guard.test.ts` (every staff route answers 401 without a session and the diner routes stay open; a stub answers 401 then 501), `routeOrder.test.ts` (a new route never returns the page), and `timing.test.ts` (placing and reading orders against the seed data answer within 300 ms).
  - v1's server tests that call a staff action now sign in with the test PIN, through one helper: `api.test.ts`, `billing-api.test.ts`, `billing.test.ts`, `menu-availability.test.ts`, `sse-hello.test.ts` (the staff stream). Each changed test is named with its reason in `code-summary.md` under "v1 tests changed". Nothing else in v1's server tests changes.

### Frontend

- [x] **Step 11: Frontend foundation, implemented** (BR10.1, BR10.2, BR10.5, BR10.6, BR9.3, BR9.4; US1.1, US2.1, US4.1)
  - `src/client/design/tokens.css`: every token named as in the mockups' `design-system.css`, dark and light themes (`data-theme` on the root; none means follow the device), v1's token names kept as aliases, reduced motion stops all motion. `src/client/index.css` imports it.
  - Shared components in `src/client/components/ui/` with `data-testid`s: Button, Pill, Chip, Badge, Timer, Banner, Sheet, Field, SegmentedControl, Tracker, SideNav.
  - Hooks: `useTheme` (Follow device, Light, Dark; saves under `table-order.theme`), `useSoundPreference` (`table-order.sound`), `useAllergies` (`table-order.allergies`); blocked storage falls back to the defaults with no error.
  - `src/client/alerts/alertLogic.ts` and `useAlerts`: once per event id, never for events older than the page load, banner always, sound after the first tap and unless muted, vibration where supported.
- [x] **Step 12: Frontend foundation: write and run its tests** (same rules)
  - `src/client/design/__tests__/tokens.test.ts` (every token the mockups use exists in both themes; body text contrast at least 4.5 to 1 in both; no component style holds a literal colour a token covers), component tests for each shared component, hook tests for the three preferences (default, saved, cleared, blocked storage), alert logic tests (fires once, not for old events, not after a reconnect replay, sound waits for a tap, mute respected).
- [x] **Step 13: Frontend shells and live hooks, implemented** (BR1.7, BR1.8, BR8.1, BR9.2, BR14.2; US3.1, US12.1 seam)
  - `src/client/staff/`: `useStaffSession` (asks the session route; a 401 anywhere returns to the PIN screen, and after a correct PIN back to the page that was open), `PinScreen`, `StaffShell` with the side navigation (top bar and menu button on narrow screens) and `pages/registry.tsx` with one entry and one placeholder per staff page (Floor, Board, Stations, Menu, Special, Sales, QR). `views/StaffView.tsx` uses the shell; the Kitchen Board stays the index page and the bill stays at `tables/:id`.
  - `src/client/diner/features/`: one folder and one mount point per U6 feature area (`options`, `allergies`, `estimate`, `tracker`, `ready-banner`, `same-again`, `help-card`, `special-card`, `rating`, `settings`), each exporting an empty placeholder so the screens can mount it.
  - `useTableSSE` registers every event name once, makes the page id, adds `?page=` to the stream address, and posts the heartbeat when it opens and about every 60 seconds; `useStaffSSE` registers every name once and, when the stream fails and the session check answers 401, returns to the PIN screen.
- [x] **Step 14: Frontend shells and live hooks: write and run their tests** (same rules)
  - `PinScreen.test.tsx`, `StaffShell.test.tsx` (navigation, narrow screen, registry has every page), `useStaffSession.test.ts`, `diner/features` mount test, `useTableSSE.test.ts` and `useStaffSSE.test.ts` extended (every contract-4 name is listened for; the heartbeat is sent on open and every 60 seconds with fake timers; a failed stream plus 401 shows the PIN screen). v1's existing hook tests change only where the new code requires it, and are listed.
- [x] **Step 15: Restyle the five v1 screens, implemented** (BR10.3, BR10.4; US1.1, US2.1)
  - Menu, Cart, My orders, Kitchen Board, Table Bill and Close table, and the components they use (`DinerTabBar`, `TableClosedTakeover`, `ConfirmModal`, `OrderCard`, `BillOrderCard`, `MenuAvailabilityPanel`, the bill and close components) use the tokens and shared components and match the new mockups (`diner-menu`, `diner-cart`, `diner-orders`, `staff-board`, `staff-bill`) apart from the parts U6 and U7 own, in both themes. v1's words that tests check do not change; bottom tab bar with the Cart count, View cart and Place order above it, sticky category pills, the + Add pill with a 44 px touch area, frosted bars, tabular prices, reduced motion and keyboard access are kept (BR10.4). The staff screens show the shared theme control in their header (U6 adds the diner Settings sheet).
- [x] **Step 16: Restyle: write and run its tests** (same rules)
  - v1's component and screen tests stay green with their existing assertions; new assertions cover the shared components on each screen, the theme control on the staff header, and the Cart count on the tab bar. Any v1 client test whose text or markup the restyle must change is listed under "v1 tests changed" with the reason.

### Test helpers and browser tests

- [x] **Step 17: Test helpers** (BR14.3; contract 9)
  - `src/server/__tests__/helpers/` and `e2e/helpers/`: `signInAsStaff`, `placeOrderWithOptions`, `moveOrder` (Preparing, Completed), `launchSpecial` / `changeSpecial` / `endSpecial`, `openCall` / `respondCall`, `closeTableAndRate`, `changeMenuDirectly` plus `publishMenuChange`, `setPresence`, and the lockout reset. None is reachable from a route; the server-side ones are plain functions that tests import, the browser ones use the test PIN and the API.
  - `e2e/build-and-test/helpers.ts` and v1's e2e specs that open a staff page or call a staff action sign in through `signInAsStaff` (listed under "v1 tests changed").
- [x] **Step 18: Playwright tests for the main flows** (project rule; Testing Standards)
  - `e2e/u5-foundation/foundation.spec.ts`: (1) PIN screen, wrong PIN, lockout message, right PIN, sign-out; (2) a request with no session returns the screen to the PIN screen; (3) the theme control: Follow device, Light, Dark, and the choice is remembered after a reload; (4) a diner places an order with options and the staff board shows it (live within 2 seconds, BR13.2); (5) a Chef's special launched through the helper is orderable by two diners and the last one goes to only one; (6) the call and rating helpers drive the routes; (7) a page open shows as present; (8) the new look keeps the tab bar, category pills and 44 px touch areas in both themes; (9) all motion is off under reduced motion.
- [x] **Step 19: Mockup-match spec** (BR11.7, BR10.3; project rule)
  - `e2e/u5-foundation/mockup-match.spec.ts`: for `design-system`, `staff-pin` and the U5 parts of `diner-menu`, `diner-cart`, `diner-orders`, `staff-board` and `staff-bill` (in `inception/refined-mockups/mockups/` of this record), set up the same state in both themes and check the headings, labels, buttons, messages and status words; save the mockup and app screenshots side by side in `test-results/mockup-match/u5-foundation/`; list the parts U6 and U7 own that are left out.

### Environment, build and documentation

- [x] **Step 20: Environment and build configuration** (BR11.5; NFR8)
  - `package.json` scripts and dependencies are unchanged (no new package). `vitest.config.ts`, `vite.config.ts` (the dev proxy reads `PORT`), `playwright.config.ts` (test PIN, `E2E_PORT`, dark scheme for v1's mockup-match specs only) and `playwright.cross-browser.config.ts` are updated as needed, with no coverage threshold or time limit lowered. `npm run build` succeeds.
- [x] **Step 21: Documentation and traceability**
  - `code-summary.md` (files, decisions, test summary, tests not run and why, deviations, "v1 tests changed" with reasons, and "Bugs found by the tests and fixed" with each bug's regression test), `source-manifest.json`, and `traceability.json` from `aidlc engine sensor-traceability`. Inline comments on every new module name the rule ids it implements.

## Story-to-Step Traceability

| Story | Plan steps |
|---|---|
| US1.1 New look | 11, 12, 15, 16, 19 |
| US2.1 Dark mode and theme | 11, 12, 15, 18 |
| US3.1 Staff PIN | 7, 8, 9, 10, 13, 14, 18 |
| US4.1 Notifications (shared alert logic) | 11, 12 |
| US5.1 Completed time | 5, 6, 7, 8 |
| US6.1 Hidden items | 5, 6 |
| US8.1 Make it yours (server side) | 3, 5, 6, 9, 10 |
| US9.1 Honest wait time (server side) | 7, 8, 9, 10 |
| US10.1 Allergens (data and read side) | 3, 5, 6 |
| US11.1 Chef's special engine | 5, 6, 9, 10, 18 |
| US13.1 Station on lines and done marks | 3, 5, 6, 7, 8 |
| US17.1 Calls engine | 5, 6, 9, 10 |
| US18.1 Ratings engine | 5, 6, 9, 10 |
| US19.1 Keeping v1 safe | 1 to 4, 10, 16, 17, 20 |

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "dpl-workshop",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "project",
      "text": "These notes add to the methodology the framework sets; they don't change it.\n- **Browser tests:** besides unit and integration tests, every Unit adds Playwright tests in `e2e/<unit>/` for its main flows. The walking skeleton installs Playwright with Chromium.\n- **Verification command:** `npm test && npm run test:e2e`.\n  - `npm test` writes `test-results/unit.json` and `coverage/coverage-summary.json`.\n  - `npm run test:e2e` writes `test-results/e2e.json`.\n  - The workshop dashboard reads these files.\n- **Mockup match:**\n  - Every Unit adds `e2e/<unit>/mockup-match.spec.ts`. For each refined mockup the Unit builds, it sets up the same state and checks that the screen shows the mockup's headings, labels, buttons, messages and status words.\n  - It saves the mockup and app screenshots side by side in `test-results/mockup-match/<unit>/`.\n  - Parts that a later Unit owns are left out of the comparison and listed.\n- **Browsers checked at Build and Test:**\n  - Chromium, the installed Google Chrome, and WebKit (Safari's engine).\n  - Firefox is not installed or tested.\n  - Build and Test also adds a keyboard-only test of the whole journey, for NFR6.\n- **Ports and database:** every port and the SQLite database file come from environment variables, so Bolts built in parallel never share either:\n  - `PORT`, default 3000: the app the team uses, in the main folder only.\n  - `E2E_PORT`, default 3100: the browser tests. Specs that need their own server use `E2E_PORT` + 100 and + 200 (3200 and 3300 by default).\n  - `DB_FILE`: the database file.\n  - Each parallel Bolt runs its tests with its own `E2E_PORT`: 4100, 5100, 6100 and 7100, in batch order. It also uses its own `DB_FILE` inside its worktree.\n- **In v2,** the verification command runs v1's tests and v2's together, so every Bolt also proves v1 still works.\n- **A flaky test** is fixed in the test code; a threshold is never lowered."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:99068bcd5e8a3a7477bcd10a6b27eb5b29307bb0df4fc9bbb8a003e6be05fb85",
  "contract_sha256": "sha256:4415290c94eaf99f82ff06b8c2fc50d31261035382150726851998650218e35d"
}
```

## Assumptions & Open Questions

- The staff cookie is read and written by our own few lines, so no package is added. If you would rather use a cookie library, say so before approving and the plan changes.
- The restyle keeps v1's wording that v1's tests check; if the new mockups use different wording for a v1 screen, the mockup wins only where no v1 test checks the old words, and each such case is listed in `code-summary.md`.
- About 110 unit and integration tests and 25 browser tests are estimates for the Standard strategy; the count may differ by a few.
