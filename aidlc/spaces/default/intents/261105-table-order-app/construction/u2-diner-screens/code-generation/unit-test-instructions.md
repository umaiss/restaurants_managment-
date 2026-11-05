# Unit Test Instructions — U2 `u2-diner-screens`

## Test framework

Vitest + React Testing Library (already installed by U1). No additional packages needed.

## Exact unit-scoped command

```bash
vitest run --reporter=json --outputFile=test-results/unit.json src/client/screens/diner src/client/hooks/useTableSSE.ts src/client/hooks/useCart.ts src/client/components/diner
```

This command is scoped to U2's files only. It does not rerun U1 tests.

## E2E command (Playwright, Bolt 2 port)

```bash
E2E_PORT=4100 DB_FILE=e2e-u2.db npx playwright test e2e/u2-diner-screens/
```

The worktree uses `E2E_PORT=4100` and its own `DB_FILE` to avoid colliding with Bolt 3 running in parallel.

## Expected coverage targets

Standard strategy: 5–8 tests per component. No coverage floor is applied by this scope (dpl-workshop); Build and Test checks the floor on the full assembled suite. The unit-scoped run does not enforce a coverage threshold — do not add `--coverage` flags that would fail on uncovered U1 source.

## Mocking and stubbing guidance

- **API calls**: use `vitest`'s `vi.stubGlobal('fetch', ...)` or `msw` (if installed by U1) to mock `/api/menu`, `/api/orders`, and `/sse/tables/:id` responses
- **localStorage / sessionStorage**: use `vi.stubGlobal` or the jsdom environment's real `localStorage`; reset between tests with `localStorage.clear()`
- **EventSource (SSE)**: mock with a custom class: `vi.stubGlobal('EventSource', MockEventSource)` where `MockEventSource` exposes `triggerMessage(type, data)` for test control
- **`useCart`**: import and test directly; no mock needed for unit tests of screens that use it — wrap in a provider if context-based, or pass via props

## Test data management

- Seed minimal menu data in each test (`[{ id: 'i-01', name: 'Burger', priceCents: 1050, category: 'Mains', available: true }]`)
- Reset localStorage in `beforeEach` / `afterEach`
- Playwright E2E: start the dev server via the `webServer` config in `playwright.config.ts` using `E2E_PORT` and `DB_FILE` env vars; seed a fresh SQLite database for each spec file
