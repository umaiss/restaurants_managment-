# Test Results — Table Order Web App

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`
- Second run, on the merged app in the main folder, 2026-11-07, after Loop-back 1 replayed Code Generation for all four Units. Port 3000 was stopped before the build. [team: project.md > Mandated]
- The first run (2026-11-06) failed: see "First run" below and the Loop-Back Log.

## Build

| Command | Result |
|---|---|
| `npm run build` | Success: 57 modules, `dist/index.html`, CSS 6.07 kB, JS 225.71 kB (after the 2026-11-07 UI refresh below) |
| `npx tsc --noEmit -p .` | Success: 0 errors |

## Unit, component and server tests

Command: `npm test` (vitest with coverage), exit code 0. Environment: Node and jsdom, not a real browser.

| Total | Passed | Failed | Skipped | Test files |
|---|---|---|---|---|
| 322 | 322 | 0 | 0 | 31 |

Coverage (full suite, the one project-wide run): 92.9% of lines, 86.25% of branches, 84.55% of functions. No coverage floor applies in the `dpl-workshop` scope, and none was set or lowered.

Each Unit's own scoped command was not run again one by one: all 322 tests above include them, and a command that is a subset of an identical full-suite run is run once. [stage rule: deduplicate]

## Browser tests (real browser engines)

| Browser | Command | Total | Passed | Failed |
|---|---|---|---|---|
| Chromium (Playwright) | `npm run test:e2e` | 50 | 50 | 0 |
| Google Chrome (installed) | `npx playwright test --config playwright.cross-browser.config.ts --project=chrome` | 29 | 29 | 0 |
| WebKit (Safari's engine) | `npx playwright test --config playwright.cross-browser.config.ts --project=webkit` | 29 | 29 | 0 |

The Chrome and WebKit runs leave out the six mockup-match specs; the Chromium run includes them and saved the screenshot pairs in `test-results/mockup-match/<unit>/`. The Chrome and WebKit runs are made one after the other, never together, because they share one database. Firefox is not installed or tested. [team: project.md > Testing Posture]

The keyboard-only journey (NFR6) and the board-to-bill regression pass in all three browsers.

### Timing (real browser, Chromium)

`e2e/build-and-test/live-update-timing.spec.ts`, 10-order burst, measured from the server's answer to the change on screen:

- NFR1, order on the Kitchen Board: 8, 10, 4, 3, 3, 4, 4, 4, 4, 3 ms; p95 10 ms (limit 2000 ms).
- NFR2, status change in My orders: 58, 55, 56, 3, 55, 55, 56, 57, 56, 55 ms; p95 58 ms (limit 2000 ms).

## Mockup match

All 23 screenshots in `test-results/mockup-match/` were looked at after this run. The Kitchen Board (pending, preparing, completed, empty, cancel confirm, reconnecting), the bill (completed, open order, empty, error, loading) and the diner screens match their refined mockups. One difference was found in U3's Menu availability panel (plain "Available" text instead of the mockup's switch with "On" / "Sold out", and no item picture); it was fixed in `src/client/components/staff/MenuAvailabilityPanel.tsx`, with the regression test "regression: each row shows the item picture and "On" or "Sold out" beside its switch, as the mockup does" (checked to fail with the old label), and every check above was run again afterwards.

## UI refresh (2026-11-07, at the person's request)

After the sign-off the person asked for a more modern look with animations. Changed: `src/client/index.css` (shared motion, button press and hover, focus rings, amber gradient on main buttons, phone-width column for the diner screens), and small class and animation additions in the diner screens, tab bar, Kitchen Board, order card, bill, confirm dialog, availability panel and closed-table screen. No wording, test id or behaviour changed. All motion stops when the device asks for reduced motion.

Checks run again after the change: type check 0 errors; 322 of 322 unit tests; Chromium 50 of 50, Chrome 29 of 29, WebKit 29 of 29; timing p95 10 ms and 58 ms. New checks in `e2e/build-and-test/motion.spec.ts` (3 tests): menu cards cascade in, the cart badge bumps and the tab indicator slides, the diner column is centred with its tab bar on a wide screen, and nothing animates longer than a blink under reduced motion. The mockup-match specs now ask for reduced motion so their screenshots show finished screens; in the diner spec the dialog picture also waits for the dialog to finish appearing (it had been captured before the dialog showed).

## Fixed in this stage

- Test configuration: the type check had reported 142 errors, all in test files (jest-dom matcher types and two narrow filter types in `sse.test.ts`). Fix: `src/test-types.d.ts` and two parameter types. No source code or threshold changed.
- Mockup match: the Menu availability panel difference above.

## Other findings

- Cross-unit traceability now passes: 31 of 31 IDs covered (see `cross-unit-traceability.md`). The six that were uncovered in the first run have rows in U4's `traceability.json`.

## First run (2026-11-06) — failed, kept for the record

Chromium 44 of 46, Chrome 22 of 24, WebKit 22 of 24, unit suite 228 of 228. The same two tests failed in every browser: `board-bill-link.spec.ts` and `keyboard-journey.spec.ts`. Cause: `KitchenBoardScreen.tsx` kept a table on the board only while it had a Pending or Preparing order, so after the last order was completed there was no link to the table's bill and the table could not be closed from the screens. U4's `traceability.json` also lacked rows for US7.1, US7.2, FR3.1 to FR3.5 and NFR4. Both were fixed through Loop-back 1.

## Loop-Back Log

### Loop-back 1 — 2026-11-06T18:20:04Z

- **Diagnosis:** The Kitchen Board hides a table once none of its orders is Pending or Preparing, which removes the only way to open the table's bill and close it. U4's traceability record misses its two stories.
- **Root-cause stage:** code-generation, Unit U3 `u3-kitchen-board` (the board's table filter, its tests and mockup-match), and Unit U4 `u4-bill-and-close` (its `traceability.json`).
- **Planned fix:** U3: keep a table's card on the board until the table is closed, that is, while its current visit has any order, with a Completed order shown as Completed and the "Table N →" link kept; take the table off the board only on `TABLE_CLOSED`. Update U3's unit tests and browser tests for the new rule and keep the two regression specs above green. U4: add rows for US7.1, US7.2, FR3.1 to FR3.5 and NFR4 to its `traceability.json` with real targets.
- **Estimated impact:** effort about 30 to 45 minutes (a one-line filter change plus tests, a replay of Code Generation with a fresh Plan Approval, a fresh review of each reopened Unit, and a new Build and Test run); financial cost none; risk low to medium: a board that also lists finished orders until the table is closed differs from the wording of FR2.2 ("a card per table with its open orders") and from the board mockup, so the team may prefer a different way to reach the bill.

## Target Verification Matrix

See `build-and-test-summary.md` for the final verdict of every target.
