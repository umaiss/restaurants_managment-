# Unit Test Instructions — U3 `u3-kitchen-board`

## Test framework

Vitest + React Testing Library (installed by U1). No additional packages needed.

## Exact unit-scoped command

```bash
vitest run --reporter=json --outputFile=test-results/unit.json src/client/screens/staff src/client/hooks/useBoardOrders.ts src/client/hooks/useMenuAvailability.ts src/client/components/staff
```

This command is scoped to U3's files only and does not rerun U1 or U2 tests.

## E2E command (Playwright, Bolt 3 port)

```bash
E2E_PORT=5100 npx playwright test e2e/u3-kitchen-board/
```

The worktree uses `E2E_PORT=5100` to avoid colliding with Bolt 2 running in parallel. The test server uses an in-memory database, so nothing is kept between runs. Build the app first (`npm run build`): the test server serves the built files.

## Expected coverage targets

Standard strategy: 5–8 tests per component. No coverage floor is applied by this scope (dpl-workshop); Build and Test checks the floor on the full assembled suite. The unit-scoped run does not enforce a coverage threshold.

## Mocking and stubbing guidance

- **API calls**: mock `fetch` with `vi.stubGlobal('fetch', ...)` for `GET /api/orders`, `GET /api/menu`, `PATCH /api/orders/:id/status`, `PATCH /api/menu/:id/availability`
- **EventSource (SSE `/sse/staff`)**: mock with `vi.stubGlobal('EventSource', MockEventSource)` where `MockEventSource` exposes `triggerMessage(type, data)` for test control; disconnect on `close()`
- **`useBoardOrders` and `useMenuAvailability`**: import and test directly; no context provider needed — hooks are standalone

## Test data management

- Seed minimal order data per test: `{ id: 'ord-1', orderNumber: 1, tableId: 1, status: 'Pending', lines: [...], placedAt: '...' }`
- Seed minimal menu data: `[{ id: 'i-01', name: 'Burger', available: true, category: 'Mains' }]`
- Reset mock state in `beforeEach`
- Playwright E2E: the `webServer` in `playwright.config.ts` starts the app on `E2E_PORT` (set it to 5100 for this Bolt) with an in-memory database; each spec places the orders it needs through the API
