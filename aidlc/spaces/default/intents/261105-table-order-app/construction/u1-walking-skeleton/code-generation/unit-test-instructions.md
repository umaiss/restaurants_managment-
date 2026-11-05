# Unit Test Instructions — u1-walking-skeleton

## Test framework

- **Unit/integration tests:** Vitest (`vitest`) with `@vitest/coverage-v8`
- **E2E tests:** Playwright (`@playwright/test`) — Chromium only for this Unit (Build and Test adds installed Chrome and WebKit)
- **HTTP integration helper:** `supertest`

## Unit-scoped commands

Run these for this Unit only. Do NOT use the bare `npm test` command here — that runs the full suite and would rerun other Units' tests once they exist.

```bash
# Unit and integration tests for this Unit only
npx vitest run --reporter=verbose src/server

# API integration tests (needs the DB)
npx vitest run --reporter=verbose src/server/__tests__/api.test.ts

# All server tests for this Unit
npx vitest run --reporter=verbose src/server/__tests__/

# E2E skeleton spec (Chromium)
npx playwright test e2e/u1-walking-skeleton/skeleton.spec.ts --project=chromium

# Mockup-match spec (Chromium)
npx playwright test e2e/u1-walking-skeleton/mockup-match.spec.ts --project=chromium

# All E2E for this Unit
npx playwright test e2e/u1-walking-skeleton/ --project=chromium
```

The full verification command `npm test && npm run test:e2e` runs the whole suite; Build and Test checks it on the assembled project. A coverage-threshold failure on the full suite (when this Unit's tests cover only some of the source) is not a failed test for this Unit; Build and Test checks the full coverage floor on the assembled project.

## Expected coverage

- **Strategy:** Standard — 5–8 Vitest tests per component
- **Coverage floor:** The `dpl-workshop` scope adds no mandatory coverage floor beyond the selected strategy. Build and Test checks the full project coverage on the assembled suite; the per-unit run does not enforce a floor.
- **Target by component:**
  - `src/server/db.ts` — 5 tests (seed, idempotency, visit helpers, schema constraints)
  - `src/server/repositories/orderRepo.ts` — 9 tests (place, idempotency, placement_key scope, unavailable items, transitions, INVALID_ACTOR)
  - `src/server/repositories/menuRepo.ts` — 2 tests (happy path, availability flag)
  - `src/server/sse.ts` — 4 tests (publish, subscribe, replay, dead-subscriber cleanup)
  - `src/server/routes/*` via supertest — 7 integration tests (menu, place order, idempotency, same-key different-table, transition, INVALID_ACTOR)
  - Playwright E2E — 3 assertions (table view, staff view, SSE event within 2s)
  - Playwright mockup-match — 2 screenshots (table shell, staff shell)

## Mocking and stubbing guidance

- DB tests use a temporary in-memory SQLite (`:memory:`) or a temp file in `os.tmpdir()` — never the real `DB_FILE`. Set `process.env.DB_FILE = ':memory:'` before importing `db.ts` in test setup.
- SSE tests create a mock `Response` object with `write`, `setHeader`, and `on` spies — no real HTTP server needed.
- API integration tests (`api.test.ts`) use `supertest(app)` where `app` is the Express instance exported from `index.ts` before `.listen()`. Use an in-memory or temp DB.
- Playwright E2E tests start a real server on `E2E_PORT` (default 3100); the `webServer` config in `playwright.config.ts` manages startup. Each spec file that needs its own server uses `E2E_PORT + 100` (3200 by default) via a local `webServer` fixture.

## Test data management

- Seed data is deterministic — the same 10 tables, 4 categories, 12 items every time.
- Each test that writes to the DB uses a fresh in-memory DB created in `beforeEach` and torn down in `afterEach`.
- The Playwright server starts with a fresh DB_FILE in a temp path; `playwright.config.ts` passes `DB_FILE` via `webServer.env`.

## Key invariants to verify

1. `placement_key` scope is `(table_id, visit_id, placement_key)` — the same UUID sent to a *different* table creates a NEW order.
2. The `by` field on a transition must be `"diner"` or `"staff"` — any other value returns 400 `{error: "INVALID_ACTOR"}`.
3. `ORDER_PLACED` SSE payload includes the full item list with prices — no follow-up fetch required by the client.
4. The Express server must use `res.sendFile('index.html', { root: distDir })` (never `res.sendFile(<absolute path>)`) so it works inside worktrees under `.aidlc/worktrees/`.
5. All ports and DB_FILE come from environment variables (`PORT`, `E2E_PORT`, `DB_FILE`).
