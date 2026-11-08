# Unit Test Instructions: u7-staff-kitchen-features

How to run the tests for U7, the staff and kitchen features Unit of Table Order v2. The strategy is Standard (5 to 8 tests per component, plus integration tests for key boundaries), the method is test-after, and the scope adds no new-test floor. v1's and U5's tests stay in the suite and must keep passing.

## Test framework and setup

- **Unit and integration tests:** Vitest 1.x with `@testing-library/react` and jsdom for client code, `supertest` for the server. The runner and its configuration exist already (`vitest.config.ts`); nothing new is installed for testing.
- **Browser tests:** Playwright with Chromium (`playwright.config.ts`). Build and Test checks the installed Chrome and WebKit later with `playwright.cross-browser.config.ts`. Firefox is not installed or tested.
- **This Unit is built in its own worktree**, in parallel with Bolt 6. Run every command from the worktree's folder. `npm ci` there installs from the existing lockfile, and the one new package (`qrcode` 1.5.4 with `@types/qrcode` 1.5.5) is installed as Step 1 of the plan.
- **Environment (no value is written in code):** `E2E_PORT=5100` for this Bolt's browser tests (U6 uses 4100), `DB_FILE` is `:memory:` in the browser tests' server and unit tests, and `STAFF_PIN` is set by the test setup (4242). Nothing starts on port 3000 in a worktree.

## How to run this Unit's tests

1. **New server tests** (the four route modules, the rules and the validation):

   ```
   npx vitest run src/server/__tests__/u7 --coverage.enabled=false
   ```

2. **New and changed client tests** (the board, the staff pages, the staff components):

   ```
   npx vitest run src/client/staff/board src/client/staff/pages src/client/screens/staff src/client/components/staff src/client/hooks/__tests__/useBoardOrders.test.ts --coverage.enabled=false
   ```

3. **v1 and U5 regression** (U7 changes v1 and U5 files, so every earlier test runs again and must stay green; the ones U7 had to change are listed in `code-summary.md`):

   ```
   npx vitest run src/server src/client --coverage.enabled=false
   ```

4. **Browser tests for this Unit** (starts its own server on `E2E_PORT` with an in-memory database):

   ```
   E2E_PORT=5100 npx playwright test e2e/u7-staff-kitchen-features
   ```

   This runs the main-flow spec and the mockup-match spec. The mockup-match spec saves its screenshot pairs in `test-results/mockup-match/u7-staff-kitchen-features/`; look at every pair.

5. **v1 and U5 browser tests** (they must stay green; U7's changes to the board are in the changed ones):

   ```
   E2E_PORT=5100 npx playwright test e2e/u1-walking-skeleton e2e/u2-diner-screens e2e/u3-kitchen-board e2e/u4-bill-and-close e2e/u5-foundation
   ```

The full check for the project, run at the Unit checkpoint and at Build and Test, is `npm test && npm run test:e2e`.

## What is tested, by component

| Component | Tests (about) | What they check |
|---|---|---|
| Stations (board and done mark) | 14 | board content, the mark, Pending to Preparing, the last mark completes, a repeat mark returns 200 with no change, no lines, a first mark on a Cancelled order, events published in order |
| Floor state and table list | 10 | each of the five states and the precedence, presence, open requests, the list is from the server |
| Menu management (server) | 22 | item, category and option writes, hidden items, category order and uniqueness, ids kept on replace, validation of every field, the cheapest-line rule, `publishMenuChange` after every write |
| Sales and ratings | 16 | days and totals, the 23:59 and 00:01 cut, both timestamp formats, Cancelled left out, the average and none, best sellers and ties, ratings ranking, tie rule, inclusive limits, empty |
| Routes (all four modules) | 22 | 401 without a session, 404s, 400 with the field named, answer shapes, route order, 300 ms |
| Kitchen Board, tickets, timers | 14 | tabs, station tickets and "done", timer colours and words at the limits, stopped states, options on tickets, the table list |
| Alerts and calls on the board | 10 | the new-order banner once per event, mute, the pulse and Respond, reduced motion |
| Floor map page | 6 | the five states, live refresh, selecting a table |
| Menu management page | 12 | list, item form errors beside fields, typed text kept, option groups, categories, saving state |
| Chef's special page | 6 | live card, launch errors, the cheapest-price check, end now, live switch |
| Sales page | 8 | days, "No completed orders", empty and failed states, best and worst rated |
| QR page | 6 | each code decodes to the address plus `/table/<n>`, the print view, offline |
| Bill option lines | 3 | options under each item, the frozen price |

## Browser tests (Playwright, `e2e/u7-staff-kitchen-features/`)

About 25 tests for the main flows: stations through to Completed and a repeat press, All stations Complete, timer colours, the new-order banner and mute, a call's pulse and Respond, the five floor states live, menu management with a live diner Menu, option groups on a ticket, the Chef's special page, past visits and sales with ratings, the QR page, and option lines on the bill. The diner side is driven with U5's helpers. The mockup-match spec compares `staff-station`, `staff-floor`, `staff-menu`, `staff-special`, `staff-sales`, `staff-qr` and the U7 parts of `staff-board` and `staff-bill` in both themes, and lists the parts U5 and U6 own.

## Expected coverage targets

No coverage threshold is set in the project and none is added or lowered. The scope's floor adds nothing beyond the strategy. Build and Test measures any floor the project defines on the full suite of the assembled project; a Unit-scoped run does not judge it. Every command above runs with coverage off, so a threshold exit can never stop a later step.

## Mocking and stubbing guidance

- Server tests use the real SQLite engine with `DB_FILE=:memory:` and reset the database between tests, never a mocked database; staff routes are called with a signed-in `supertest` agent from U5's helpers.
- Time: use Vitest fake timers for the ticket timers, the 30-second refresh and the countdown. Never wait in real time. Sales tests build closed visits with known timestamps in both stored formats.
- Client tests mock `fetch` and `EventSource` (the existing tests already do); the QR tests check the exact text given to the package for each table and that the drawn matrix is the package's own for that text (the package has no reader, and no reader package is added); the browser test checks each code's text through the page's own data attribute.
- The diner side in browser tests is U5's helpers (`placeOrderWithOptions`, `moveOrder`, `openCall`, `closeTableAndRate`, `setPresence`, `changeMenuDirectly`); none is reachable from a route.

## Test data management

- The seed's 10 tables, 4 categories and 12 items (with U5's options, allergens and stations) are the base data.
- Browser tests use their own server and in-memory database and reset any table they use, so a test never sees another's orders.
