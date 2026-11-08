# Code Generation Plan: u6-diner-features (Bolt 6)

## Summary

- Builds: everything new the diner sees and does: options on dishes, allergy marks and warning, wait time and order tracker, ready banner, Settings sheet, "Same again", call the waiter / ask for the bill, the Chef's special card, and rating a meal.
- Touches: `src/client/diner/features/*`, the three diner screens and `TableView`, `useCart`, one additive option in `src/server/routes/orders.ts`, `e2e/u6-diner-features/`.
- Tests: about 100 unit and integration tests, about 20 Playwright tests, and a mockup-match spec. v1's and U5's tests stay in the suite and keep passing; the few that the options sheet makes out of date are updated and listed.

## What this plan builds on

It builds from the Functional Design of U6 (`functional-design/functional-spec.md`, `rules.md` with BR1.1 to BR10.1, `frontend-components.md`), U5's finished code on `main` (design system, shared components, the three preference hooks, alert logic, the shared wait helper, the routes for options, estimate, specials, calls and ratings, and the test helpers), the contracts (`inception/contract-design/contract-summary.md`, contracts 1, 4, 6, 7 and 9) and the approved mockups (`diner-menu`, `diner-cart`, `diner-orders`, `diner-item-options`, `diner-settings`, `diner-closed-rate`). It is built in its own git worktree, in parallel with Bolt 7 (U7), with only v1 and U5 in it: it never needs U7's code, and drives the staff side through U5's test helpers (sign in, move an order, launch a special, respond to a call, close a table). Its browser tests use their own port, `E2E_PORT=4100`, and an in-memory database, so they never meet Bolt 7's.

Decisions this plan makes where the design leaves the physical choice open:

- **No new package.** Everything is built from what is installed.
- **Worktree setup is part of Step 1.** A new worktree has no `node_modules`, so the build first runs `npm ci` there (an install from the existing lockfile, nothing new) and the Playwright browsers are the ones already installed on this machine.
- **Cart storage keeps v1's key and shape.** The cart is still saved under `cart:table:<id>`; each line gains `lineId`, `optionChoices`, `basePriceCents` and `specialId` fields, and a v1 line without them still loads (BR1.1).
- **The one server change is additive.** `GET /api/tables/{id}/orders?visit=last_closed` returns the dishes of the table's most recently closed visit (your Q1 answer, BR10.1); `visit=current` and everything v1 does stay as they are.
- **v1 tests that U6 must change.** The seed's Classic Burger and Margherita Pizza now have options, so "+ Add" on them opens the options sheet: v1 tests that add those items by "+ Add" are changed to choose in the sheet (or to add an item with no options), each named in `code-summary.md` under "v1 tests changed" with its reason. Nothing else in v1's tests is meant to change.

## Test strategy for this plan

Standard strategy, scope `dpl-workshop`, methodology test-after (Testing Contract below). Each layer is built, then its tests are written and run. The scope adds no new-test floor and no coverage threshold exists; the existing suite must stay green. Project rules add Playwright tests for the main flows and a mockup-match spec for every mockup this Unit builds.

## Plan Steps

### Project structure and configuration

- [x] **Step 1: Project structure and production configuration skeleton** (BR7.1; US1.1)
  - In the worktree run `npm ci` (no new package), then confirm `npx tsc --noEmit` is clean before any change.
  - Create the test folders `src/client/diner/features/**/__tests__/`, `src/server/__tests__/u6/` and `e2e/u6-diner-features/`.
  - No other configuration changes: `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright*.ts` and `tsconfig.json` are U5's and are not edited. The Unit's tests are found by folder.

### Verify the test runner

- [x] **Step 2: Verify the existing test runner and record the exact unit-scoped commands** (Testing Contract runner step)
  - Run v1 and U5's suite once before any change (`npx vitest run src/server src/client --coverage.enabled=false`) and record the number of passing tests as the baseline in `code-summary.md`.
  - Confirm `E2E_PORT=4100 npx playwright test e2e/u1-walking-skeleton` starts its server on port 4100 with an in-memory database. The exact commands are in `unit-test-instructions.md`.

### Data model and database behaviour

