# Integration Test Instructions: Table Order v2

The key boundaries and the cross-Unit interactions, and how to run the tests that cover them. Each Unit was built and tested alone with only v1 and U5 in its copy (U6 and U7 in parallel), so these tests are where the diner side and the staff side first run together. The strategy is Standard: unit tests per Unit were done in Code Generation; this stage adds the integration level and the whole-journey browser tests.

## Test framework and setup

- **Integration tests (server):** Vitest with `supertest` against the real Express app and a real SQLite database (`DB_FILE=:memory:`), never a mocked database. They sit in `src/server/__tests__/` (U5's `foundation/`, U6's `u6/`, U7's `u7/` and the integration fixes in `integration/`).
- **Browser tests (real browser engine):** Playwright. Chromium is the default project (`playwright.config.ts`). The installed Google Chrome and WebKit (Safari's engine) run the same specs with `playwright.cross-browser.config.ts`. Firefox is not installed or tested.
- **Needs:** `npm ci` and `npm run build` first (the browser tests serve `dist/`). Ports and the database come from `E2E_PORT` (default 3100) and `DB_FILE`; the staff PIN used by the tests is 4242, set by the test setup.
- **Where each kind of check runs:** the Vitest tests run in Node (server) and in jsdom, a DOM emulator (client components and hooks); only the Playwright runs are real-browser evidence.

## How to run

| What | Command | Where it runs |
|---|---|---|
| Everything, as the project defines it | `npm test && npm run test:e2e` | Node and jsdom, then Chromium |
| All unit and integration tests with coverage | `npm test` | Node and jsdom |
| All browser tests, Chromium | `npm run test:e2e` | Chromium |
| The same browser tests in Chrome and WebKit | `npx playwright test --config playwright.cross-browser.config.ts` | Google Chrome and WebKit |
| The cross-Unit journeys only | `npx playwright test e2e/build-and-test` | Chromium |

The cross-browser configuration leaves out the mockup-match specs, because those save the screenshots the team looks at (taken in Chromium) and would overwrite them.

## The boundaries and what covers them

| Boundary (contract) | What must hold | Covered by |
|---|---|---|
| Diner order into the kitchen (contracts 1, 4, 5) | An order with options keeps its frozen price, options and station; the board shows the options; a special's stock is reduced once; two diners ordering the last special: one gets it | `src/server/__tests__/foundation/orderOptions.test.ts`, `ordersOptionsApi.test.ts`, `specialsApi.test.ts`; `e2e/u5-foundation/foundation.spec.ts`; `e2e/build-and-test/v2-cross-unit-journey.spec.ts` |
| Station done into the diner's tracker and banner (contract 4) | Grill done makes the order Preparing, the last station makes it Completed with `completed_at`; the diner sees the steps move and one ready banner, none after a reload | `src/server/__tests__/u7/stationsApi.test.ts`, `stationEvents`; `e2e/u7-staff-kitchen-features/staff-kitchen.spec.ts`; `e2e/u6-diner-features/diner-features.spec.ts`; the cross-Unit journey |
| Staff menu edits into the open diner Menu and cart (contracts 3, 4) | A write publishes `MENU_CHANGED`; an open Menu reloads within 2 seconds; a cart holding a changed or hidden item is refreshed with a notice; a special on a hidden item is no longer live | `src/server/__tests__/u7/menuApi.test.ts`; `src/server/__tests__/integration/`; the cross-Unit journey |
| Calls (contracts 1, 4) | One open request per kind; the staff card pulses with words; Respond clears it and the diner sees "Help is on the way."; closing the table clears requests | `callsApi.test.ts`, `serviceCallRepo.test.ts`; the U6 and U7 specs; the cross-Unit journey |
| Presence into the floor map (contract 4) | A diner page that is open counts as Browsing within 5 minutes of its last heartbeat | `presence.test.ts`, `presenceApi.test.ts`, `floorRepo.test.ts`; the U7 floor spec |
| Close table, ratings, sales (contracts 1, 3) | Closing a table clears calls; the diner rates dishes of the closed visit until Done; staff see the day's totals and best and worst rated | `ratingsApi.test.ts`, `salesRepo.test.ts`; the cross-Unit journey |
| Staff guard (contract 2) | Every staff route and the staff stream answer 401 without a session; the five seams answer 401 first and a built route works signed in | `src/server/__tests__/foundation/guard.test.ts`, `staffApi.test.ts`, `staffStreams.test.ts` |
| Database upgrade (contract 5) | A v1 file keeps all its data, only new tables and columns are added, the sample data is added to the old items once, running twice changes nothing | `src/server/__tests__/foundation/dbUpgrade.test.ts` |
| Live stream (contract 4) | Every event name is registered; after a reconnect each screen reloads and nothing repeats; one staff stream per page | `src/client/hooks/__tests__/liveHooksV2.test.ts`, `useStaffSSE.test.ts`; `e2e/build-and-test/live-update-timing.spec.ts` |

## Whole-journey browser tests (added by this stage)

- `e2e/build-and-test/v2-keyboard-journey.spec.ts`: the v2 journey done with the keyboard only (NFR3), including the PIN screen, the options sheet's focus trap, Settings, placing an order, the board's station tabs and a visible focus indicator at each stop.
- `e2e/build-and-test/v2-cross-unit-journey.spec.ts`: one story across the diner and staff screens: a menu edit appears on an open Menu, an order with options reaches the right station boards, a call is answered, the stations complete the order and the diner is told once, a special appears and disappears when its item is hidden, the floor map, the bill with option lines, close, rating, and the sales page.
- v1's journeys stay: `keyboard-journey.spec.ts`, `board-bill-link.spec.ts`, `live-update-timing.spec.ts` (2-second live updates) and `motion.spec.ts` (reduced motion).

## Expected coverage targets

No coverage threshold is set in the project and none is added or lowered. The Testing Contract's scope floor adds nothing beyond the Standard strategy. This stage runs the full suite once with the project's own coverage configuration on the assembled project and records the line coverage it reports.

## Test data management

- The seed's 10 tables, 4 categories and 12 items (with the options, allergens and stations U5 added) are the base data. Grilled Salmon has no allergen information; the Classic Burger and the Margherita Pizza have option groups.
- Browser tests use their own server and in-memory database, and each spec resets the tables it uses, so one spec never sees another's orders.
- The staff side of diner tests and the diner side of staff tests are driven with U5's helpers in `e2e/helpers/` and `src/server/__tests__/helpers/`; none is reachable from a route.
