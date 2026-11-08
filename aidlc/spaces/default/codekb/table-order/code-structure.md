# Code Structure

## Repository Layout (project-owned files only)

```
table-order/
  package.json, package-lock.json      npm scripts and dependencies (ESM)
  index.html                           Vite entry page, mounts #root, loads src/client/main.tsx
  vite.config.ts                       React plugin, build to dist/, dev proxy /api and /sse to :3000
  vitest.config.ts                     unit-test config (node + jsdom, v8 coverage)
  playwright.config.ts                 e2e config (Chromium, one worker, in-memory DB server)
  playwright.cross-browser.config.ts   Chrome + WebKit run, mockup-match excluded
  tsconfig.json                        strict, noEmit, bundler resolution, jsx react-jsx
  .env.example                         PORT, E2E_PORT, DB_FILE
  unit-test-instructions.md            U2 scoped test command note
  aidlc.settings.json                  AI-DLC model preset (framework file, not app code)
  src/
    server/
      index.ts                         Express app, routers, static + SPA catch-all, listen
      db.ts                            SQLite singleton, schema, seed, visit and order-number helpers
      sse.ts                           channel hub: subscribe, publish, ring buffer, keep-alive
      routes/   menu.ts orders.ts billing.ts sse.ts tableId.ts
      repositories/   menuRepo.ts orderRepo.ts billingRepo.ts tableRepo.ts
      __tests__/    10 Vitest files
    client/
      main.tsx, App.tsx, index.css
      views/        TableView.tsx StaffView.tsx
      screens/diner/   MenuScreen.tsx CartScreen.tsx MyOrdersScreen.tsx
      screens/staff/   KitchenBoardScreen.tsx TableBillScreen.tsx
      components/      ConfirmModal.tsx
      components/diner/   DinerTabBar.tsx TableClosedTakeover.tsx
      components/staff/   OrderCard BillOrderCard BillTotal CloseTableSection MenuAvailabilityPanel NewHighlight money.ts
      hooks/        useTableSSE useStaffSSE useCart useBoardOrders useBill useMenuAvailability
      (each folder has an __tests__/ folder)
    test-setup.ts, test-types.d.ts     jest-dom matchers for Vitest
  e2e/
    u1-walking-skeleton/   skeleton.spec.ts mockup-match.spec.ts
    u2-diner-screens/      diner.spec.ts mockup-match.spec.ts
    u3-kitchen-board/      kitchen-board.spec.ts mockup-match.spec.ts
    u4-bill-and-close/     bill-and-close.spec.ts mockup-match.spec.ts
    build-and-test/        board-bill-link, keyboard-journey, live-update-timing, motion specs, helpers.ts
```

Generated or local (not source, ignored by `.gitignore`): `node_modules/`, `dist/`, `coverage/`, `test-results/`, `playwright-report/`, `*.db`, `*.db-wal`, `*.db-shm`, `.aidlc/worktrees/`.

## File Classification

| Category | Files |
|---|---|
| Model/Entity | interfaces inside repositories (`OrderLine`, `OrderWithItems`, `Bill`, `BillOrder`, `TableStatus`, `MenuItem`, `Category`) and inside hooks (`Order`, `CartItem`, `Bill`); SQL tables in `db.ts` |
| Controller/Handler | `routes/orders.ts`, `routes/billing.ts`, `routes/menu.ts`, `routes/sse.ts` |
| Service/UseCase | rules live in repositories: `orderRepo.placeOrder`, `transitionOrder`, `billingRepo.buildBill`, `closeTable` |
| Repository/DAO | `repositories/*.ts`, helper queries in `db.ts` |
| Utility/Helper | `routes/tableId.ts` (id parsers, 404 helpers), `components/staff/money.ts`, `sse.ts` (hub) |
| Configuration | `vite.config.ts`, `vitest.config.ts`, `playwright*.ts`, `tsconfig.json`, `.env.example`, env reads in `db.ts` and `index.ts` |
| Middleware | only `express.json()` and `express.static()`; no auth, logging or error middleware |
| Test | `src/**/__tests__/*`, `e2e/**`, `src/test-setup.ts` |
| Migration | none |
| Static/Asset | `index.html`, `src/client/index.css`; menu images are emoji strings, no image files |

## Code Patterns

- **Server module style**: ESM TypeScript with `.js` extensions on relative imports; `export default router` per router; repository functions are plain exported functions (no classes except error classes `OrderError` and `BillingError` carrying a `code`).
- **Error handling**: routes map error `code` to HTTP status and always answer `{ error: { code, message, details? } }`; unknown errors log `console.error` and answer 500 `INTERNAL_ERROR`.
- **Validation at the boundary**: `parseTableId`/`parseOrderNumber` accept only `^[1-9]\d*$` (so `5abc` is 404); order lines are validated one by one in the route; quantities are also checked in the repository.
- **Transactions**: only `closeTable` uses `db.transaction(...).immediate()`. `placeOrder` runs several statements without a transaction (order row, then its lines).
- **Events after writes**: routes call `publish(...)` after the repository succeeds.
- **Client hooks**: every live consumer keeps a `processedSeqRef` and loops over `events` filtered by `seq`; reconnect detection compares `connected` with a `wasConnectedRef`; fetch responses are guarded with request counters.
- **Client styling**: inline style objects with `var(--token, fallback)`; shared utility classes in `index.css`; `data-testid` on every element tests touch (see `api-documentation.md` for the list).
- **Tests**: server tests set `process.env.DB_FILE = ':memory:'` before imports and call `resetDb()`; client tests use jsdom and Testing Library; e2e specs use seeded tables and `resetTable` in clean-up.
- **Naming**: camelCase TS identifiers, PascalCase React components, snake_case for API/JSON/SQL fields (`price_cents`, `order_number`, `table_id`).

## Import Graph (summary)

- `index.ts` -> `db`, `routes/{menu,orders,billing,sse}`.
- `routes/orders` -> `orderRepo`, `tableRepo`, `db` (`getCurrentVisit`), `sse`, `tableId`. `routes/billing` -> `billingRepo`, `sse`, `tableId`. `routes/menu` -> `menuRepo`, `sse`, `db`. `routes/sse` -> `sse`, `tableId`.
- `billingRepo` -> `db`, `orderRepo`, `tableRepo`. `orderRepo`, `tableRepo`, `menuRepo` -> `db`.
- No circular imports found. `orderRepo` and `tableRepo` both import from `db` only.
- Client: `App` -> `TableView`, `StaffView`; `TableView` -> `useTableSSE`, `useCart`, `DinerTabBar`, `TableClosedTakeover`, the three diner screens; `KitchenBoardScreen` -> `useBoardOrders` -> `useStaffSSE`; `TableBillScreen` -> `useBill` -> `useStaffSSE`, `BillOrderCard`, `BillTotal`, `CloseTableSection`, `ConfirmModal`, `money`. `useBill` imports a type from `useBoardOrders`.
