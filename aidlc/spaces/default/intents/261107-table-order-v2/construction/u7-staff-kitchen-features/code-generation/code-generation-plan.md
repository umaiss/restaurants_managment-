# Code Generation Plan: u7-staff-kitchen-features (Bolt 7)

## Summary

- Builds: everything new that staff and the kitchen see and do: station boards, ticket timers, the new-order alert, call Respond and pulse, the floor map, menu management, the Chef's special page, past visits and sales with ratings, QR codes, and option lines on the bill.
- Touches: the four U7 server route modules, the staff pages and components under `src/client/staff/` and the v1 staff screens, one new package (`qrcode`), `e2e/u7-staff-kitchen-features/`.
- Tests: about 130 unit and integration tests, about 25 Playwright tests, and a mockup-match spec. v1's and U5's tests stay in the suite and keep passing; the few the new board and table list make out of date are updated and listed.

## What this plan builds on

It builds from the Functional Design of U7 (`functional-design/functional-spec.md`, `rules.md` with BR1.1 to BR10.3, `frontend-components.md`), U5's finished code on `main` (the staff session and guard, the staff shell and page registry, the five route stubs, `transitionOrder`, `publishMenuChange`, `getPresence`, `getStaffMenu`, the design system, shared components, alert logic and test helpers), the contracts (`inception/contract-design/contract-summary.md`, contracts 2, 3, 4, 7, 8 and 9) and the approved mockups (`staff-board`, `staff-station`, `staff-floor`, `staff-menu`, `staff-special`, `staff-sales`, `staff-qr`, `staff-bill`). It is built in its own git worktree, in parallel with Bolt 6 (U6), with only v1 and U5 in it: it never needs U6's code, and drives the diner side through U5's test helpers (place an order with options, open a call, close a table and rate dishes, set presence). Its browser tests use their own port, `E2E_PORT=5100`, and an in-memory database, so they never meet Bolt 6's.

Decisions this plan makes where the design leaves the physical choice open:

- **One new package, answered by you:** `qrcode` version 1.5.4 and its type definitions `@types/qrcode` version 1.5.5, installed in this Bolt's worktree with `npm install qrcode@1.5.4` and `npm install --save-dev @types/qrcode@1.5.5`. The codes are drawn in the browser with it, so no outside service is used and the page works offline. It is the only new package of v2. Before that, the worktree gets `npm ci` (an install from the existing lockfile, nothing new). `package.json` and `package-lock.json` change only on this Unit's side, and U6 adds no package, so the merge has nothing to resolve.
- **U7 files only.** No diner file, no U5 server file, no `orders.ts`, no schema, no file under `src/shared/` and none of U5's test helpers are edited. U7's new types live next to its code (`src/server/routes/` modules and `src/client/staff/`). The `staff-qr.ts` module stays as U5 made it.
- **The board reads the table list** from `GET /api/staff/tables` instead of a fixed 10 tables, a chosen change to v1 on the list of changes to v1 (rule BR10.3); v1 tests that mocked the fixed list are updated and each is named in `code-summary.md` under "v1 tests changed" with its reason.
- **All the numbers** (8 and 15 minutes for the timer, 5 and 3 for the list lengths, 30-second refresh) are named constants in one place.

## Test strategy for this plan

Standard strategy, scope `dpl-workshop`, methodology test-after (Testing Contract below). Each layer is built, then its tests are written and run. The scope adds no new-test floor and no coverage threshold exists; the existing suite must stay green. Project rules add Playwright tests for the main flows and a mockup-match spec for every mockup this Unit builds.

## Plan Steps

### Project structure and configuration

- [ ] **Step 1: Project structure and production configuration skeleton** (BR10.1, BR10.2; US1.1, US19.1)
  - In the worktree run `npm ci` (no new package), then `npm install qrcode@1.5.4` and `npm install --save-dev @types/qrcode@1.5.5` (the one new package, approved by you); confirm `npx tsc --noEmit` is clean.
  - Create the folders `src/server/__tests__/u7/`, `src/client/staff/board/`, `src/client/staff/board/__tests__/`, `src/client/staff/pages/**/__tests__/` and `e2e/u7-staff-kitchen-features/`.
  - No other configuration changes: `vite.config.ts`, `vitest.config.ts`, `playwright*.ts` and `tsconfig.json` are U5's.

### Verify the test runner

- [ ] **Step 2: Verify the existing test runner and record the exact unit-scoped commands** (Testing Contract runner step)
  - Run v1 and U5's suite once before any change (`npx vitest run src/server src/client --coverage.enabled=false`) and record the number of passing tests as the baseline in `code-summary.md`.
  - Confirm `E2E_PORT=5100 npx playwright test e2e/u1-walking-skeleton` starts its server on port 5100 with an in-memory database. The exact commands are in `unit-test-instructions.md`.

### Data model and database behaviour

