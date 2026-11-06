# Unit Test Instructions — U4 `u4-bill-and-close`

## Test framework

Vitest, React Testing Library and supertest (all installed by U1). Playwright with Chromium for the browser tests. No additional packages needed.

## Exact unit-scoped command

```bash
npx vitest run --reporter=json --outputFile=test-results/u4-unit.json src/server/__tests__/tableClose.test.ts src/server/__tests__/billing.test.ts src/server/__tests__/billing-api.test.ts src/client/components/__tests__/ConfirmModal.test.tsx src/client/hooks/__tests__/useBill.test.ts src/client/components/staff/__tests__/BillOrderCard.test.tsx src/client/components/staff/__tests__/BillTotal.test.tsx src/client/components/staff/__tests__/CloseTableSection.test.tsx src/client/screens/staff/__tests__/TableBillScreen.test.tsx
```

This command names U4's test files only, so it does not rerun U1, U2 or U3 tests. It writes `test-results/u4-unit.json`, not `test-results/unit.json`, so the workshop dashboard's full-suite result is not replaced by a Unit-scoped one.

## E2E command (Playwright, Bolt 4 port)

```bash
npm run build && E2E_PORT=6100 npx playwright test e2e/u4-bill-and-close/
```

The Bolt runs its browser tests on `E2E_PORT=6100`. The test server uses an in-memory database (`DB_FILE=:memory:` is set by `playwright.config.ts`), so nothing is kept between runs. Build the app first: the test server serves the built files.

## Expected coverage targets

Standard strategy: 5–8 tests per component. The `dpl-workshop` scope adds no coverage floor; Build and Test checks any floor on the full assembled suite. The Unit-scoped run does not enforce a coverage threshold and no threshold is set or changed by this Unit.

## Mocking and stubbing guidance

- **Server tests** (`tableClose`, `billing`, `billing-api`): use the real code with an in-memory SQLite database: set `process.env.DB_FILE = ':memory:'` before importing, then `resetDb()` and `seedIfEmpty()` in `beforeEach`, as `api.test.ts` does. Place orders with `placeOrder` / `transitionOrder` or through `supertest`; never mock the repositories.
- **SSE publish check**: call `_resetForTest()` from `src/server/sse.ts` in `beforeEach`, subscribe a stub response to the `staff` and `table:<id>` channels, then read what the close published.
- **Client API calls**: mock `fetch` with `vi.stubGlobal('fetch', ...)` for `GET /api/tables/:id/bill` and `POST /api/tables/:id/close`.
- **EventSource (`/sse/staff`)**: mock with `vi.stubGlobal('EventSource', MockEventSource)` where `MockEventSource` exposes `triggerMessage(type, data)`; the same helper the U3 hook tests use.
- **Routing**: wrap screens in `MemoryRouter` and assert on the location after a close.

## Test data management

- Seed minimal bill data per test: `{ table_id: 5, orders: [{ order_number: 15, status: 'Completed', placed_at: '...', lines: [...], subtotal_cents: 2400 }], combined_total_cents: 2400, close_available: true, blocking_orders: [] }`
- Seed server orders with seed menu items `i-04` (1450 cents) and `i-10` (350 cents)
- Reset mock state in `beforeEach`
- Playwright E2E: each spec places the orders it needs through the API on tables 7 to 10 only, with its own `placement_key`, so closing a table never disturbs earlier Units' specs on the shared test server
