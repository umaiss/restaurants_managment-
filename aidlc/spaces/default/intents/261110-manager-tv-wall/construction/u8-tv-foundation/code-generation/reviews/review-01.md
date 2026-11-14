## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-10T18:54:12Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | package.json > scripts."test:e2e" (also named in code-summary.md > Known issue noticed) | The browser test command passes `--output=test-results/e2e.json`. Playwright reads `--output` as a results folder, so no `e2e.json` file is written. The project's verification command is documented as writing that file for the workshop dashboard. The summary says this was there before U8 and was not changed. | Decide at the checkpoint whether to fix the script (for example, set the JSON reporter output file through `PLAYWRIGHT_JSON_OUTPUT_NAME`) so the dashboard can read the e2e results. This does not block U8. | New |
| R-02 | Minor | src/server/repositories/orderRepo.ts > getOpenOrdersAllTables | The open-orders read filters on `status` and groups by order. There is no index on `orders.status`, so each summary read (one per event burst, plus every 5 minutes) scans the whole orders table. The 10,000-visit speed test passed at about 9 ms, so this is fine today. It will grow with history, and U8 added indexes only for the date columns. | Optionally add an index on `orders(status)` to the `tv-settings` upgrade step, or note the scan as accepted. No change is needed for the current data size. | New |
| R-03 | Minor | src/client/staff/pages/tv/index.tsx > root `<section aria-live="polite">` | The whole wall is one polite live region, and the hook updates `now` every 15 seconds. Every recount of waits could be announced to a screen reader. The wall is a display page, so the effect is small, but it is noisy and is not what the design asks for. U9 will replace this page's look. | Limit `aria-live` to the connection status line, or leave it and let U9 settle it. | New |
| R-04 | Minor | src/client/staff/StaffShell.tsx > fullScreenPage branch | A full-screen page returns before the nav, the theme control and the sign-out footer render. Someone on the TV wall has no way back to the other staff pages except by editing the address. The design asks for exactly this (BR9.1), so this is a choice to confirm, not a defect. | Confirm with the team that no exit control is wanted on the TV page, or record that U9 will add one. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npx vitest run src/server/__tests__/u8 src/shared/__tests__/tvWall.test.ts src/client/staff/pages/tv/__tests__ src/client/staff/__tests__/TvTakingsSwitch.test.tsx` | PASS: 9 files, 62 tests passed, 0 failed. The 10,000-visit summary read took 8.8 ms in this run (321 ms was reported for the test, which includes setup). | Matches the summary's claims. The tests cover the 401 and 400 cases, no event on an unchanged value, save-then-announce, the hidden-takings case with no `takings` key, both stored time formats near midnight, and the Sales regression. These are real assertions, not always-pass tests. |
| `npx tsc --noEmit` | PASS: no output | Types are clean across the changed server and client files. |

### Summary

U8 implements the design faithfully. The routes sit behind the staff guard, the `takings` key is absent while takings are hidden, and the new database step only adds a table and indexes. The Sales page and the TV share one day and line rule, backed by a regression test. Every source path in the manifest relates to the unit, and the edits to existing tests (event list, nav entries, fetch mocks, nav-link count) are listed with reasons. Only minor points remain, so a developer could build and keep this as is.