- [ ] **Step 3: Data model** (none)
  - U7 changes no table, column or seed (contract 5 is U5's); the done-mark table already exists. A test reads `PRAGMA table_info` for the tables U7 reads and checks the schema is U5's.

### Repository and data access

- [ ] **Step 4: Repositories, implemented** (BR1.1, BR1.2, BR4.1, BR4.2, BR5.1 to BR5.6, BR7.1 to BR7.6; US5.1, US6.1, US12.1, US13.1, US18.1)
  - `src/server/routes/` helper modules next to the routes (not under `repositories/`, to keep U7's files separate): a stations module (the station board read and the done-mark write in one transaction, using `transitionOrder` with actor `station`), a floor module (each table's state from the open visit, orders, open requests and `getPresence`), a menu module (the staff menu read from U5's `getStaffMenu`, item and category writes with the server-made ids, the options replacement in one transaction), and a sales module (days grouped by the local day of `closed_at` with both timestamp formats, totals, best sellers, the average, and the ratings ranking).
- [ ] **Step 5: Repositories: write and run their tests** (same rules)
  - `src/server/__tests__/u7/`: `stationsRepo.test.ts` (board content, the mark, Pending to Preparing, the last mark completes with `completed_at`, a repeat mark returns 200 with no change even after Completed, no lines for the station, a first mark on a Cancelled order), `floorRepo.test.ts` (each of the five states and the precedence), `menuRepo.test.ts` (writes, hidden items, category order and uniqueness, options replacement keeps ids), `salesRepo.test.ts` (two days, 23:59 and 00:01, both timestamp formats, Cancelled left out, the average and "none", best sellers and ties, ratings ranking and ties).

### Business logic

- [ ] **Step 6: Validation and rules, implemented** (BR5.2 to BR5.4, BR1.3, BR7.6)
  - The validation functions for items, categories and option groups (limits in the rules, including the cheapest-possible-line rule), the event publishing after a station done (`STATION_DONE` then a status event for each change) and after every menu write (`publishMenuChange`), and the ratings ranking with its stated tie rule.
- [ ] **Step 7: Validation and rules: write and run their tests** (same rules)
  - `validation.test.ts` (each field's valid and invalid values, the first invalid field named, text with control characters, the cheapest line below zero), `stationEvents.test.ts` (publish order, nothing published on a repeat mark), `menuPublish.test.ts` (every successful write calls `publishMenuChange` with the reason and ids).

### API and endpoint layer

- [ ] **Step 8: Routes, implemented** (contract 3; BR1.x, BR4.1, BR5.x, BR7.x, BR10.2)
  - Replace the bodies of the stub modules `staff-stations.ts` (`GET /api/staff/stations/{station}/board`, `POST /api/staff/orders/{n}/stations/{station}/done`), `staff-menu.ts` (`GET /api/staff/menu`, the item, options and category writes), `staff-floor.ts` (`GET /api/staff/tables`) and `staff-sales.ts` (`GET /api/staff/sales`, `GET /api/staff/ratings`). Every route stays behind U5's guard (401 before anything else), uses v1's error shape, and is mounted by U5's registry before the page catch-all. `staff-qr.ts` and `routes/registry.ts` are not edited.
- [ ] **Step 9: Routes: write and run their tests, and update U5's stub test** (BR10.2, BR13.1 of U5)
  - `src/server/__tests__/u7/`: one API test file per module (happy path, validation 400 with the field named, 401 without a session, 404 for unknown ids and stations, the answers' shapes), `routeOrder.test.ts` (a new route never returns the page) and `timing.test.ts` (each new read answers within 300 ms on the seed data).
  - U5's `guard.test.ts` lists the stub routes that answer 501: the four U7 modules no longer answer 501, so their entries are removed from that list, and the change is named in `code-summary.md` under "v1 tests changed" (they are U5 tests) with its reason.

### Frontend

- [ ] **Step 10: Board, tickets, timers, alerts and calls, implemented** (BR1.1 to BR1.5, BR2.1 to BR2.3, BR3.1, BR3.2, BR9.1; US4.1, US13.1, US15.1, US17.1, US8.1)
  - `KitchenBoardScreen` and `useBoardOrders` (read the table list, not a fixed 10), `OrderCard` (options under each item, the timer with "Slow" and "Late", "<Station> done" on a station tab), `src/client/staff/board/` (`StationTabs`, `StationBoard`, `TicketTimer`, `NewOrderBanner` with the Sound on / Muted switch in the header, `CallPulse` with Respond), and `BillOrderCard` (option lines under each item).
- [ ] **Step 11: Board and tickets: write and run their tests** (same rules)
  - Component and hook tests: tabs and keyboard, a station board's tickets and "done", timer colours and words at 7, 8, 14 and 15 minutes and stopped states, the new-order banner once per event and not for old events, mute, the pulse and Respond and reduced motion, option lines on tickets and on the bill, the table list instead of a fixed 10. v1's board and bill tests stay green except those named under "v1 tests changed".
- [ ] **Step 12: Pages, implemented** (BR4.1 to BR4.4, BR5.1 to BR5.7, BR6.1 to BR6.3, BR7.1 to BR7.6, BR8.1 to BR8.3; US5.1, US6.1, US7.1, US11.1, US12.1, US18.1)
  - The staff pages U5 registered, in their own files: Floor map (`staff/pages/floor`, with `useFloorTables`), Menu management (`staff/pages/menu`, the list, `ItemForm`, `OptionGroupEditor`, `CategoryEditor`), Chef's special (`staff/pages/special`), Past visits and sales (`staff/pages/sales`, `DayCard`, `RatedDishes`), QR codes (`staff/pages/qr`, drawn in the browser with `qrcode`, with a print stylesheet), and the station page (`staff/pages/stations`, the same board by link). The registry file is not edited.
- [ ] **Step 13: Pages: write and run their tests** (same rules)
  - Component and hook tests for each page: loading, empty and error states with their words, the five floor states and live refresh, the item form (field errors beside the field, typed text kept, the Save button disabled while saving, text shown as text), option groups (add, remove, the cheapest-line message), the special page (live card, launch errors beside the field, the cheapest-price check, end now, switch on `SPECIAL_CHANGED`), the sales page (days, "No completed orders", the empty and failed states, best and worst rated and "No ratings yet today"), the QR page (each code decodes to the address followed by `/table/<n>`, the print view hides the buttons).

### Browser tests and test helpers

- [ ] **Step 14: Playwright tests for the main flows** (project rule; Testing Standards)
  - `e2e/u7-staff-kitchen-features/staff-kitchen.spec.ts`, using U5's helpers for the diner side: (1) a mixed order shows the burger on Grill and the drink on Bar, "Grill done" makes it Preparing and "Bar done" completes it, and a second press changes nothing; (2) All stations "Complete" finishes at once; (3) timer colours and "Slow" and "Late" for orders placed at known times; (4) the new-order banner and the mute switch; (5) an open call pulses with its words and Respond stops it; (6) the floor map shows each of the five states and updates live; (7) menu management: add, edit, hide an item and a category, an invalid save names the field and keeps the text, and an open diner Menu updates within 2 seconds; (8) option groups saved and shown on a ticket; (9) the Chef's special page: launch, countdown, end now, a launch with a bad value refused; (10) past visits and sales on two days, best sellers, the average and "No completed orders", best and worst rated; (11) the QR page with decoded codes and the print view; (12) option lines on the bill.
- [ ] **Step 15: Mockup-match spec** (BR10.1; project rule)
  - `e2e/u7-staff-kitchen-features/mockup-match.spec.ts`: for `staff-station`, `staff-floor`, `staff-menu`, `staff-special`, `staff-sales`, `staff-qr` and the U7 parts of `staff-board` and `staff-bill`, set up the same state in both themes and check the headings, labels, buttons, messages and status words; save the mockup and app screenshots side by side in `test-results/mockup-match/u7-staff-kitchen-features/`; list the parts U5 and U6 own that are left out.

### Environment, build and documentation

- [ ] **Step 16: Environment and build configuration** (BR10.2)
  - `npm run build` succeeds with the new package bundled; no threshold or time limit is lowered; the Unit's browser tests read `E2E_PORT` and never start anything on port 3000.
- [ ] **Step 17: Documentation and traceability**
  - `code-summary.md` (files, decisions, test summary, tests not run and why, deviations, the new package and where it is used, "v1 tests changed" with reasons, and "Bugs found by the tests and fixed" with each bug's regression test), `source-manifest.json`, and `traceability.json` from `aidlc engine sensor-traceability`. Inline comments on every new module name the rule ids (BR numbers) it implements.

## Story-to-Step Traceability

| Story | Plan steps |
|---|---|
| US1.1 New look on new screens | 10 to 15 |
| US4.1 New-order alert | 10, 11, 14 |
| US5.1 Past visits and sales | 4, 5, 8, 9, 12 to 14 |
| US6.1 Manage the menu | 4 to 9, 12 to 14 |
| US7.1 QR codes | 1, 12, 13, 14 |
| US8.1 Options on the ticket and bill | 10, 11, 14 |
| US10.1 Staff editing of allergens | 6, 7, 12, 13 |
| US11.1 Chef's special page | 12 to 14 |
| US12.1 Floor map | 4, 5, 8, 9, 12 to 14 |
| US13.1 Kitchen stations | 4 to 11, 14 |
| US15.1 Ticket timers | 10, 11, 14 |
| US17.1 Call pulse and Respond | 10, 11, 14 |
| US18.1 Best and worst rated | 4, 5, 8, 9, 12 to 14 |
| US19.1 New staff pages load from any folder | 1, 8, 9, 16 |

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

- U5's `guard.test.ts` lists the routes that answer 501 until U7 builds them; once U7 replaces four stubs those entries are removed from that U5 test (named in `code-summary.md`), because a U7 route that works must not be expected to answer 501. This is the only U5 test U7 changes.
- About 130 unit and integration tests and 25 browser tests are estimates for the Standard strategy; the count may differ by a few.
