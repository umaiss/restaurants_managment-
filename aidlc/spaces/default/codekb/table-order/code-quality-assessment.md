# Code Quality Assessment

Read-only assessment; no test, build or app was run. Test figures come from the stale `test-results/unit.json` and `coverage/coverage-summary.json` left from v1 sign-off.

## Ratings (good / fair / poor)

| Area | Rating | Evidence |
|---|---|---|
| Naming clarity | good | descriptive names, snake_case on the wire, `data-testid` everywhere |
| Function size | fair | repositories and hooks are small; large React files: `MenuScreen` 497, `MyOrdersScreen` 375, `CartScreen` 370, `TableView` 336 lines |
| Error handling | good | uniform error envelope, code-to-status mapping, guarded fetches, rollback on failed toggles; `placeOrder` is not wrapped in a transaction |
| Test presence | good | every server module, hook, screen and component has a test file; e2e per unit |
| Duplication | fair | `OrderStatus`/`Order`/`OrderLine` types, status icon and colour maps and `formatPrice` repeated across several client files |
| Dead code | good | `TABLE_STATUS_CHANGED` listener never fires; `tables.status` column unused; `tableRepo.openVisit` and `closeVisit` appear unused by routes; `getOrderByNumber` has no route caller |

## Testing

- **Unit and component**: 322 tests in 77 suites, all passing at the last recorded run. Server tests use Supertest and `:memory:` SQLite; client tests use jsdom and Testing Library. `pool: 'forks'` with isolation keeps module singletons (db, SSE hub) separate per file.
- **Coverage (last recorded)**: lines 92.95% (5120 of 5508), functions 84.55%, branches 86.2%. No threshold configured in `vitest.config.ts`. The team rule: never lower a coverage threshold or a timed-test limit.
- **E2E**: about 50 Playwright tests in 5 folders, one worker (specs share a server and in-memory database), plus a Chrome and WebKit config. Includes keyboard-only journey, live-update timing, motion and reduced-motion checks, board-to-bill link.
- **Mockup match**: each unit has a spec comparing app screens with the v1 refined mockups (text and screenshot pairs in `test-results/mockup-match/<unit>/`). These bind many literal strings and layouts (see `api-documentation.md`, Test Hooks).
- **Gaps**: no test for migrating an existing database file (there is no migration); no load or concurrency test of SSE beyond unit tests; no accessibility scanner (axe) though focus, keyboard and motion are tested by hand-written specs; no visual regression baseline (screenshots are saved, not compared automatically).
- **Fragile points for v2**: `db.test.ts` pins the seed counts; e2e specs assume fixed seeded tables and items and share one database (leftover orders make later specs fail, hence `resetTable`); mockup-match specs fail on any wording change of covered text.

## Linting, Types, CI

- No ESLint, Prettier or other formatter or linter; no `typecheck` script (strict `tsc` settings exist, and Vite and Vitest do not type check).
- No CI pipeline and no pre-commit hooks in the repo.
- No suppression comments (`eslint-disable`, `@ts-ignore`) and no TODO, FIXME or HACK markers found.

## Documentation

No project README. `.env.example` documents the env vars. Source comments are plentiful and explain contracts and races. `unit-test-instructions.md` is a U2-only note. The v1 record under `aidlc/` (not scanned here) holds the design documents.

## Security Observations

| Finding | Where | Impact for v2 |
|---|---|---|
| No authentication or authorization on any route or on the `staff` SSE channel | `src/server/index.ts`, all routers | Staff PIN must add a server-side check; hiding screens in the client is not enough |
| Actor `by` is trusted from the request body | `POST /api/orders/:n/transition` | any client can act as staff; PIN design should derive the actor from a verified session |
| No rate limiting | all routes | PIN entry needs attempt limiting |
| Inputs validated at the boundary (ids, quantities, booleans, placement key) | routes | good base to extend; free-text fields (notes, allergies, ratings) will need length limits and escaping (React escapes output) |
| SQL uses prepared statements with bound parameters everywhere | repositories | no injection found |
| No secrets in code; config from env | `db.ts`, `index.ts` | a PIN or QR signing secret must also come from env, never from source (team rule) |
| Cart and table state in `localStorage` | `useCart.ts` | harmless data; keyed by table id |

## Technical Debt (ranked for v2 impact)

1. **No migration mechanism** while v2 must change an existing database additively (schema applied with `IF NOT EXISTS`; `tables.status` unused).
2. **Inline styles with literal colours** (183 inline style blocks, about 143 literal colour values in TSX) and a dark-only token file: blocks a clean design system and Dark mode.
3. **No staff auth**, trusted actor.
4. **Hard-coded 10 tables** on the client and no tables-list endpoint (affects Live floor map, QR codes, board loading with 10 requests).
5. **Order model is minimal**: no line options or notes, no station, no preparation or ready timestamps, no per-line status; fixed 4-state status machine used across SQL, server, hooks and tests.
6. **Visit history unused**: closed visits exist but no read API; mixed timestamp formats (`datetime('now')` UTC text vs ISO `Z` strings) complicate sales-by-period queries.
7. **Duplicated client types and helpers**, no shared types module.
8. **Several SSE connections per staff page** (one per hook instance) and `useStaffSSE` has no custom backoff (browser default plus server `retry: 2000`).
9. **Event publish is outside the database transaction**; fine on one node, a risk if publishing ever fails mid-request (the response is still sent).
10. **No lint, type-check script or CI**; no README.
11. **Misleading comment** in `orderRepo.placeOrder` ("return 409") vs route behaviour (200 for a repeated key).
