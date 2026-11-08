# Build and Test Summary: Table Order v2

## Overall status

The assembled app (v1, U5, U6 and U7) builds, and every command passed: `npx tsc --noEmit` exit 0; `npm run build` success; `npm test` 1,485 of 1,485 tests passed (Node and jsdom); `npm run test:e2e` 170 of 170 passed in Chromium; the same browser tests in the installed Google Chrome and in WebKit: 212 passed, 2 skipped on purpose, 0 failed. Details, commands and where each ran are in `test-results.md`. The build steps are in `build-instructions.md` and the integration level in `integration-test-instructions.md`.

The only prerequisite beyond v1's is `npm ci`, which installs the one new package (`qrcode`).

## Test type inventory

| Type | What it is | Where it ran |
|---|---|---|
| Unit and integration (server) | Vitest with `supertest` on the real Express app and a real SQLite database in memory | Node |
| Unit (client) | Vitest with Testing Library: components, hooks, design tokens, preferences, alerts | jsdom (a DOM emulator): integration evidence, not browser evidence |
| Browser (main flows of every Unit) | Playwright specs in `e2e/<unit>/` | Chromium; the same specs also in Google Chrome and WebKit |
| Mockup match | `e2e/<unit>/mockup-match.spec.ts` with screenshot pairs in `test-results/mockup-match/<unit>/` | Chromium |
| Cross-Unit journey and keyboard-only journey (added by this stage) | `e2e/build-and-test/v2-cross-unit-journey.spec.ts`, `v2-keyboard-journey.spec.ts` | Chromium, Google Chrome and WebKit |
| Integration instructions | `integration-test-instructions.md` | this stage |
| Performance and security instruction files | not written: they belong to the Comprehensive strategy and this plan runs no performance or security stage; the 300 ms timing tests, the 401 guard tests and the validation tests are part of the Units' own tests | n/a |

## Coverage expectations

The project sets no coverage threshold and none was added or lowered. The Testing Contract's scope floor adds nothing beyond the Standard strategy (5 to 8 tests per component plus integration tests for the key boundaries). The assembled project's line coverage is 94.58% (statements 94.58%, branches 91.80%, functions 94.12%), measured once on the full suite.

