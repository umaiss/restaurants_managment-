**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-05
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | `src/server/routes/orders.ts`:122 and `src/server/__tests__/api.test.ts`:69 | The transition endpoint reads `{ to, by }` from the request body, but the plan (Step 9 and Step 10 test descriptions) names the field `status`. The implementation and tests are mutually consistent so the endpoint works correctly, but the field name `to` diverges from the plan's stated contract `{ status, by }`. Later Units that build on this endpoint need to know the actual field name is `to`. | Confirm `to` is the intended field name and update the plan's Step 9 and Step 10 descriptions to match, so U2–U4 builders use the correct request shape. No code change required unless the contract review named `status` as the canonical field. | New |
| R-02 | Minor | `src/server/index.ts`:51 | The port selection expression is `process.env.PORT ?? process.env.E2E_PORT ?? '3000'`. When the Playwright web server starts the app it passes `E2E_PORT` but not `PORT`. If the developer's shell has `PORT` set globally (e.g. a system default of 80), the server will bind to that port instead of `E2E_PORT`, causing the Playwright `webServer.url` check to fail. | Add a note to `.env.example` or a code comment that `PORT` takes precedence over `E2E_PORT`; for the E2E case consider using `E2E_PORT` directly when it is set, or documenting that `PORT` must be unset when running E2E tests. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual invariant trace — invariant 1 (placement_key scope) | PASS | `db.ts` UNIQUE constraint `(table_id, visit_id, placement_key)`; `orderRepo.ts` idempotency check on all three columns; cross-table test in `orderRepo.test.ts` and `api.test.ts` both confirm a new order is created for a different table with the same key. |
| Manual invariant trace — invariant 2 (INVALID_ACTOR) | PASS | `orderRepo.transitionOrder` checks `by !== 'diner' && by !== 'staff'` and throws `OrderError` with code `INVALID_ACTOR`; route returns HTTP 400 `{error:{code:'INVALID_ACTOR',...}}`; unit and integration tests cover it. |
| Manual invariant trace — invariant 3 (ORDER_PLACED payload) | PASS | `orders.ts` builds `ssePayload` with the full `lines` array (name, quantity, price_cents_each, subtotal_cents, menu_item_id) and `total_cents` before publishing; no follow-up fetch needed. |
| Manual invariant trace — invariant 4 (sendFile form) | PASS | `index.ts` uses `res.sendFile('index.html', { root: distDir })` exclusively; never an absolute path. |
| Manual invariant trace — invariant 5 (env vars) | PASS | `DB_FILE`, `PORT`, `E2E_PORT` all read from `process.env`; playwright.config passes them on the web server command line; `.env.example` documents defaults. |
| Manual invariant trace — invariant 6 (test isolation) | PASS | Every test file sets `process.env.DB_FILE = ':memory:'` as its first statement before any import; `vitest.config.ts` uses `pool: forks` with `isolate: true` for file-level module isolation; `resetDb()` / `seedIfEmpty()` in `beforeEach`/`afterEach` guards against intra-file leakage. |
| Manual invariant trace — invariant 7 (server entry-point guard) | PASS | `index.ts` compares `process.argv[1]` against `fileURLToPath(import.meta.url)` before calling `app.listen`; supertest imports `app` without triggering `listen`. |
| Cross-reference — routes vs index.ts | PASS | All three routers (`menuRouter`, `ordersRouter`, `sseRouter`) are imported and mounted in `index.ts`; SSE routes are mounted at `/sse`, API routes at `/api`. |
| Cross-reference — schema vs repositories | PASS | Column names and types in `db.ts` schema match what `orderRepo.ts`, `menuRepo.ts`, and `tableRepo.ts` query. `order_counter` table is initialised in `initSchema`; `nextOrderNumber` uses `RETURNING` correctly. |
| E2E tests | NOT RUN | `npx playwright install chromium` permission was not granted during code generation. All spec files are structurally complete and reference correct routes and `data-testid` attributes that exist in the client components. This is a session constraint, not a code defect. |

### Summary

The walking skeleton is architecturally sound and all seven key invariants are satisfied. The data model, idempotency logic, SSE channel, SPA fallback, and test isolation strategy are correctly implemented and mutually consistent. The two Minor findings are low-risk: a field-name discrepancy between the plan description and the working code (no runtime impact, but future Bolt builders must know the actual field name is `to`), and a port-precedence edge case in the E2E startup path. Neither blocks construction of subsequent Units.
