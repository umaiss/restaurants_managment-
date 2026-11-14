# Code Quality Assessment: table-order

Assessed by reading the code at commit `49b31b1`. No tests, builds or type checks were run in this scan; figures quoted from the README are labelled as such.

## Summary

| Area | Rating | Basis |
|---|---|---|
| Naming clarity | good | Domain words throughout (`placeOrderAtTable`, `markStationDone`, `decideFloorState`); files named for what they do |
| Function size | fair | Server functions are mostly short; `placeOrderInTransaction` (~210 lines), `getSales` (~100) and the large diner screens are long |
| Error handling | good | Every route catches, maps known codes to the envelope and logs unknown errors as 500; background jobs never throw; client reads keep the last good data and show a retry |
| Test presence | good | Every server module and nearly every client component has tests; every Unit has browser specs and a mockup-match spec |
| Duplication | fair | Two error-mapping styles; repeated money and time formatters; client and server redeclare constants and response types |
| Dead code | fair | A guarded 501 stub route and an unused placeholder component |

## Tests

- **Unit and integration**: Vitest, server in the node environment, client in jsdom, isolated forks. README reports 1,485 tests and about 94.6% line coverage (`coverage/coverage-summary.json`). No coverage threshold is set in `vitest.config.ts`; the project rule says thresholds are never lowered, and the org default for this scope type is an 80% line floor
- **Browser**: Playwright, one folder per Unit, `build-and-test/` for whole-journey specs (keyboard-only journeys, live-update timing, motion, receipt, ring). README reports 170 Chromium tests passing and 212 Chrome and WebKit runs (2 skipped on purpose). Specs share one server and run with one worker
- **Helpers**: server (`requestAsStaff`, `freshApp`, `makeClosedVisit`, `localIso`, `localSqlite`, `addRating`) and browser (`signInAsStaff`, order, transition, special, call, close, rate, presence helpers) make new tests cheap
- **Strengths**: tests use both stored time formats and the server-local day; regression tests are named "regression: ..."; design tests check contrast, token parity, reduced motion and the absence of colour literals
- **Gaps**: no load or performance tests (relevant to queries that scan all history); time-zone behaviour is tested on the machine's own zone only

## Linting, formatting, type safety

- No ESLint, Prettier or other linter config in the repo, yet 7 `eslint-disable` comments exist (mostly `react-hooks/exhaustive-deps`)
- TypeScript is strict; `npx tsc --noEmit` is the documented type check. `as any` appears only in tests (`sse.test.ts`, `routeOrder.test.ts`)
- Server code casts `better-sqlite3` rows with `as` types; there is no runtime schema validation of database rows

## CI/CD

None. No pipeline files, no Dockerfile, no deployment scripts. Verification is `npm test && npm run test:e2e` run by hand (by the AI in this workflow, per project rules).

## Documentation

- README covers setup, settings, tests, layout, how the app was built and known limits
- Every source file opens with a comment naming the business rules (BR/FR ids from the AI-DLC records) it implements, and non-obvious choices are explained in place (for example the seed's non-required Size group, the dot-folder `sendFile` rule)
- `.env.example` documents every setting
- `unit-test-instructions.md` at the root is a leftover note from the parallel U2 build

## Security observations

- **Good**: PIN is never written in code or logs (except the one-time print of a random PIN); constant-time comparison; lockout per connection address (not a client header); 128-bit session tokens; HttpOnly, SameSite=Strict cookie; strict id parsing; bounded request sizes on open routes; caps on presence memory; no secrets in the repo
- **By design, to note**: plain HTTP (cookie not `Secure`) on the local network; one shared PIN with no roles, so every signed-in device can see sales and money; all diner routes are open to anyone who knows a table number; sessions and lockouts live in memory and reset on restart
- **For the Manager TV wall**: an unattended screen holding a staff session shows staff-only data and keeps a session that can also change orders and close tables; the takings figure is visible to anyone in view of the screen unless hidden

## Technical debt

| Item | Location | Impact |
|---|---|---|
| Dead 501 stub for `/api/staff/qr/:table` | `src/server/routes/staff-qr.ts`, `stubs.ts`; asserted by `foundation/guard.test.ts`, `foundation/routeOrder.test.ts` | Confusing API surface |
| Unused `PagePlaceholder` | `src/client/staff/pages/PagePlaceholder.tsx` | Clutter |
| Two error-mapping styles and two status maps | `routes/orders.ts`, `routes/billing.ts` vs `errors.ts`, `routes/u7/errors.ts` | Inconsistent responses are easy to introduce |
| Sales and ratings scan all history on each call | `src/server/routes/u7/sales.ts:62, 89, 128, 179` | Cost grows with every closed visit; multiplied by any screen that re-reads on each event |
| One request per table to load the Kitchen Board | `src/client/hooks/useBoardOrders.ts:131` | Up to 50 requests on load and each reconnect |
| Mixed stored time formats | v1 rows vs v2 rows in `orders`, `visits` | Every reader must parse; `billingRepo` sorts `placed_at` as text (`billingRepo.ts:102`, `144`) |
| Long screens styled inline, overridden by `!important` attribute selectors | `src/client/screens/diner/*`, `src/client/design/screens.css` | Restyling is fragile |
| Duplicate formatters | `formatPrice` (diner screens), `formatMoney` and `formatPlacedTime` (`components/staff/money.ts`), `formatTime` (`OrderCard.tsx`) | Inconsistent output risk |
| Constants and types declared on both sides | stations, floor states, response shapes | Contract drift risk |
| Kitchen Board header uses the table id, not its label | `src/client/screens/staff/KitchenBoardScreen.tsx:244` | Renamed tables show their number only |
| `--ease-spring` defined twice | `design/tokens.css`, `index.css` | Minor |
| `tsx` in devDependencies but used by `npm start` | `package.json` | Production install without dev dependencies cannot start |
| No linter config or CI | repo root | Lint-disable comments are unenforced; nothing runs the suite automatically |

## Quality notes for the active work

- Follow the existing patterns: a route module with try/catch and `sendIfAppError`, a domain function that reads with parsed times, `useLiveRead` on the client, tokens only in styles, `data-testid` on everything a test touches, a Unit folder under `e2e/` with `mockup-match.spec.ts`
- A day-bounded query for today's figures would avoid adding another all-history scan
- Changing `StaffShell.test.tsx`, `liveHooksV2.test.ts` or the route-order tests is expected if the nav, event names or route owners change; list each under "v1 tests changed" as the project rules require
