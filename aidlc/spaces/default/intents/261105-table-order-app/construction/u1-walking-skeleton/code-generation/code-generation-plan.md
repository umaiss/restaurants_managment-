# Code Generation Plan — u1-walking-skeleton

## Summary

- Builds: Express + SQLite backend with Order API + SSE, React SPA shell with routing to /table/:id and /staff
- Touches: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `src/server/`, `src/client/`, `e2e/u1-walking-skeleton/`
- Tests: ~30 unit/integration tests (Vitest) covering DB schema, seed, Order API, SSE channel + 1 Playwright E2E spec + 1 mockup-match spec

---

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "dpl-workshop",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "project",
      "text": "These notes add to the methodology the framework sets; they don't change it.\n- **Browser tests:** besides unit and integration tests, every Unit adds Playwright tests in `e2e/<unit>/` for its main flows. The walking skeleton installs Playwright with Chromium.\n- **Verification command:** `npm test && npm run test:e2e`.\n  - `npm test` writes `test-results/unit.json` and `coverage/coverage-summary.json`.\n  - `npm run test:e2e` writes `test-results/e2e.json`.\n  - The workshop dashboard reads these files.\n- **Mockup match:**\n  - Every Unit adds `e2e/<unit>/mockup-match.spec.ts`. For each refined mockup the Unit builds, it sets up the same state and checks that the screen shows the mockup's headings, labels, buttons, messages and status words.\n  - It saves the mockup and app screenshots side by side in `test-results/mockup-match/<unit>/`.\n  - Parts that a later Unit owns are left out of the comparison and listed.\n- **Browsers checked at Build and Test:**\n  - Chromium, the installed Google Chrome, and WebKit (Safari's engine).\n  - Firefox is not installed or tested.\n  - Build and Test also adds a keyboard-only test of the whole journey, for NFR6.\n- **Ports and database:** every port and the SQLite database file come from environment variables, so Bolts built in parallel never share either:\n  - `PORT`, default 3000: the app the team uses, in the main folder only.\n  - `E2E_PORT`, default 3100: the browser tests. Specs that need their own server use `E2E_PORT` + 100 and + 200 (3200 and 3300 by default).\n  - `DB_FILE`: the database file.\n  - Each parallel Bolt runs its tests with its own `E2E_PORT`: 4100, 5100, 6100 and 7100, in batch order. It also uses its own `DB_FILE` inside its worktree.\n- **A flaky test** is fixed in the test code; a threshold is never lowered."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:1802929429da4c7ecc1af400cd69f52c6f6b9645e66cf102fb8cb6c1c4e3e978",
  "contract_sha256": "sha256:b4cb807649ab2c72fee4d5b1b31c7ff4f1392743ea63e3079156fb0ca689734d"
}
```

---

## Steps

### Step 1 — Project structure and configuration skeleton
- [x] Create `package.json` with scripts: `start` (tsx server), `build` (vite), `test` (vitest with JSON reporter → `test-results/unit.json`), `test:e2e` (playwright → `test-results/e2e.json`), `dev`
- [x] Add runtime dependencies: `express`, `better-sqlite3`, `react`, `react-dom`, `react-router-dom`
- [x] Add dev dependencies: `typescript`, `tsx`, `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@types/express`, `@types/better-sqlite3`, `@types/react`, `@types/react-dom`
- [x] Create `tsconfig.json` (strict, ESM for server + bundler for client)
- [x] Create `vite.config.ts` (React plugin, outDir `dist`, proxy `/api` and `/sse` to Express in dev)
- [x] Run `npm install`
- [ ] Install Playwright with Chromium: `npx playwright install chromium` — awaiting permission to run npx

*Traces: US8.1 (FR5.1 — one-command startup)*

### Step 2 — Bootstrap test runner and record unit-scoped command
- [x] Create `vitest.config.ts`: include `src/**/*.test.ts`, reporters `verbose` + `json` to `test-results/unit.json`, coverage via `@vitest/coverage-v8` to `coverage/`
- [x] Create `playwright.config.ts`: project Chromium only, `webServer` starts Express on `E2E_PORT` (default 3100), `baseURL` reads `E2E_PORT`, output `test-results/e2e.json`
- [x] Create `e2e/u1-walking-skeleton/` directory with a placeholder `skeleton.spec.ts` that imports `@playwright/test` (so playwright config is valid before the full spec is written in Step 10)
- [x] Verify unit-scoped command runs: `npx vitest run --reporter=verbose src/server`

*Traces: FR5.1, FR5.2 (platform bootstrap)*

### Step 3 — Data model: implement
- [x] Create `src/server/db.ts`: open SQLite at `process.env.DB_FILE ?? 'table-order.db'`, export typed `db` instance
- [x] Write schema creation (runs on first open):
  - `tables` (id, label, status: open|closed)
  - `categories` (id, name, sort_order)
  - `items` (id, category_id, name, description, price_cents, image_url, available)
  - `visits` (id, table_id, opened_at, closed_at)
  - `orders` (id, order_number, visit_id, table_id, status: Pending|Preparing|Completed|Cancelled, placed_by: diner, placement_key, placed_at)
  - `order_items` (id, order_id, item_id, quantity, unit_price_cents)
- [x] Write `seedIfEmpty()`: inserts 10 tables, 4 categories (Starters/Mains/Desserts/Drinks), 12 items with realistic names/prices/images if tables count is 0
- [x] Export `openVisit(tableId)` and `getCurrentVisit(tableId)` helpers

*Traces: FR5.1 (DB), FR1.1 (menu read), FR2.1 (kitchen board), FR3.1 (billing)*

### Step 4 — Data model: tests
- [x] Create `src/server/__tests__/db.test.ts`
- [x] Test: `seedIfEmpty()` creates 10 tables, 4 categories, 12 items in a fresh in-memory DB (`:memory:` or temp DB_FILE)
- [x] Test: calling `seedIfEmpty()` twice keeps counts the same (idempotent)
- [x] Test: `openVisit(tableId)` creates a visit row with the correct table_id
- [x] Test: `getCurrentVisit(tableId)` returns the open visit; returns null when none
- [x] Test: schema enforces NOT NULL on `order_number` and `placement_key`
- [x] Run `npx vitest run --reporter=verbose src/server/__tests__/db.test.ts`

*Traces: FR5.1, FR5.2*

### Step 5 — Repository / data access: implement
- [x] Create `src/server/repositories/menuRepo.ts`: `getMenu()` returns `{categories, items}` with availability flag
- [x] Create `src/server/repositories/orderRepo.ts`:
  - `placeOrder(tableId, visitId, placementKey, lines[])` — idempotency: `(table_id, visit_id, placement_key)` unique; generates `order_number` (e.g. `ORD-<timestamp>`); drops lines for unavailable items; returns `{order_number, dropped[]}` 
  - `transitionOrder(orderNumber, newStatus, by)` — validates legal transitions (Pending→Preparing, Preparing→Completed, Pending→Cancelled); checks `by` is `"diner"` or `"staff"` (throws `INVALID_ACTOR`); diner can only Cancel Pending; staff can Prepare and Complete
  - `getOrdersByVisit(visitId)` returns orders with their items
- [x] Create `src/server/repositories/tableRepo.ts`: `getTableStatus(tableId)`, `openVisit(tableId)`, `closeVisit(visitId, tableId)`

*Traces: FR1.3 (place order), FR1.6 (order placed), FR1.7 (cancel), FR2.4–FR2.6 (transitions), FR3.1 (billing reads ordering)*

### Step 6 — Repository: tests
- [x] Create `src/server/__tests__/orderRepo.test.ts`
- [x] Test: `placeOrder` creates an order, returns order_number and empty dropped[]
- [x] Test: `placeOrder` with same placement_key returns same order_number (idempotent)
- [x] Test: `placeOrder` with same placement_key but different table_id creates a NEW order
- [x] Test: `placeOrder` drops lines for items where `available = 0`, lists them in `dropped`
- [x] Test: `transitionOrder` Pending→Preparing succeeds
- [x] Test: `transitionOrder` Preparing→Completed succeeds
- [x] Test: `transitionOrder` Pending→Completed throws (illegal transition)
- [x] Test: `transitionOrder` with `by: "diner"` on Preparing→Completed throws `INVALID_ACTOR`
- [x] Test: `transitionOrder` Pending→Cancelled with `by: "diner"` succeeds
- [x] Run `npx vitest run --reporter=verbose src/server/__tests__/orderRepo.test.ts`

*Traces: FR1.6, FR1.7, FR2.4, FR2.5, FR2.6, NFR5 (idempotency)*

### Step 7 — Business logic (SSE channel): implement
- [x] Create `src/server/sse.ts`: in-memory SSE channel manager
  - `subscribe(channel, res)` — registers a Response as an SSE subscriber; sets SSE headers; on `close` removes subscriber
  - `publish(channel, eventType, data)` — broadcasts to all subscribers on that channel; ring-buffer of last 60 events per channel (1-hour at 1 event/min); replays from `Last-Event-ID` on reconnect; assigns monotonic `id` to each event
  - Channels: `'staff'` and `'table:<id>'`

*Traces: FR4.1 (SSE), FR4.2 (reconnect), NFR1 (latency ≤2s), NFR2 (reconnect)*

### Step 8 — SSE channel: tests
- [x] Create `src/server/__tests__/sse.test.ts`
- [x] Test: `publish` to a channel with no subscribers does not throw
- [x] Test: `subscribe` then `publish` calls `res.write` with correct SSE event format (`event:`, `data:`, `id:`)
- [x] Test: ring-buffer holds published events; replay from `Last-Event-ID` sends only newer events
- [x] Test: closed subscriber is removed on the next publish (no dead writes)
- [x] Run `npx vitest run --reporter=verbose src/server/__tests__/sse.test.ts`

*Traces: FR4.1, FR4.2*

### Step 9 — API / endpoint: implement
- [x] Create `src/server/routes/menu.ts`: `GET /api/menu` — returns `{categories, items}` from `menuRepo.getMenu()`
- [x] Create `src/server/routes/orders.ts`:
  - `POST /api/tables/:id/orders` — reads `{placement_key, lines[{item_id, quantity}]}` from body; calls `placeOrder`; publishes `ORDER_PLACED` to `'staff'` and `'table:<id>'` with full payload `{order_number, table_id, visit_id, items:[{name, quantity, unit_price_cents}], total_cents, status:'Pending'}`; returns 201 `{order_number, dropped}`
  - `POST /api/orders/:order_number/transition` — reads `{status, by}` from body; calls `transitionOrder`; publishes `ORDER_STATUS_CHANGED` to `'staff'` and the order's `'table:<id>'`; returns 200 `{order_number, status}`; on `INVALID_ACTOR` returns 400 `{error:'INVALID_ACTOR'}`; on illegal transition returns 422
- [x] Create `src/server/routes/sse.ts`: `GET /sse/staff` and `GET /sse/tables/:id` — subscribe `res` to the matching channel; seed a `HELLO` test event on subscribe (for the walking-skeleton SSE spec)
- [x] Create `src/server/index.ts`: Express app; `express.json()`; mount all routes; serve built SPA with `res.sendFile('index.html', { root: distDir })` (never absolute path); `seedIfEmpty()` on startup; listen on `PORT` (default 3000)

*Traces: FR1.3 (place order endpoint), FR1.6 (ORDER_PLACED), FR1.7 (cancel via transition), FR2.3 (live updates), FR2.4–FR2.6 (transitions), FR5.1 (one-command start), FR5.2 (seed)*

### Step 10 — API: tests + Playwright E2E skeleton
- [x] Create `src/server/__tests__/api.test.ts` using `supertest` (add to devDeps)
- [x] Test: `GET /api/menu` returns `{categories, items}` with the seeded data
- [x] Test: `POST /api/tables/1/orders` with valid body returns 201 and an `order_number`
- [x] Test: `POST /api/tables/1/orders` with same `placement_key` and same table returns same `order_number` (idempotency)
- [x] Test: `POST /api/tables/1/orders` with same `placement_key` but different table returns a different `order_number`
- [x] Test: `POST /api/orders/<number>/transition` with `{status:'Preparing', by:'staff'}` returns 200
- [x] Test: `POST /api/orders/<number>/transition` with `{status:'Completed', by:'diner'}` returns 400 `INVALID_ACTOR`
- [x] Run `npx vitest run --reporter=verbose src/server/__tests__/api.test.ts`
- [x] Update `e2e/u1-walking-skeleton/skeleton.spec.ts` with full Playwright spec:
  - Opens `/table/5` — page title or heading visible
  - Opens `/staff` — page loads without error
  - Connects `EventSource` to `/sse/tables/5` — receives an event within 2 seconds
- [ ] Run `npx playwright test e2e/u1-walking-skeleton/skeleton.spec.ts --project=chromium` — awaiting Playwright install permission

*Traces: FR5.1 (startup), FR5.2 (seed), FR1.3 (place order), NFR5 (idempotency), NFR1 (SSE latency)*

### Step 11 — Frontend behavior: implement (React SPA shell)
- [x] Create `src/client/main.tsx`: renders `<App />` into `#root`
- [x] Create `src/client/App.tsx`: `<BrowserRouter>` with routes `/table/:id` → `<TableView />` and `/staff` → `<StaffView />`; dark-theme CSS variables on `:root`
- [x] Create `src/client/views/TableView.tsx`: reads `:id` param; renders "Table {id}" heading + three bottom-tab-bar placeholder tabs (Menu, Cart, My orders) — real screens are U2's work; add `data-testid` on each tab
- [x] Create `src/client/views/StaffView.tsx`: renders "Kitchen" heading + placeholder content; `data-testid="staff-view"`
- [x] Create `src/client/index.html`: Vite entry point with `<div id="root">`
- [x] Run `npm run build` to verify Vite bundles without errors

