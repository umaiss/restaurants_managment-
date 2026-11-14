# Unit Test Instructions — U8 `u8-tv-foundation`

## Framework

- **Unit and integration tests:** Vitest with the existing `vitest.config.ts`. It uses the Node environment for `src/server/**` and jsdom for `src/client/**`, with v8 coverage. Supertest drives the HTTP routes.
- **Browser tests:** Playwright with the existing `playwright.config.ts`. It uses an in-memory database, global staff sign-in and the `E2E_PORT` setting.
- No new tool, dependency or configuration is added.

## Run this Unit's tests

Unit and integration tests (U8 files only):

```bash
npx vitest run src/server/__tests__/u8 src/shared/__tests__/tvWall.test.ts src/client/staff/pages/tv/__tests__ src/client/staff/__tests__/TvTakingsSwitch.test.tsx
```

Browser tests (U8 folder only):

```bash
npx playwright test e2e/u8-tv-foundation
```

Run the Sales regression on its own (Step 3, and again after Step 5):

```bash
npx vitest run src/server/__tests__/u8/salesRegression.test.ts
```

The two existing tests U8 has to update are run by:

```bash
npx vitest run src/client/staff/__tests__/StaffShell.test.tsx src/client/hooks/__tests__/liveHooksV2.test.ts
```

## Expected coverage

- **Component volume (Standard strategy):** 5 to 8 tests per component.
  - Upgrade step: 3 tests.
  - Reads: 8 tests.
  - Sales regression: 1 full-output test.
  - Summary: 8 tests.
  - Routes: 8 tests.
  - Wait helpers: 5 tests.
  - TV hook: 8 tests.
  - Switch: 5 tests.
  - Plain page: 4 tests.
  - Browser: 6 flows plus the mockup match.
- **No project-wide line-coverage floor** applies to this scope (dpl-workshop). Build and Test reads coverage on the full suite. No coverage threshold is changed.
- **NFR6 speed check:** `buildTvSummary` with 10,000 past closed visits returns in under 300 ms in the test environment. Do not raise this limit if it fails: surface the gap.

## Mocking and stubbing

- Server tests use a fresh in-memory SQLite database per test file (`DB_FILE=:memory:` through the existing test helpers) and fixed `now` values, so day-boundary cases are exact.
- Route tests sign in through the real staff login with the test `STAFF_PIN` from `src/test-setup.ts`.
- They spy on the live event hub's `publish` to check that an event follows the save, and only when the value changed.
- Client tests use the existing `MockEventSource` and a mocked `staffFetch`, with Vitest fake timers for the 15-second tick, the 10-second timeout, the 5-minute re-read and midnight.

## Test data

- Builders in `src/server/__tests__/u8/fixtures.ts` create tables, visits (open, closed today, closed yesterday), orders (Pending, Preparing, Completed, Cancelled, with no lines) and service calls.
- Times are written in both stored formats: `YYYY-MM-DD HH:MM:SS` and ISO.
- The 10,000-visit dataset is inserted in one transaction inside the test, so it runs quickly.
