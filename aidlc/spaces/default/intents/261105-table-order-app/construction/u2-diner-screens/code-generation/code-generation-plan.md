# Code Generation Plan — U2 `u2-diner-screens`

## Summary

- Builds: Diner tab-bar app (Menu, Cart, My Orders screens) with cart management, SSE live updates, and TABLE_CLOSED takeover
- Touches: `src/client/screens/diner/`, `src/client/components/diner/`, `src/client/hooks/`, routing in `src/client/views/TableView.tsx`, `e2e/u2-diner-screens/`
- Tests: ~45 unit/component tests (vitest + React Testing Library) + 6 Playwright E2E flows + 1 mockup-match spec

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

**Step 1** — Verify walking skeleton foundations [US1.1, US2.1, US3.1, US4.1]
- [x] Confirm U1 provides: `/api/menu`, `POST /api/orders`, `GET /api/orders`, `/sse/tables/:id`, `TableView` shell, `ConfirmModal` in `src/client/components/ConfirmModal.tsx`
- [x] Note any missing U1 exports and add minimal stubs if needed (without modifying U1 files)

**Step 2** — Bootstrap unit-scoped test runner
- [x] Confirm vitest is configured; add `u2-diner-screens` test pattern to `vitest.config.ts` include list if needed
- [x] Verify unit-scoped command runs: `vitest run --reporter=json --outputFile=test-results/unit.json src/client/screens/diner src/client/hooks/useTableSSE.ts src/client/hooks/useCart.ts src/client/components/diner`
- [x] Record exact command in `unit-test-instructions.md`

**Step 3** — Implement `useTableSSE` hook [FR4.1, FR4.2] — `src/client/hooks/useTableSSE.ts`
- [x] `EventSource` to `/sse/tables/:id` with `Last-Event-ID` replay header
- [x] Exponential backoff reconnect (1 s → 2 s → 4 s → cap 30 s)
- [x] Returns `{ lastEvent: { type: string; data: unknown } | null, connected: boolean }`
- [x] `disconnect()` on unmount

**Step 4** — Test `useTableSSE` (5–8 tests)
- [x] `src/client/hooks/__tests__/useTableSSE.test.ts`
- [x] Happy path: connects, receives event, updates `lastEvent`
- [x] Disconnects on unmount
- [x] Reconnects on error with backoff
- [x] `connected` toggles correctly
- [x] Run vitest scoped to this file; confirm green

**Step 5** — Implement `useCart` hook [US1.1, US1.2, FR1.1] — `src/client/hooks/useCart.ts`
- [x] Reads/writes `localStorage` key `cart:table:<tableId>`
- [x] `addItem(menuItemId, name, priceCents, quantity)`, `removeItem`, `updateQuantity`, `clearCart`
- [x] `placement_key` generated once on first add tap (not on render), stored in `sessionStorage key cart-placement-key:<tableId>`; reused on retries
- [x] Returns `{ items, totalCents, placementKey, addItem, removeItem, updateQuantity, clearCart }`

**Step 6** — Test `useCart` (5–8 tests)
- [x] `src/client/hooks/__tests__/useCart.test.ts`
- [x] Add item persists to localStorage
- [x] Remove item updates state and storage
- [x] `placement_key` generated on first add, not before
- [x] `clearCart` removes all items
- [x] Loads existing cart from localStorage on mount
- [x] Run vitest scoped; confirm green

**Step 7** — Implement `MenuScreen` [US1.1, US1.2, FR1.1, FR1.2] — `src/client/screens/diner/MenuScreen.tsx`
- [x] `GET /api/menu` on mount; loading shimmer, error state with Retry
- [x] Category pill bar (Starters, Mains, Desserts, Drinks) — sticky at top, smooth scroll-to-section, active pill filled when section is on screen
- [x] `MenuItem` card: image left, name + description + price, `+ Add` pill (32 px visual / 44 px touch, `data-testid="add-item-<id>"`)
- [x] Tapping `+ Add` calls `addItem` from `useCart`; pill shows count badge when item in cart

**Step 8** — Test `MenuScreen` (5–8 tests)
- [x] `src/client/screens/diner/__tests__/MenuScreen.test.tsx`
- [x] Renders menu items from API response
- [x] Shows loading shimmer while fetching
- [x] Shows error + Retry on fetch failure
- [x] Category pills render; active pill highlights on scroll
- [x] `+ Add` tap calls `addItem`
- [x] Run vitest scoped; confirm green