| Unit | Tests added | Browser tests |
|---|---|---|
| U5 foundation | 868 at sign-off (887 after its review fixes, including v1's 322) | 83 including v1's |
| U6 diner features | about 190 in its own folders | 33 in its specs (flows and mockup match), 2 added by the integration fixes |
| U7 staff and kitchen features | about 340 in its own folders | 49 in its specs (flows and mockup match) |
| This stage | none at unit level | 2 whole-journey specs |

## Target Verification Matrix

Where a row names browser behaviour, the check ran in a real browser engine unless the row says otherwise.

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1-LIVE | requirements NFR1 | A live change (order, status, menu, special, call) shows on every open screen within 2 seconds | Every live-change browser test passed with limits of 2,000 to 3,000 ms and no fixed sleeps | `e2e/build-and-test/live-update-timing.spec.ts`, the Units' flows, `v2-cross-unit-journey.spec.ts`: 170 passed in Chromium, 212 in Chrome and WebKit | build-and-test | Met |
| NFR1-API | requirements NFR1 | Every API answer within 300 ms on the seed data | The U5 and U7 timing tests passed | `src/server/__tests__/foundation/timing.test.ts` and `u7/timing.test.ts` (Node, real SQLite): `npm test` exit 0 | build-and-test | Met |
| NFR2-GUARD | requirements NFR2 | Every staff route and the staff stream answer 401 without a session | All guard tests passed | `foundation/guard.test.ts`, `staffApi.test.ts`, `staffStreams.test.ts`; the running app answered `GET /api/staff/tables` with 401 and no cookie | build-and-test | Met |
| NFR2-SECRET | requirements NFR2 | No PIN or secret in source or logs; input checked on the server and shown as text | The PIN literal 4242 appears only in test setup and test configuration; the PIN is read from `STAFF_PIN` or made at random and printed once; validation tests for every field passed | `grep` of `src` outside `__tests__` finds no PIN; `staffAccess.test.ts`, `validation.test.ts` | build-and-test | Met |
| NFR3-KEYS | requirements NFR3 | Every function works with the keyboard | The whole v2 journey passed with the keyboard only, with a visible focus indicator at every stop; v1's keyboard journey passed | `v2-keyboard-journey.spec.ts` and `keyboard-journey.spec.ts` in Chromium, Chrome and WebKit | build-and-test | Met |
| NFR3-TOUCH | requirements NFR3 | Touch areas at least 44 px | U5's "+ Add" pill and U6's controls measured at 44 x 44 or more in both themes (the test waits for animations to finish) | `e2e/u5-foundation/foundation.spec.ts`, `e2e/u6-diner-features/diner-features.spec.ts` flow 18; U7 controls use U5's shared components | build-and-test | Met |
| NFR3-CONTRAST | requirements NFR2, FR2.4 | Body text at least 4.5 to 1 in both themes; status never by colour alone | The token contrast test passed (one light amber was darkened from 3.99 to 1); "Slow", "Late", "Running late", "Calling the waiter", "Needs the bill" show words with colour | `src/client/design/__tests__/tokens.test.ts` (jsdom, computed from the token values), the mockup-match specs (Chromium) | build-and-test | Met |
| NFR3-MOTION | requirements NFR3 | All motion stops when the device asks for reduced motion | The reduced-motion tests passed for the tracker, pulse, banner and countdown | `e2e/build-and-test/motion.spec.ts` and the Units' reduced-motion flows (Chromium, Chrome, WebKit) | build-and-test | Met |
| NFR4-DATA | requirements NFR4 | Database changes additive and safe to run twice; no oversold special stock or duplicate order number when two people act at once | A v1 file keeps all rows and runs twice with no change; two orders for the last special: one wins; order numbers unique | `foundation/dbUpgrade.test.ts`, `specialsApi.test.ts`, `orderOptions.test.ts` (Node, real SQLite) | build-and-test | Met |
| NFR5-BROWSERS | requirements NFR5 | Works in Chromium, Google Chrome and WebKit; Firefox not tested | 170 passed in Chromium; 212 passed and 2 skipped on purpose in Chrome and WebKit; no failures | `npm run test:e2e` and `playwright.cross-browser.config.ts` | build-and-test | Met |
| NFR6-TESTS | requirements NFR6 | `npm test && npm run test:e2e` passes with v1's tests and v2's together; every Unit has browser tests and every new or changed screen a mockup-match test; no limit lowered | Exit 0 for both; the mockup-match specs of v1 (4), U5, U6 and U7 all passed; no coverage threshold or time limit was lowered (the only configuration changes are the test PIN, the 127.0.0.1 address, the staff sign-in set-up and the dark colour scheme for v1's mockup-match specs) | `test-results.md`; `git diff 70f4eba..HEAD -- vitest.config.ts playwright.config.ts playwright.cross-browser.config.ts` | build-and-test | Met |
| NFR7-RELOAD | requirements NFR7, FR4.3 | After a live-stream reconnect every screen reloads its data; no notification repeats | The hook tests for reconnect and reload passed; the ready banner does not repeat after a reload or reconnect | `liveHooksV2.test.ts`, `useStaffSSE.test.ts` and the alert tests (jsdom with a mocked stream, integration evidence); the banner-once-after-reload flow in Chromium, Chrome and WebKit (real browser); a real stream drop and reconnect was not forced in a real browser here | build-and-test | Met |
| NFR8-LOCAL | requirements NFR8 | `npm install && npm start` at http://localhost:3000; every port and the database file come from the environment | The app started with `npm start` on port 3000 and answered the menu (200), the page (200) and a staff route (401); ports and the file come from `PORT`, `E2E_PORT`, `DB_FILE` | the running app; `src/server/config.ts`; `playwright.config.ts` | build-and-test | Met |
| TC-STRATEGY | Testing Contract (Standard strategy) | Unit tests per component plus integration tests for key boundaries | Per-Unit unit tests plus `integration-test-instructions.md` and the whole-journey specs | the Units' `code-summary.md` and this stage's files | build-and-test | Met |
| TC-SUITE | Testing Contract (scope floor) | The existing test suite stays green | v1's 322 unit tests and its browser tests pass with v2; every v1 or U5 test that was changed is listed with its reason in the Units' `code-summary.md` | `npm test`, `npm run test:e2e` | build-and-test | Met |
| TC-CI | Testing Contract (CI before merge) | Applies only when the plan runs CI Pipeline | The plan runs no CI Pipeline (stage 3.7 is skipped in `aidlc-state.md`) | `aidlc-state.md` | n/a | N/A: the plan runs no CI Pipeline |
| PR-MOCKUP | project rule | A mockup-match spec for every Unit, with screenshots in `test-results/mockup-match/<unit>/` | Specs for U1 to U7 passed; pairs looked at for U5, U6 and U7 | `e2e/u*/mockup-match.spec.ts` | build-and-test | Met |
| PR-FLAKY | project rule | A flaky test is fixed in the test code; a threshold is never lowered | Two tests that failed under load were fixed in their test code (see `test-results.md`); one single, unexplained failure in an earlier run is recorded | `test-results.md` | build-and-test | Met |

## Readiness assessment

- **Build-ready:** yes. One command builds the pages; `npm ci` installs everything.
- **Test-ready:** yes. All unit and browser tests pass in all three engines.
- **Deployment-ready:** the app is ready to run locally (`npm start`). The plan has no deployment stages, so nothing was deployed or checked beyond a local run.

## Known limitations and outstanding items

- The unit tests of the client run in jsdom, a DOM emulator; browser behaviour is shown only by the Playwright runs in Chromium, Chrome and WebKit. A real stream drop and reconnect in a browser was not forced (NFR7 reload is jsdom evidence for the reload itself).
- The two PIN lockout browser tests are skipped in Chrome and WebKit on purpose and run in Chromium.
- Item names on old order lines are read live from the menu (an accepted risk recorded since Bolt 5); the seed's burger and pizza "Size" groups are not required (U6's options sheet makes a required group work; the seed was left as v1 behaves).
- The ratings view reloads on table-closed and order-status events because a rating has no live event of its own (as designed).
- A cancelled ticket shows "Cancelled" and when it was placed, with no running timer, because the app stores no cancel time.
- One unit test (`foundation/callsApi.test.ts`) failed once in an earlier run and has not failed since; its cause was not found.
- Requirements `NFR5` and `NFR6` show as "uncovered" in the traceability tool's output because no Unit builds them: this stage verifies them (rows `NFR5-BROWSERS` and `NFR6-TESTS` above). See `cross-unit-traceability.md`.
