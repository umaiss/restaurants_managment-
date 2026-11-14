# Code Summary — U8 `u8-tv-foundation`

Built from the approved `code-generation-plan.md` (all 11 steps) and `unit-test-instructions.md`, implementing the design in `../functional-design/`.

## Baseline before any change (Step 1)

`npm test`: 1544 passed, 0 failed, 0 skipped; line coverage 94.51%.

## Files

**Created**
- `src/shared/tvWall.ts`: C1 types plus `waitMinutes` and `waitLevel`.
- `src/server/salesRules.ts`: `localDay`, `dayOfStoredTime`, `lineTotalCents`, `dayWindow` and `closedDayTakingsCents`.
- `src/server/tvSettings.ts`: the setting, hidden by default.
- `src/server/tvWallSummary.ts`: `buildTvSummary`, including `day_ends_at`.
- `src/server/routes/staff-tv.ts`: `GET /api/staff/tv/summary`, `GET` and `PUT /api/staff/tv/settings`, and the TV_SETTINGS_CHANGED event.
- `src/client/staff/TvTakingsSwitch.tsx`: the "Show takings on TV" switch.
- `src/client/staff/tv.css`: the plain TV page and the switch row, using tokens only.
- `src/client/staff/pages/tv/useTvWall.ts`: C4 data hook (merged reads, latest wins, 15 s tick, midnight re-read, 5-minute re-read, 10 s timeout).
- `src/client/staff/pages/tv/index.tsx`: the plain full-screen TV wall page.
- Tests, listed under Test coverage below.

**Modified**
- `src/server/db.ts`: new upgrade step `tv-settings` (the table and the `visits_closed_at` and `orders_placed_at` indexes; no data touched).
- `src/server/routes/u7/sales.ts`: `getSales` uses the shared day and line rules in its single pass. Output unchanged (regression test). `localDay` is re-exported.
- `src/server/repositories/orderRepo.ts`: `getOpenOrdersAllTables`, `getTodayOrderCountsByTable` and `getTodayPortionsByItem` (new read functions only).
- `src/server/repositories/serviceCallRepo.ts`: `listOpenCallsAllTables` (new).
- `src/server/repositories/billingRepo.ts`: `openVisitsBillTotalCents` (new).
- `src/server/routes/registry.ts`: `owner` type widened to `'U8'`; `staff-tv` entry added after the staff modules.
- `src/client/hooks/eventNames.ts`: `STAFF_EVENT_NAMES` gains `TV_SETTINGS_CHANGED`.
- `src/client/staff/pages/registry.tsx`: `fullScreen` flag; `tv` page entry ("TV wall", 📺).
- `src/client/staff/StaffShell.tsx`: full-screen pages render without the navigation; the switch sits under the TV wall link.
- `src/client/components/ui/SideNav.tsx`: an optional `below` slot under a link (needed to place the switch).
- `src/client/components/ui/Icon.tsx`: a TV line icon for 📺.

**Deleted:** none.

## Key implementation decisions

