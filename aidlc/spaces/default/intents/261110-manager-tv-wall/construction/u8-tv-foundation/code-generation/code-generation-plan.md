# Code Generation Plan — U8 `u8-tv-foundation`

## Summary

- Builds: the TV wall's walking skeleton. That is the hidden-by-default takings setting, a summary read of today across all tables, the settings routes and live event, the "TV wall" link with its switch, and a plain full-screen page at /staff/tv that updates live.
- Touches: new `src/server/salesRules.ts`, `tvSettings.ts`, `tvWallSummary.ts`, `routes/staff-tv.ts`, `src/shared/tvWall.ts`, `src/client/staff/pages/tv/` and `src/client/staff/TvTakingsSwitch.tsx`. It extends `db.ts`, the order, service-call and billing repositories, `routes/u7/sales.ts`, the route registry, the event names, the staff page registry and `StaffShell.tsx`.
- Tests: about 45 new unit and integration tests (Vitest), including a Sales regression test written before the move and a 10,000-visit speed check, plus 6 Playwright specs and a mockup-match spec for the staff navigation. The full existing suite stays green.

## Sources

This plan builds U8 as `construction/u8-tv-foundation/functional-design/` designs it (`functional-spec.md` W1–W6, `rules.md` BR1.1–BR10.2, `entities.md`), against contracts C1–C5 in `inception/contract-design/contract-summary.md`. The Unit is defined in `inception/units-generation/unit-of-work.md`, and the stories are US1.1–US5.3 in `inception/user-stories/stories.md`.

## Settled From the Functional Design Review

These were settled before planning; they do not change the approved design's behaviour:
- **R-01 (Major), the Sales page must not slow down.**
  - `getSales` keeps its single pass over closed visits. It does not call a per-day function.
  - The shared module exports the day rule (`dayOfStoredTime`) and the line-total rule, used by both `getSales` and `closedDayTakingsCents(day)`.
  - `closedDayTakingsCents` and today's counts use an indexed text range on the stored time: `>= '<day-1>'` and `< '<day+2>'`. This works for both stored formats, which both start with `YYYY-MM-DD`. The exact server-local day is then checked in code.
  - The upgrade step adds two indexes, `visits(closed_at)` and `orders(placed_at)`, without touching any data.