- [x] **Step 3: Data model** (none)
  - U6 changes no table, column or seed (contract 5 is U5's). This step records that, and the test that proves it: the schema after U6's changes equals the schema on `main` (checked in Step 4's test file by reading `PRAGMA table_info` of the tables the route option reads).

### Repository and data access

- [x] **Step 4: The orders route option, implemented and tested** (BR10.1; US18.1)
  - `src/server/routes/orders.ts` (and a small read function beside the existing order reads in `orderRepo.ts`): `visit=last_closed` returns `{ orders }` for the table's most recently closed visit (chosen by parsed time, as U5 does), in the same shape as `visit=current`, and `{ orders: [] }` when the table was never closed or the visit value is unknown. Cancelled orders stay in the body (the screen leaves them out). The route stays open to every diner.
  - `src/server/__tests__/u6/lastClosedOrders.test.ts`: closed visit returns its orders with lines and options; a table never closed returns an empty list; `visit=current` and a missing `visit` behave as before; two closed visits return the latest; a table that does not exist answers 404 UNKNOWN_TABLE as v1 does.

### Business logic

- [x] **Step 5: Screen logic, implemented** (BR1.1 to BR1.6, BR2.1, BR2.2, BR3.1 to BR3.3, BR5.1 to BR5.3, BR6.1, BR6.2, BR8.1, BR8.2, BR9.1, BR9.2; US8.1, US9.1, US10.1, US11.1, US16.1, US17.1, US18.1)
  - `src/client/hooks/useCart.ts`: the line model of BR1.1 and BR1.2 (`lineId`, `optionChoices`, `basePriceCents`, `priceCents`, `specialId`, `quantity`), add, quantity (1 to 20, a special line also capped at its stock left), remove, clear, and the cart refresh of BR1.4 (menu and current special: removed lines named, repriced lines, a special that ended falls back to the regular price and merges, a special over the stock left is capped); v1's saved carts load unchanged.
  - `diner/features/options/`: `useOptionChoice` (choices per group, the live line price never below zero, the first missing required group named); `diner/features/allergies/`: `allergyHits(item, set)` and the guidance text; `diner/features/same-again/`: `buildSameAgain(order, menu)` (match options by label among the item's current choices, skip ambiguous or missing, cap 20, notice text); `diner/features/estimate/`: `useEstimate`; `diner/features/help-card/`: `useCalls`; `diner/features/special-card/`: `useCurrentSpecial` with its countdown; `diner/features/rating/`: `useRatings`; the order-sending code that builds `{ menu_item_id, quantity, option_ids, special_id }` per line and handles `dropped_lines`, `400 EMPTY_ORDER` and `400 INVALID_OPTIONS` as BR1.5 and BR1.6 say.
- [x] **Step 6: Screen logic: write and run its tests** (same rules)
  - Tests next to each feature (`__tests__/`): cart identity and v1 cart migration (a v1-shaped cart loads, and the same plain item added joins its line); price preview; required-group rule; refresh cases (item gone, option gone, newly required group, repriced, special ended, special over stock, merge into an existing line); allergy hits (set allergen marked, not set never safe, empty list none); same-again matching (label matched, label in two groups skipped, missing option, hidden or sold out item, cap 20, special line added at menu price); estimate states; call states (ready, sent, answered, no open visit); rating states (change until Done, locked); order-send results (`dropped_lines`, EMPTY_ORDER, INVALID_OPTIONS, a network failure keeps the placement key).

### API and endpoint layer

- [x] **Step 7: Client calls to U5's routes, implemented and tested** (contract 1)
  - The small fetch wrappers each feature uses (`/api/estimate`, `/api/specials/current`, `/api/tables/{id}/calls`, `/api/tables/{id}/ratings`, `/api/tables/{id}/orders?visit=last_closed`) with v1's error handling and the "try again" messages of the design; tests mock `fetch` for success, a 4xx with the error shape, and a network error for each.

### Frontend

- [x] **Step 8: Components and screen changes, implemented** (BR1.x to BR9.x; US1.1, US2.1, US4.1 and the stories above)
  - Features, each from U5's shared components and tokens with `data-testid`s: `OptionsSheet`, `AllergyMark`, `AllergyWarning`, `EstimateBanner`, `OrderTracker`, `ReadyBanner`, `SameAgainButton`, `HelpCard`, `SpecialCard`, `RatingList`, `SettingsSheet` and `SettingsButton` (allergy chips, theme control, sound control).
  - Screen edits (diner files only): `MenuScreen` (the "Make it yours" badge, "+ Add" opens the sheet for items with options and adds straight otherwise, allergy marks and "Allergens not set", the special card, the guidance line), `CartScreen` (option lines, the estimate banner, the allergy warning before Place order, the cart refresh notice, the in-flight guard, dropped-line and EMPTY_ORDER notices), `MyOrdersScreen` (the tracker and wait text per order, "Same again", the call card), `TableView` (the Settings button, the ready banner, the thumbs on the closed message).
- [x] **Step 9: Components and screens: write and run their tests** (same rules)
  - Component tests for each feature (render, interaction, keyboard and focus for the two sheets, reduced motion, words with colour) and screen tests for the changed screens; v1's screen tests stay green except the ones named under "v1 tests changed".

### Browser tests and test helpers

- [x] **Step 10: Playwright tests for the main flows** (project rule; Testing Standards)
  - `e2e/u6-diner-features/diner-features.spec.ts`, using U5's helpers for the staff side: (1) choose options with a price change, add, place, and see the options on My orders; (2) a required group blocks Add and names the group; (3) allergy chips from Settings mark an item and the warning blocks Place order until confirmed; (4) the estimate shows in the Cart and "Running late" shows for an overdue order; (5) the tracker follows an order moved to Preparing and Completed, animation off under reduced motion; (6) the ready banner shows once, not after a reload; (7) "Same again" adds the items and opens the Cart with a notice; (8) the call buttons and "Help is on the way."; (9) a launched special shows its card, can be ordered, and disappears when it ends; (10) after Close table the thumbs show, change until Done, and are locked after; (11) a live menu change reaches an open Menu and the cart refresh notice shows; (12) the Settings sheet saves allergies, theme and sound across a reload.
- [x] **Step 11: Mockup-match spec** (BR7.1; project rule)
  - `e2e/u6-diner-features/mockup-match.spec.ts`: for `diner-item-options`, `diner-settings`, `diner-closed-rate` and the U6 parts of `diner-menu`, `diner-cart` and `diner-orders`, set up the same state in both themes and check the headings, labels, buttons, messages and status words; save the mockup and app screenshots side by side in `test-results/mockup-match/u6-diner-features/`; list the parts U5 and U7 own that are left out.

### Environment, build and documentation

- [x] **Step 12: Environment and build configuration** (BR7.1)
  - `npm run build` succeeds; no threshold or time limit is lowered; the Unit's browser tests read `E2E_PORT` and never start anything on port 3000.
- [x] **Step 13: Documentation and traceability**
  - `code-summary.md` (files, decisions, test summary, tests not run and why, deviations, "v1 tests changed" with reasons, the one U5 file edited (`orders.ts`) and why, and "Bugs found by the tests and fixed" with each bug's regression test), `source-manifest.json`, and `traceability.json` from `aidlc engine sensor-traceability`. Inline comments on every new module name the rule ids (BR numbers) it implements.

## Story-to-Step Traceability

| Story | Plan steps |
|---|---|
| US1.1 New look on new screens | 8, 9, 11 |
| US2.1 Theme control in Settings | 8, 9, 10 |
| US4.1 Ready banner (diner half) | 5 to 10 |
| US8.1 Make it yours | 5 to 10 |
| US9.1 Honest wait time | 5 to 10 |
| US10.1 Allergy shield | 5 to 10 |
| US11.1 Chef's special card | 5 to 10 |
| US14.1 Order tracker | 5 to 10 |
| US16.1 "Same again" | 5 to 10 |
| US17.1 Call the waiter / bill (diner half) | 5 to 10 |
| US18.1 Rate your meal | 4 to 10 |

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

- The options sheet's "+ Add" behaviour changes v1's tests for the seeded Classic Burger and Margherita Pizza; they are updated and listed, not left failing.
- About 100 unit and integration tests and 20 browser tests are estimates for the Standard strategy; the count may differ by a few.