- `getSales` keeps its single pass over closed visits. The TV and the Sales page share the same day rule and line rule, so their totals are equal (design review R-01).
- `closedDayTakingsCents` and today's counts use an indexed stored-time text range (day before to day after), then an exact server-local day check. This works for both stored time formats.
- The summary returns `placed_at` and `opened_at` as ISO whatever their stored format, plus `day_ends_at` (the server's next local midnight), so the browser's midnight re-read follows the server (R-02).
- The TV hook and the switch read the full list of live events (R-03). MENU_CHANGED also triggers a re-read (R-05).
- An unchanged PUT saves nothing and publishes no event.
- `SideNav` gained an optional slot, and `Icon` a TV glyph. Neither was named in the plan, but both are needed to place and draw the link and switch as the mockup shows. No other screen changes.
- The TV page shows the live-stream status in a `data-sse` attribute, as the Kitchen Board does. The browser tests wait on it.

## Test coverage

| Area | File | Tests |
|---|---|---|
| Sales regression (written before the move) | `src/server/__tests__/u8/salesRegression.test.ts` | 1 (full `getSales` output) |
| Upgrade step | `src/server/__tests__/u8/tvSettingsSchema.test.ts` | table, indexes, no row, v2 upgrade, run twice |
| New reads | `src/server/__tests__/u8/tvReads.test.ts` | any-day open orders, ordering, portions, cancelled left out, both time formats near midnight, open bills, open calls |
| Summary | `src/server/__tests__/u8/tvWallSummary.test.ts` | hidden means no takings key, equals the Sales total, zeros, tie-breaks, nulls, `day_ends_at`, NFR6 speed |
| Routes | `src/server/__tests__/u8/staffTvRoutes.test.ts` | 401, session refresh, round trip, 400 cases, no event on an unchanged value, one event after the save |
| Wait helpers | `src/shared/__tests__/tvWall.test.ts` | 0, 7, 8, 14 and 15 minutes; never negative |
| Hook | `src/client/staff/pages/tv/__tests__/useTvWall.test.ts` | merging, latest wins, midnight, 5 minutes, Reconnecting, Error, event inside a burst |
| Switch | `src/client/staff/__tests__/TvTakingsSwitch.test.tsx` | read on mount and reconnect, follows the event, reverts on failure, keyboard |
| Plain page | `src/client/staff/pages/tv/__tests__/TvWallPage.test.tsx` | "Takings hidden", empty wordings |
| Browser | `e2e/u8-tv-foundation/tvWall.spec.ts` | 6 flows: link opens full screen, PIN gate, order appears in 2 s, switch shows and hides amounts, second page follows, fresh database hidden |
| Mockup match | `e2e/u8-tv-foundation/mockup-match.spec.ts` | staff navigation Off and On, dark and light; the TV wall mockups listed as U9's |

Fixtures: `src/server/__tests__/u8/fixtures.ts`.

## Results

| Check | Result |
|---|---|
| U8 unit-scoped command | 7 files, 52 tests, all pass |
| U8 browser command | 9 pass |
| `npm run build` | succeeds; `/staff/tv` served by the existing SPA fallback |
| `npx tsc --noEmit` | clean |
| Full `npm test` | 1606 passed, 0 failed, 0 skipped; line coverage 94.84% |
| Full `npm run test:e2e` | 187 passed, 0 failed |
| NFR6 | `buildTvSummary` with 10,000 past closed visits: 6.6 ms (limit 300 ms) |

Mockup-match screenshot pairs: `test-results/mockup-match/u8-tv-foundation/`.

## Tests written but not executed in this stage

None. The cross-browser run (Chrome and WebKit) is Build and Test's.

## v1/v2 tests changed

- `src/client/hooks/__tests__/liveHooksV2.test.ts`: the expected staff event list now ends with `TV_SETTINGS_CHANGED` (new event, contract C3).
- `src/client/staff/__tests__/StaffShell.test.tsx`:
  - the expected page keys and nav labels include `tv` / "TV wall" after QR codes (the new navigation link chosen at Scope Definition);
  - two PIN-screen tests' fetch mocks now answer `/api/staff/tv/settings` with 200 once signed in. Before, the mocks answered 401 to every unknown address, so the switch's settings read sent the page back to the PIN screen; a real signed-in browser gets 200.
- `e2e/u5-foundation/mockup-match.spec.ts`: the staff nav-link count goes from 6 to 7, and the last link is checked to be "TV wall" (the new navigation link).

No route-order test needed a change.

## Bugs found by the tests and fixed

None in production code. Two test-only corrections were made during the build:
- A stale `dist/` was rebuilt.
- A browser flow now waits for the first switch save before pressing again. A second press while saving is ignored on purpose.

## Deviations from the plan

- `SideNav.tsx` and `Icon.tsx` were also changed (see Key implementation decisions).
- `src/client/staff/tv.css` was added for the plain page's layout.
- `localDay` moved to `salesRules.ts` and is re-exported from `sales.ts`.

## Known issue noticed (not changed)

`npm run test:e2e` passes `--output=test-results/e2e.json`. Playwright treats that as an output folder, so the JSON report is printed to the console and no `e2e.json` file is written. This predates U8, and U8 did not change the configuration. It is raised for the team at the checkpoint.