**Step 9** — Implement `CartScreen` [US2.1, US2.2, US2.3, FR1.3, FR1.4, FR1.5] — `src/client/screens/diner/CartScreen.tsx`
- [x] Lists `useCart` items: name, quantity controls (`−`/`+`), price each, subtotal
- [x] `StickyCartSummary` bar just above tab bar: "View cart (N)" when items > 0
- [x] `Place order` button (above tab bar): disabled when cart empty, shows `ConfirmModal` on tap
- [x] On confirm: `POST /api/orders` with `{ tableId, visitId, placementKey, lines }`, spinner while posting
- [x] On success: `clearCart`, show "Order placed! #N" banner
- [x] On `DUPLICATE_PLACEMENT_KEY` (409): show "Order already placed" (idempotency)
- [x] On other error: show inline error banner, re-enable button

**Step 10** — Test `CartScreen` (5–8 tests)
- [x] `src/client/screens/diner/__tests__/CartScreen.test.tsx`
- [x] Empty state: Place order disabled
- [x] With items: shows lines, subtotal
- [x] Place order tap opens ConfirmModal
- [x] On POST success: cart cleared, success banner shown
- [x] On 409 DUPLICATE_PLACEMENT_KEY: idempotency message shown
- [x] Run vitest scoped; confirm green

**Step 11** — Implement `MyOrdersScreen` [US3.1, US3.2, FR1.6, FR1.7, FR1.8] — `src/client/screens/diner/MyOrdersScreen.tsx`
- [x] `GET /api/orders?tableId=&visitId=` on mount and on `ORDER_STATUS_CHANGED` SSE event
- [x] Lists non-cancelled orders: `#N`, status pill (icon + word), placed time, line items
- [x] Loading shimmer; "No orders yet" empty state
- [x] Status pills: Pending (clock), Preparing (flame), Completed (tick)

**Step 12** — Test `MyOrdersScreen` (5–8 tests)
- [x] `src/client/screens/diner/__tests__/MyOrdersScreen.test.tsx`
- [x] Renders orders from API
- [x] Shows correct status pill per status
- [x] Empty state when no orders
- [x] Loading state while fetching
- [x] Re-fetches on SSE ORDER_STATUS_CHANGED
- [x] Run vitest scoped; confirm green

**Step 13** — Implement `DinerTabBar` and `TableClosedTakeover` [FR3.6, FR1.9]
- [x] `src/client/components/diner/DinerTabBar.tsx`: fixed bottom, three tabs (Menu / Cart / Orders); Cart tab shows item count badge; active tab highlighted; `data-testid` on each tab
- [x] `src/client/components/diner/TableClosedTakeover.tsx`: full-screen overlay shown when `TABLE_CLOSED` SSE received; clears cart; "This table has been closed. Thank you!" message; `data-testid="table-closed-takeover"`

**Step 14** — Test `DinerTabBar` and `TableClosedTakeover` (5–8 tests)
- [x] `src/client/components/diner/__tests__/DinerTabBar.test.tsx`: active tab highlighted, cart badge shows count
- [x] `src/client/components/diner/__tests__/TableClosedTakeover.test.tsx`: renders when shown; clears cart
- [x] Run vitest scoped; confirm green

**Step 15** — Wire diner routing in `TableView.tsx`
- [x] Update `src/client/views/TableView.tsx` to render `DinerTabBar` + route between `MenuScreen`, `CartScreen`, `MyOrdersScreen`; show `TableClosedTakeover` overlay when `TABLE_CLOSED` received from `useTableSSE`
- [x] Pass `tableId` and `visitId` from URL params

**Step 16** — Playwright E2E tests [US1.1–US4.1]
- [x] `e2e/u2-diner-screens/diner.spec.ts`
- [x] Flow 1: Browse menu → add item → cart badge updates
- [x] Flow 2: View cart → place order → success banner → orders appear in My Orders
- [x] Flow 3: Duplicate placement_key → idempotency message
- [x] Flow 4: My Orders shows Pending → Preparing → Completed status changes
- [x] Flow 5: TABLE_CLOSED event → takeover overlay shown, cart cleared
- [x] Flow 6: Keyboard-only navigation through tab bar and place order

**Step 17** — Playwright mockup-match spec
- [x] `e2e/u2-diner-screens/mockup-match.spec.ts`
- [x] Set up diner table session with menu items loaded
- [x] Check MenuScreen: category pills, item cards, `+ Add` buttons, sticky pill bar
- [x] Check CartScreen: cart lines, Place order button, ConfirmModal
- [x] Check MyOrdersScreen: order cards, status pills
- [x] Save screenshots to `test-results/mockup-match/u2-diner-screens/`
- [x] Bill screen (U4 scope) left out; listed in spec comment

**Step 18** — `source-manifest.json` and `traceability.json`
- [x] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u2-diner-screens/code-generation/source-manifest.json` listing every file created/modified
- [x] Run `aidlc engine sensor-traceability --stage code-generation --output-path aidlc/spaces/default/intents/261105-table-order-app/construction/u2-diner-screens/code-generation/traceability.json --write-upstream` and fill in OK targets