- **R-02, finding midnight.** The summary also returns `day_ends_at` (the server's next local midnight, ISO). The browser re-reads when its server-clock estimate passes it. This adds one field to C1, which is allowed.
- **R-03, missing events.** The TV hook and the switch read the full event list from `useStaffSSE`, not only the last event, so a burst cannot hide TV_SETTINGS_CHANGED.
- **R-04, the 5-minute rule.** The 5-minute re-read counts from when the last read started, the same in BR7.3 and W4.
- **R-05, renamed dishes.** MENU_CHANGED also triggers a re-read, so a renamed top dish updates at once.
- **R-06, stored times.** Both stored time formats are UTC, as `parseStoredTime` already reads them. This is documented in `salesRules.ts`.

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

## Steps

Before Step 1: stop the app on port 3000 if it is running (project rule).

### Step 1 — Project structure and baseline (all stories)
- [x] Run the full existing suite once (`npm test`) and record the baseline in `code-summary.md`: tests passing, failing and skipped, and line coverage. No production code changes yet.
- [x] Add `src/shared/tvWall.ts` with the C1 TypeScript types: `TvSummary`, `OpenOrderView`, `TakingsView`, `BusiestTableView`, `TopDishView`, `OpenRequestView`, plus `day_ends_at`. Add the pure helpers `waitMinutes(placedAt, now)` and `waitLevel(minutes)` (BR2.3, BR2.4).

### Step 2 — Verify the test runner (all stories)
- [x] Confirm that the unit-scoped command in `unit-test-instructions.md` runs on the unchanged tree (Vitest with the existing config) and that `npx playwright test e2e/u8-tv-foundation` is accepted by the existing Playwright config. Change no configuration.

### Step 3 — Sales regression test, written before any move (US3.1; BR10.1)
- [x] Add `src/server/__tests__/u8/salesRegression.test.ts`. It builds a fixed dataset in a fresh in-memory database:
  - visits closed today and yesterday, in both stored time formats, including 23:55 and 00:05 around local midnight;
  - cancelled orders;
  - an order with no lines;
  - several dishes, with a best-seller tie.

  It asserts the exact `getSales()` output (the whole array). Run it on the unchanged code: it must pass, and that is the baseline.

### Step 4 — Data model: upgrade step (US4.1; BR1.1, BR1.4)
- [x] In `src/server/db.ts`, add the named upgrade step `tv-settings`. It creates the `tv_settings` table (`key TEXT PRIMARY KEY`, `value INTEGER NOT NULL DEFAULT 0`, `updated_at TEXT NULL`) and the indexes `visits_closed_at` and `orders_placed_at` if they do not exist. It inserts no row.
- [x] Add `src/server/__tests__/u8/tvSettingsSchema.test.ts`:
  - a fresh database has the table and indexes and no row;
  - an existing v2 database upgrades with all its data unchanged, and the seed still loads;
  - running the upgrade twice changes nothing.

  Run it.

### Step 5 — Repository and data access (US2.1, US3.1–US3.3, US5.3; BR2.1, BR2.2, BR3.2, BR3.4, BR4.1, BR4.2, BR5.1)
- [x] Add `src/server/salesRules.ts`:
  - `dayOfStoredTime(text)`, the existing `localDay(parseStoredTime(...))` rule;
  - `lineTotalCents(line)`;
  - `dayWindow(day)`, the text range from the day before to the day after;
  - `closedDayTakingsCents(day)`, which uses the window and the exact day check.
- [x] Change `src/server/routes/u7/sales.ts` so `getSales` uses `dayOfStoredTime` and `lineTotalCents` from `salesRules.ts`, keeping its single pass and its output.
- [x] Add read-only functions:
  - `orderRepo.getOpenOrdersAllTables()`, `getTodayOrderCountsByTable(day)` and `getTodayPortionsByItem(day)`, all using the window plus the exact day check;
  - `serviceCallRepo.listOpenCallsAllTables()`;
  - `billingRepo.openVisitsBillTotalCents()`.

  No existing function changes.
- [x] Add `src/server/__tests__/u8/tvReads.test.ts`:
  - open orders from yesterday still listed;
  - ordering and ties;
  - portions, including an order with no lines;
  - cancelled orders left out;
  - both time formats near midnight;
  - open-table total equals the sum of `buildBill` totals;
  - open calls only, oldest first.
- [x] Re-run `salesRegression.test.ts`: it must pass unchanged.

### Step 6 — Business logic: setting and summary (US3.1–US3.3, US4.1, US5.3; BR1.1–BR1.3, BR2.1–BR2.5, BR3.1–BR3.3, BR4.1, BR4.2)
- [x] Add `src/server/tvSettings.ts`: `getTvSettings()` (no row means `{ show_takings: false, updated_at: null }`) and `setShowTakings(value)`, which returns `{ changed, settings }` and writes `updated_at` only when the value changes.
- [x] Add `src/server/tvWallSummary.ts`: `buildTvSummary(now = new Date())`, which returns C1 plus `day_ends_at`. `takings` is present only when shown.
- [x] Add `src/server/__tests__/u8/tvWallSummary.test.ts`:
  - no `takings` key while hidden;
  - `closed_cents` equals `getSales()` `total_cents` for today, with one table closed today and one yesterday;
  - zero values are 0, not missing;
  - busiest table and its tie-break; top dish and its tie-break; nulls when there is nothing;
  - `day_ends_at` is the next local midnight;
  - with 10,000 past closed visits, `buildTvSummary` returns in under 300 ms (NFR6).

  Run it.

### Step 7 — API: routes and live event (US1.2, US4.2, US5.1, US5.2; BR1.2, BR1.3, BR6.1, BR6.2)
- [x] Add `src/server/routes/staff-tv.ts`:
  - `GET /staff/tv/summary`, `GET /staff/tv/settings` and `PUT /staff/tv/settings`, behind the existing staff guard;
  - body validation that returns 400 INVALID_REQUEST;
  - the setting is saved first, then TV_SETTINGS_CHANGED `{ show_takings, updated_at }` is published on `staff`, and only when the value changed;
  - errors use the existing envelope, and 500s are logged.
- [x] In `src/server/routes/registry.ts`, widen `owner` to include `'U8'` and add `{ name: 'staff-tv', mount: '/api', router: staffTvRouter, owner: 'U8' }` after the U7 staff modules (after `staff`).
- [x] Add `src/server/__tests__/u8/staffTvRoutes.test.ts` (supertest):
  - 401 on all three routes without a session;
  - an authenticated summary read refreshes the session's idle time;
  - the GET and PUT round trip;
  - 400 on a missing field, a non-boolean, an extra field or a non-object;
  - an unchanged value publishes no event and keeps `updated_at`;
  - a change publishes exactly one event, after the save.

  Run it, then re-run the existing route-order tests and update them if they list every module (listed in `code-summary.md`).

### Step 8 — Frontend: hook, switch, navigation, plain page (US1.1, US1.2, US2.1, US2.2, US3.x, US4.1, US4.2, US5.1–US5.3; BR7.1–BR7.7, BR8.1, BR8.2, BR9.1, BR9.2)
- [x] In `src/client/hooks/eventNames.ts`, add `TV_SETTINGS_CHANGED` to `STAFF_EVENT_NAMES`, after `TABLE_STATUS_CHANGED`.
- [x] Add `src/client/staff/pages/tv/useTvWall.ts` (C4):
  - triggers: the BR7.1 events plus MENU_CHANGED, read from the event list; reconnects;
  - one read in flight and at most one waiting; the latest answer wins;
  - a 15-second tick on the server clock; a midnight re-read from `day_ends_at`; a 5-minute re-read;
  - a 10-second timeout, Reconnecting and Error states, and 401 handled through `staffFetch`.
- [x] Add `src/client/staff/TvTakingsSwitch.tsx`:
  - `role="switch"` with `aria-checked`, the label "Show takings on TV" and an On/Off word, at least 44 px tall;
  - reads the setting on mount and on reconnect, and follows the event;
  - an optimistic PUT that reverts on failure and shows the existing "Server did not answer, Try again" message.
- [x] In `src/client/staff/pages/registry.tsx`:
  - add `fullScreen?: boolean` to `StaffPage`;
  - add `{ key: 'tv', path: 'tv', label: 'TV wall', icon: '📺', inNav: true, fullScreen: true }` after `qr`;
  - map 📺 in `Icon.tsx` if the icon mapping needs it.
- [x] In `src/client/staff/StaffShell.tsx`:
  - when the current route is a `fullScreen` page, render only that page, with no navigation and no top bar;
  - render `TvTakingsSwitch` in the navigation directly under the "TV wall" link.
- [x] Add `src/client/staff/pages/tv/index.tsx`, the plain TV wall page described in `functional-spec.md`. It uses existing tokens only, and every element carries a `data-testid`.
- [x] Add client unit tests:
  - `src/shared/__tests__/tvWall.test.ts`: waits at 0, 7, 8, 14 and 15 minutes; never negative.
  - `src/client/staff/pages/tv/__tests__/useTvWall.test.ts`: burst merging, latest wins, the midnight trigger, the 5-minute re-read, Reconnecting, Error, and a TV_SETTINGS_CHANGED hidden inside a burst.
  - `src/client/staff/__tests__/TvTakingsSwitch.test.tsx`: reads on mount and on reconnect, follows the event, reverts on failure, keyboard toggle.
  - `src/client/staff/pages/tv/__tests__/TvWallPage.test.tsx`: hidden takings show "Takings hidden"; the empty wordings.

  Run them, then update `StaffShell.test.tsx` and `liveHooksV2.test.ts` for the new nav entry and event name, and list the changes in `code-summary.md`.

### Step 9 — Browser tests (US1.1, US1.2, US2.1, US4.1, US4.2, US5.1; project Mandated rule)
- [x] Add `e2e/u8-tv-foundation/tvWall.spec.ts`:
  - the "TV wall" link opens a full-screen page with no navigation;
  - a signed-out `/staff/tv` shows the PIN screen and then the TV wall;
  - an order placed by a diner appears within 2 s;
  - flipping the switch shows and hides the amounts on an open TV within 2 s;
  - a second staff page's switch follows within 2 s;
  - takings are hidden on a fresh database.
- [x] Add `e2e/u8-tv-foundation/mockup-match.spec.ts`:
  - set up `staff-nav-switch.html`'s state (Kitchen Board page, switch Off), check the "TV wall" link, "Show takings on TV" and "Off";
  - save the mockup and app screenshots side by side in `test-results/mockup-match/u8-tv-foundation/`;
  - list the four TV wall mockups as U9's and leave them out.
- [x] All ports come from `E2E_PORT` and the database from `DB_FILE`, as the existing specs do. Run `npx playwright test e2e/u8-tv-foundation`.

### Step 10 — Environment and build configuration
- [x] No new dependency and no configuration change. Confirm `npm run build` succeeds and `/staff/tv` is served by the existing SPA fallback (`sendFile('index.html', { root: distDir })`).

### Step 11 — Full suite, documentation and traceability
- [x] Run `npm test && npm run test:e2e`. Every existing v1 and v2 test passes. Record each changed existing test with its reason under "v1/v2 tests changed" in `code-summary.md`, and record bugs found by the tests (with their "regression: …" tests) under "Bugs found by the tests and fixed".
- [ ] Write `code-summary.md` and `source-manifest.json`, and run the traceability tool for `traceability.json`.
