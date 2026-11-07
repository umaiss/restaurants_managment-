# Build and Test Summary — Table Order Web App

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`; depth Standard; test strategy Standard
- Inputs: `code-generation-plan.md`, `unit-test-instructions.md` and `code-summary.md` of U1 `u1-walking-skeleton`, U2 `u2-diner-screens`, U3 `u3-kitchen-board` and U4 `u4-bill-and-close`; `requirements.md` NFR1 to NFR6
- Second run, 2026-11-07, after Loop-back 1 (see `test-results.md`). The first run (2026-11-06) failed and is kept in the Loop-Back Log.

## Overall status

The app builds and type-checks. All 322 unit, component and server tests pass. In real browsers all 50 browser tests pass in Chromium, and all 29 in Chrome and in WebKit. The defect found in the first run (a table left the Kitchen Board when its last open order was completed, so staff could not reach its bill) is fixed and covered by regression tests. This run is **successful**.

## Test type inventory

| Type | Files | Where it runs |
|---|---|---|
| Unit and component tests | `src/**/__tests__/*.test.ts(x)` | Node and jsdom (not a real browser) |
| Server integration tests | `src/server/__tests__/*.test.ts` | Node, real in-memory SQLite |
| Browser flows per Unit | `e2e/u1-…`, `e2e/u2-…`, `e2e/u3-…`, `e2e/u4-…/*.spec.ts` | Chromium, Chrome, WebKit |
| Mockup match | `e2e/<unit>/mockup-match.spec.ts` | Chromium (screenshots in `test-results/mockup-match/<unit>/`) |
| Keyboard-only journey (NFR6) | `e2e/build-and-test/keyboard-journey.spec.ts` | Chromium, Chrome, WebKit |
| Board-to-bill regression | `e2e/build-and-test/board-bill-link.spec.ts` | Chromium, Chrome, WebKit |
| Timing, NFR1 and NFR2 | `e2e/build-and-test/live-update-timing.spec.ts` | Chromium |
| Motion and layout (UI refresh) | `e2e/build-and-test/motion.spec.ts` | Chromium, Chrome, WebKit |

Integration instructions: `integration-test-instructions.md`. No performance or security instruction files: the Standard strategy asks for neither.

## Coverage expectations

- Project: 92.9% of lines, 86.25% of branches, 84.55% of functions on the full suite. The `dpl-workshop` scope sets no floor; nothing was set or lowered.
- Per Unit: 5 to 8 tests per component (Standard), met by each Unit's own tests.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1 | requirements.md NFR1 | New orders on the Kitchen Board within 2 s, p95 over a 10-order burst | p95 10 ms (max 10 ms) | `live-update-timing.spec.ts`, Chromium; `test-results.md` Timing | build-and-test | Met |
| NFR2 | requirements.md NFR2 | Status change in My orders within 2 s, p95 | p95 58 ms (max 58 ms) | `live-update-timing.spec.ts`, Chromium; `test-results.md` Timing | build-and-test | Met |
| NFR3 | requirements.md NFR3 | Runs on a local machine only, works offline | No external address in `src/`, `index.html` or `dist/`; every browser run used `localhost` only | text search of those folders, 2026-11-07 (no matches); all browser runs | build-and-test | Met |
| NFR4 | requirements.md NFR4 | One currency, no tax or service lines on the bill | No tax or service-charge text in `src/`; the bill carries no tax or service field and its total is the sum of its line subtotals | text search of `src/`; `billing-api.test.ts` "carries no tax or service charge"; `e2e/u4-bill-and-close/mockup-match.spec.ts`, Chromium | build-and-test | Met |
| NFR5 | requirements.md NFR5 | Every status has a word or icon, not colour alone | Icon and word on every status pill in `OrderCard`, `BillOrderCard` and My orders | component tests in jsdom; mockup-match specs checking the status words in Chromium | build-and-test | Met |
| NFR6 | requirements.md NFR6 | Every control reachable and operable by keyboard alone | The whole journey (order, prepare, complete, open the bill, Close table) works by keyboard in Chromium, Chrome and WebKit (WebKit with Option+Tab); Escape closes a dialog and returns focus | `keyboard-journey.spec.ts`, 2 of 2 pass in each browser | build-and-test | Met |
| BT-SUITE | Testing Contract, scope floor | Existing suite stays green | Unit suite 322 of 322; browser tests 50 of 50 (Chromium), 29 of 29 (Chrome), 29 of 29 (WebKit) | `test-results.md` | build-and-test | Met |
| BT-COV | Testing Contract, memory notes | Line-coverage floor | The `dpl-workshop` scope sets no floor; the full suite measured 92.9% for information | `npm test` coverage report | build-and-test | N/A — no floor applies to this scope |
| BT-CI | Testing Contract / memory note "CI execution before merge" | Tests run in CI before merge | The plan runs no CI Pipeline | `aidlc-state.md` | build-and-test | N/A — the plan runs no CI Pipeline |

## Readiness

- **Build-ready:** yes.
- **Test-ready:** yes — every command passed and every target is Met or N/A.
- **Deployment-ready:** not assessed: the plan has no deployment stage.

## Known limitations and outstanding items

- Browser behaviour in the unit tests was checked in Node and jsdom, which are integration evidence only; the browser flows, the keyboard journey and the mockup match ran in real browser engines (Chromium, Chrome, WebKit).
- NFR1 and NFR2 timing ran in Chromium only.
- Safari on a Mac needs Option+Tab to reach buttons unless the system setting "Press Tab to highlight each item" is on; the keyboard spec uses Option+Tab in WebKit.
- The Kitchen Board now keeps a table's card, with its Completed orders, until the table is closed. FR2.2's wording was updated to match (`requirements.md`).
- Fixed in this stage: 142 type errors in test files (test configuration only), and the Menu availability panel now shows the switch and "On" / "Sold out" from the mockup (it showed plain "Available" text).