*Traces: US8.1 (FR5.1 — SPA shell, routing), US1.1 (tab bar placeholder for U2), US5.1 (staff view placeholder for U3)*

### Step 12 — Frontend behavior: tests (mockup-match spec)
- [x] Create `e2e/u1-walking-skeleton/mockup-match.spec.ts`
  - Verifies `/table/5` renders the bottom-tab-bar placeholder (data-testid="tab-bar")
  - Verifies `/staff` renders the staff view (data-testid="staff-view")
  - Saves screenshots to `test-results/mockup-match/u1-walking-skeleton/`
  - Notes: refined screen mockups (Menu, Cart, My orders, Kitchen Board, Table Bill) are owned by U2–U4; this spec captures the shell only
- [ ] Run `npx playwright test e2e/u1-walking-skeleton/mockup-match.spec.ts --project=chromium` — awaiting Playwright install permission

*Traces: FR5.1 (SPA routing verified), NFR5 (accessibility landmark — tab bar in DOM)*

### Step 13 — Environment and build configuration
- [x] Add `.env.example`: `PORT=3000`, `E2E_PORT=3100`, `DB_FILE=table-order.db`
- [x] Add `.gitignore` entries for `dist/`, `node_modules/`, `*.db`, `test-results/`, `coverage/` (if not already present — the existing `.gitignore` is the person's; only add if the work cannot proceed without it)
- [x] Add `npm run start` script: `tsx src/server/index.ts`
- [x] Verify `npm install && npm start` starts the app on `http://localhost:3000`
- [ ] Run full verification: `npm test && npm run test:e2e` — unit tests pass (27/27); E2E awaiting Playwright install permission

*Traces: FR5.1, FR5.2*

### Step 14 — Documentation and traceability
- [x] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u1-walking-skeleton/code-generation/code-summary.md`
- [x] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u1-walking-skeleton/code-generation/traceability.json` via `aidlc engine sensor-traceability`
- [x] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u1-walking-skeleton/code-generation/source-manifest.json`

---

## Story-to-step traceability

| User Story | Plan Steps |
|---|---|
| US8.1 — One-command startup | 1, 9, 11, 13 |
| US1.1 — Browse menu (shell) | 11 |
| US1.3 — Place order | 5, 6, 9, 10 |
| US1.7 — Cancel order | 5, 6, 9, 10 |
| US3.1 — Live status updates | 7, 8, 9, 10 |
| US4.1 — TABLE_CLOSED reset | 7 (SSE channel infrastructure) |
| US5.1 — Staff view shell | 11 |
| US5.3 — Live order arrival | 7, 8, 9 |
| US6.1 — Transition Pending→Preparing | 5, 6, 9, 10 |
| US6.2 — Transition Preparing→Completed | 5, 6, 9, 10 |
| US6.3 — Mark item sold out | 5 (menuRepo availability flag) |
