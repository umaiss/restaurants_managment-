# Unit Test Instructions: u6-diner-features

How to run the tests for U6, the diner features Unit of Table Order v2. The strategy is Standard (5 to 8 tests per component, plus integration tests for key boundaries), the method is test-after, and the scope adds no new-test floor. v1's and U5's tests stay in the suite and must keep passing.

## Test framework and setup

- **Unit and integration tests:** Vitest 1.x with `@testing-library/react` and jsdom for client code, `supertest` for the server. The runner and its configuration exist already (`vitest.config.ts`); nothing new is installed.
- **Browser tests:** Playwright with Chromium (`playwright.config.ts`). Build and Test checks the installed Chrome and WebKit later with `playwright.cross-browser.config.ts`. Firefox is not installed or tested.
- **This Unit is built in its own worktree**, in parallel with Bolt 7. Run every command from the worktree's folder. `npm ci` there installs from the existing lockfile; no package is added.
- **Environment (no value is written in code):** `E2E_PORT=4100` for this Bolt's browser tests (U7 uses 5100), `DB_FILE` is `:memory:` in the browser tests' server and unit tests, and `STAFF_PIN` is set by the test setup (4242). Nothing starts on port 3000 in a worktree.

## How to run this Unit's tests

1. **New server test** (the orders route option):

   ```
   npx vitest run src/server/__tests__/u6 --coverage.enabled=false
   ```

2. **New and changed client tests** (the feature folders, the diner screens, the cart hook, the table view):

   ```
   npx vitest run src/client/diner src/client/screens/diner src/client/views src/client/hooks/__tests__/useCart.test.ts --coverage.enabled=false
   ```

3. **v1 and U5 regression** (U6 changes v1 and U5 files, so every earlier test runs again and must stay green; the ones U6 had to change are listed in `code-summary.md`):

   ```
   npx vitest run src/server src/client --coverage.enabled=false
   ```

4. **Browser tests for this Unit** (starts its own server on `E2E_PORT` with an in-memory database):

   ```
   E2E_PORT=4100 npx playwright test e2e/u6-diner-features
   ```

   This runs the main-flow spec and the mockup-match spec. The mockup-match spec saves its screenshot pairs in `test-results/mockup-match/u6-diner-features/`; look at every pair.

5. **v1 and U5 browser tests** (they must stay green; U6's changes to the options flow are in the changed ones):

   ```
   E2E_PORT=4100 npx playwright test e2e/u1-walking-skeleton e2e/u2-diner-screens e2e/u3-kitchen-board e2e/u4-bill-and-close e2e/u5-foundation
   ```

The full check for the project, run at the Unit checkpoint and at Build and Test, is `npm test && npm run test:e2e`.

## What is tested, by component

| Component | Tests (about) | What they check |
|---|---|---|
| Orders route option | 6 | `visit=last_closed` returns the latest closed visit's orders, empty for a never-closed table, `visit=current` unchanged, 404 for a missing table |
| Cart model (`useCart`) | 14 | line identity, v1 cart migration, price preview, quantity limits (20 and a special's stock), refresh cases and their notices |
| Options sheet | 8 | groups of each kind, required group named, live price, focus and Escape |
| Allergy marks and warning | 8 | marks only for set allergens, "Allergens not set", the warning blocks Place order |
| Estimate and tracker | 10 | estimate states and basis, "Running late", minutes left, steps, Cancelled, reduced motion |
| Ready banner | 7 | once per event, not after a replay or reload, sound after a tap and mute, dismiss |
| Settings sheet | 7 | allergies, theme and sound saved and restored, blocked storage |
| Same again | 8 | label matching, ambiguous and missing options, skipped items, cap 20, notice, in-flight guard |
| Call card | 7 | ready, sent, answered, hidden with no open visit, double tap |
| Special card | 7 | shown with countdown and stock, added, removed live, quantity limit |
| Rating | 7 | the dishes of the closed visit, change until Done, locked, failure handling |
| Order sending | 6 | `dropped_lines`, `EMPTY_ORDER`, `INVALID_OPTIONS`, network failure keeps the placement key |
| Changed screens | v1's tests plus about 8 new | the features mounted in the Menu, Cart, My orders and the table view |

## Browser tests (Playwright, `e2e/u6-diner-features/`)

About 20 tests for the main flows: choosing options and the price, the required group, allergy chips and the warning, the estimate and "Running late", the tracker through the statuses, the ready banner once, "Same again", the call buttons, the special card, the thumbs until Done, a live menu change with the cart notice, and the Settings sheet's saved choices. The staff side is driven with U5's helpers. The mockup-match spec compares `diner-item-options`, `diner-settings`, `diner-closed-rate` and the U6 parts of `diner-menu`, `diner-cart` and `diner-orders` in both themes, and lists the parts U5 and U7 own.

## Expected coverage targets

No coverage threshold is set in the project and none is added or lowered. The scope's floor adds nothing beyond the strategy. Build and Test measures any floor the project defines on the full suite of the assembled project; a Unit-scoped run does not judge it. Every command above runs with coverage off, so a threshold exit can never stop a later step.

## Mocking and stubbing guidance

- Server tests use the real SQLite engine with `DB_FILE=:memory:` and reset the database between tests, never a mocked database.
- Time: use Vitest fake timers for the countdown, the wait text refresh, the 30-second updates and the banner. Never wait in real time.
- Client tests mock `fetch` and `EventSource` (the existing tests already do) and use `localStorage` stubs for blocked storage.
- The staff side in browser tests is U5's helpers (`signInAsStaff`, `moveOrder`, `launchSpecial`, `endSpecial`, `respondCall`, `closeTableAndRate`, `changeMenuDirectly` with `publishMenuChange`); none is reachable from a route.

## Test data management

- The seed's 10 tables, 4 categories and 12 items (with U5's options, allergens and stations) are the base data. The seeded Classic Burger and Margherita Pizza have option groups; Grilled Salmon has no allergen information.
- Browser tests use their own server and in-memory database and reset any table they use, so a test never sees another's orders.
