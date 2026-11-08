# Test Results: Table Order v2 (Build and Test)

Results of building and testing the assembled app: v1, the foundation U5, and U6 and U7 (built in parallel and merged). Every number below is from a run in the main folder on the merged code. Where a check ran is named for each, because only a real browser engine can show native browser behaviour.

## Build

| Step | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | exit 0, no output |
| Page bundle | `npm run build` | success: `dist/index.html` (0.40 kB), one stylesheet (25.14 kB), one script (344.45 kB, 105.98 kB gzipped) |
| Packages | `npm ci` | success; the one new package of v2 is `qrcode` 1.5.4 with `@types/qrcode` 1.5.5 |

## Unit and integration tests

| Command | Where it ran | Result |
|---|---|---|
| `npm test` (the full suite with the project's own coverage configuration, once) | Node (server tests, real SQLite in memory) and jsdom, a DOM emulator (client components and hooks) | exit 0. 102 test files, 1,485 tests: 1,485 passed, 0 failed, 0 skipped |

Coverage on the assembled project, from `coverage/coverage-summary.json`: lines 94.58%, statements 94.58%, branches 91.80%, functions 94.12%. The project sets no coverage threshold, and none was added or lowered.

The Units' own scoped runs (in their worktrees, before the merge) were: U5 868 unit tests (later 887) and 83 browser tests; U6 1,083 unit tests and 118 browser tests; U7 1,253 unit tests and 132 browser tests. The merged suite is larger than any of them because it holds all three Units' tests plus the integration fixes.

## Browser tests (real browser engines)

| Command | Where it ran | Result |
|---|---|---|
| `npm run test:e2e` (all browser tests; two Playwright projects, `chromium` and `chromium-v1-mockups`) | Chromium, driven by Playwright | 170 passed, 0 failed, 0 flaky (1.8 minutes) |
| `npx playwright test --config playwright.cross-browser.config.ts` | The installed Google Chrome and WebKit (Safari's engine) | 212 passed, 2 skipped, 0 failed (3.1 minutes) |

The 2 skipped tests are the staff PIN lockout flow in Chrome and in WebKit, skipped on purpose: it runs from its own address in Chromium so that locking it cannot lock the other tests out. The cross-browser configuration leaves out the mockup-match specs, which are run in Chromium only (they save the screenshots the team looks at). Firefox is not installed and not tested, by the project's rule.

The two whole-journey specs this stage added ran in all three engines:

- `e2e/build-and-test/v2-keyboard-journey.spec.ts`: the whole v2 journey with the keyboard only (the staff PIN, the options sheet's focus trap, Settings, the allergy warning, placing an order, the board's station tabs, the call and Same again) with a visible focus indicator checked at every stop.
- `e2e/build-and-test/v2-cross-unit-journey.spec.ts`: one story across the diner and staff screens (a menu edit on an open Menu, an order with options on the right station boards, a call answered, the stations completing the order and one ready banner, a special removed when its item is hidden, the floor map, the bill with option lines, close and rating, and the sales page).

## Mockup match

The mockup-match specs of every Unit ran in Chromium and passed (v1's four, U5's, U6's 14 pairs, U7's 16 pairs). The screenshot pairs are in `test-results/mockup-match/<unit>/`. The differences accepted, with their reasons, are in each Unit's `code-summary.md`.

## Problems found and fixed during this work

| What | Found by | Fixed |
|---|---|---|
| A live Chef's special stayed on the diner Menu after staff hid or sold out its dish, with a dead "+ Add" (Major) | the cross-Unit review of the merged app | A special whose item or category is hidden, or whose item is sold out, is no longer live, and the change is published; the card is hidden; test added, and a browser test (19) |
| A special price plus a negative option could make an order impossible to place, with no way out for the diner (Major) | the same review | The launch and the options save check the cheapest price; the cart refresh falls back or removes the line; the diner can no longer loop; tests added |
| An item hidden while an order was on its way showed raw server text | same | `UNKNOWN_ITEM` refreshes the cart with a plain notice; test added |
| The item form saved in two steps and could half-save | same | One request saves the fields and the options together; tests added |
| The Sales page (and the board with its panel open) opened more than one live stream | same | One shared stream per page; tests added |
| `test-results/` files were tracked in git | same | Removed from the index (the folder is in `.gitignore`) |
| The touch-area browser test (18) measured 43.99998 px on a control that was still animating | Bolt 6's second review | The test now waits for finite animations; stable in 6 of 6 runs |
| A Chef's special page test found a stale element under load | a unit run on the merged app | The test waits on the text and looks the card up afresh each time; stable in 3 of 3 full runs |
| A first browser run on a stale `dist/` failed in many places | this stage | The pages were rebuilt; `npm run build` before the browser tests is now in the build instructions |

One call-answer unit test (`foundation/callsApi.test.ts`, UNKNOWN_CALL) failed once in one of the developer's runs and has not failed in any later full run (I ran the full suite four more times, three in a row and once in this stage's formal run). It is recorded here as an unexplained single failure; no cause was found.

## Target Verification Matrix

See `build-and-test-summary.md` for the full matrix, with each target's source, expected value, actual value and evidence.

## Loop-Back Log

No loop-back was needed. Every failure found in this stage was fixed inside the stage's remit or in the merged code, and the run ended with every command passing.
