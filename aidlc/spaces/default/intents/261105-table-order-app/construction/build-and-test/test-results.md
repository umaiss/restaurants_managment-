# Test Results — Table Order Web App

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`
- Run on the merged app in the main folder, 2026-11-06, after Bolt 4 (U4 `u4-bill-and-close`) was merged. Port 3000 was stopped before the build. [team: project.md > Mandated]

## Build

| Command | Result |
|---|---|
| `npm run build` | Success: 57 modules, `dist/index.html`, CSS 1.41 kB, JS 221.32 kB |
| `npx tsc --noEmit -p .` | Success after one fix in this stage: 0 errors (see Fixed in this stage) |

## Unit, component and server tests

Command: `npm test` (vitest with coverage). Environment: Node and jsdom, not a real browser.

| Total | Passed | Failed | Skipped | Test files |
|---|---|---|---|---|
| 228 | 228 | 0 | 0 | 28 |

Coverage (full suite, the one project-wide run): 87.36% of lines, 85.46% of branches, 84.87% of functions. No coverage floor applies in the `dpl-workshop` scope, and none was set or lowered.

Each Unit's own scoped command was not run again one by one: all 228 tests above include them, and a command that is a subset of an identical full-suite run is run once. [stage rule: deduplicate]

## Browser tests (real browser engines)

| Browser | Command | Total | Passed | Failed |
|---|---|---|---|---|
| Chromium (Playwright) | `npx playwright test` | 46 | 44 | 2 |
| Google Chrome (installed) | `npx playwright test --config playwright.cross-browser.config.ts --project=chrome` | 24 | 22 | 2 |
| WebKit (Safari's engine) | `npx playwright test --config playwright.cross-browser.config.ts --project=webkit` | 24 | 22 | 2 |

The Chrome and WebKit runs leave out the six mockup-match specs; the Chromium run includes them and saved the screenshot pairs in `test-results/mockup-match/<unit>/`. Firefox is not installed or tested. [team: project.md > Testing Posture]

### Failures (the same two tests in every browser)

1. `e2e/build-and-test/board-bill-link.spec.ts` — "regression: a table whose orders are all completed stays on the board until it is closed, so staff can open its bill". Expected `table-section-4` on the Kitchen Board after its only order was completed; the element does not exist.
2. `e2e/build-and-test/keyboard-journey.spec.ts` — "a diner orders, the kitchen prepares and completes it, and staff close the table, all by keyboard". Everything up to "Mark completed" works by keyboard in all three browsers (WebKit with Option+Tab); then the table's card, and with it the link to the bill, is gone, so the table cannot be closed.

Failure detail: `src/client/screens/staff/KitchenBoardScreen.tsx` lines 68–71 keep a table on the board only while it has a Pending or Preparing order. The only link to a table's bill is that card's "Table N →" header. When the last open order is completed, the table leaves the board, so FR3.3 (close once every order is completed) can be reached only by typing `/staff/tables/<n>` by hand. FR3.1, FR3.3 and FR3.5 cannot be done from the screens.

### Timing (real browser, Chromium)

`e2e/build-and-test/live-update-timing.spec.ts`, 10-order burst, measured from the server's answer to the change on screen:

- NFR1, order on the Kitchen Board: 7, 7, 4, 4, 3, 2, 4, 6, 3, 2 ms; p95 7 ms (limit 2000 ms).
- NFR2, status change in My orders: 4, 56, 55, 55, 55, 57, 55, 55, 57, 4 ms; p95 57 ms (limit 2000 ms).

## Fixed in this stage (test configuration)

- The type check reported 142 errors, all in test files: TypeScript did not know the jest-dom matchers (`toBeInTheDocument` and others) that `src/test-setup.ts` adds at run time, and two filters in `src/server/__tests__/sse.test.ts` were typed too narrowly. Fix: `src/test-types.d.ts` (types only) and two parameter types in `sse.test.ts`. The 4 SSE tests and the full suite still pass; no source code or threshold changed.

## Other findings

- Cross-unit traceability: FR3.1, FR3.2, FR3.3, FR3.4, FR3.5 and NFR4 show as not built because U4's `code-generation/traceability.json` lists only its business rules (BR1.1 to BR4.2) and has no rows for the stories US7.1 and US7.2 that the Unit builds. The code exists and is tested (see `cross-unit-traceability.md`); the record is incomplete.

## Loop-Back Log

### Loop-back 1 — 2026-11-06T18:20:04Z

- **Diagnosis:** The Kitchen Board hides a table once none of its orders is Pending or Preparing, which removes the only way to open the table's bill and close it. U4's traceability record misses its two stories.
- **Root-cause stage:** code-generation, Unit U3 `u3-kitchen-board` (the board's table filter, its tests and mockup-match), and Unit U4 `u4-bill-and-close` (its `traceability.json`).
- **Planned fix:** U3: keep a table's card on the board until the table is closed, that is, while its current visit has any order, with a Completed order shown as Completed and the "Table N →" link kept; take the table off the board only on `TABLE_CLOSED`. Update U3's unit tests and browser tests for the new rule and keep the two regression specs above green. U4: add rows for US7.1, US7.2, FR3.1 to FR3.5 and NFR4 to its `traceability.json` with real targets.
- **Estimated impact:** effort about 30 to 45 minutes (a one-line filter change plus tests, a replay of Code Generation with a fresh Plan Approval, a fresh review of each reopened Unit, and a new Build and Test run); financial cost none; risk low to medium: a board that also lists finished orders until the table is closed differs from the wording of FR2.2 ("a card per table with its open orders") and from the board mockup, so the team may prefer a different way to reach the bill.

## Target Verification Matrix

See `build-and-test-summary.md` for the final verdict of every target.
