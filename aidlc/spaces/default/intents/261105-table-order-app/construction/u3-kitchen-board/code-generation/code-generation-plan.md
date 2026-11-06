# Code Generation Plan — U3 `u3-kitchen-board`

## Summary

- Builds: Kitchen Board staff screen at `/staff` with live order cards, new-order highlight, and menu availability panel
- Touches: `src/client/screens/staff/KitchenBoardScreen.tsx`, `src/client/components/staff/`, `src/client/hooks/useBoardOrders.ts`, `src/client/hooks/useMenuAvailability.ts`, `src/client/views/StaffView.tsx`, `e2e/u3-kitchen-board/`
- Tests: ~40 unit/component tests (vitest + React Testing Library) + 5 Playwright E2E flows + 1 mockup-match spec

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

**Step 0** — First step: fixes for the four Minor findings of the walking skeleton's review (replayed after Build and Test's loop-back; the team's rule is that review findings are fixed before the work moves on) — `src/server/sse.ts`, `src/server/routes/orders.ts`, `src/server/routes/sse.ts`, `src/server/__tests__/sse.test.ts`, `src/server/__tests__/api.test.ts`
- [ ] Keep-alive: the live stream writes a comment line (`: keep-alive` followed by a blank line) to every subscriber about every 20 seconds so an idle connection is not dropped silently; the timer is stopped when the last subscriber leaves and never keeps the process or the tests alive
- [ ] Event ids across a restart: the id counter starts from the server's start time (milliseconds) instead of 0, so ids keep rising after a restart and a client reconnecting with an old `Last-Event-ID` is never told to skip newer events; `_resetForTest()` still resets it to 0 so the existing tests keep their ids
- [ ] Table id: a table id in a URL must be only digits; `5abc` and similar answer 404 `UNKNOWN_TABLE` in the error envelope on the order routes and the stream route, instead of being read as table 5
- [ ] Tests: a keep-alive test (fake timers), an id-after-restart test, and a table-id test (`5abc`, `0`, `-1`, `1e1`); include one named "regression: a table id with trailing text is refused, not read as the number in front of it"; confirm the existing SSE and API tests are green
- [ ] Bookkeeping, not code: the walking skeleton's plan prose still says the transition body field is `status` while the code and contract use `to`, and four of its steps are unticked although their work exists and its browser specs pass. The skeleton's plan is not edited (it is approved); this Unit's `code-summary.md` records both so the record is straight

**Step 1** — Verify walking skeleton foundations [US5.1, US6.1]
- [x] Confirm U1 provides: `GET /api/orders` (all tables), `PATCH /api/orders/:id/status`, `GET /api/menu`, `PATCH /api/menu/:id/availability`, `/sse/staff`, `StaffView` shell
- [x] Note any missing U1 endpoints and add minimal stubs if needed without modifying U1 source

**Step 2** — Bootstrap unit-scoped test runner
- [x] Confirm vitest is configured; verify unit-scoped command runs: `vitest run --reporter=json --outputFile=test-results/unit.json src/client/screens/staff src/client/hooks/useBoardOrders.ts src/client/hooks/useMenuAvailability.ts src/client/components/staff`
- [x] Record exact command in `unit-test-instructions.md`

**Step 3** — Implement `useBoardOrders` hook [US5.1, US5.2, FR2.1, FR2.2, FR2.4] — `src/client/hooks/useBoardOrders.ts`
- [x] On mount: fetch orders for each known table (up to 10 tables via `GET /api/orders?tableId=<n>`) in parallel; build `Map<tableId, Order[]>`
- [x] Subscribe to `/sse/staff` EventSource
- [x] On `ORDER_PLACED`: add new order to map; mark status `Pending` (highlighted as "★ New")
- [x] On `ORDER_STATUS_CHANGED`: update order status in map; clear new-highlight when transitioning Pending → Preparing
- [x] On `TABLE_CLOSED`: remove all orders for that table from map
- [x] Returns `{ ordersByTable: Map<number, Order[]>, loading: boolean }`

**Step 4** — Test `useBoardOrders` (5–8 tests)
- [x] `src/client/hooks/__tests__/useBoardOrders.test.ts`
- [x] On mount: fetches orders for tables and populates map
- [x] `ORDER_PLACED` SSE adds order to correct table slot
- [x] `ORDER_STATUS_CHANGED` updates status; Pending→Preparing clears new-highlight
- [x] `TABLE_CLOSED` removes all orders for that tableId
- [x] Loading is true before fetches resolve, false after
- [x] Run vitest scoped; confirm green

**Step 5** — Implement `useMenuAvailability` hook [US6.1, US6.2, US6.3, FR2.6, FR2.7] — `src/client/hooks/useMenuAvailability.ts`
- [x] `GET /api/menu` on mount for current availability state
- [x] `toggleAvailability(menuItemId)`: sends `PATCH /api/menu/:id/availability`; optimistic update, rolls back on error
- [x] On `MENU_AVAILABILITY_CHANGED` SSE: sync state from event payload
- [x] Returns `{ items: MenuItem[], toggleAvailability, loading }`

**Step 6** — Test `useMenuAvailability` (5–8 tests)
- [x] `src/client/hooks/__tests__/useMenuAvailability.test.ts`
- [x] Loads items from API on mount
- [x] `toggleAvailability` sends PATCH and updates local state
- [x] Rolls back on PATCH error
- [x] `MENU_AVAILABILITY_CHANGED` SSE syncs state
- [x] Run vitest scoped; confirm green

**Step 7** — Implement `NewHighlight` component [FR2.4] — `src/client/components/staff/NewHighlight.tsx`
- [x] Wraps content with accent ring + glow when `active` prop is `true`
- [x] Shows "★ New" label; ring/glow fades with `150 ms ease-out` on `active → false`
- [x] No animation when `prefers-reduced-motion: reduce`
- [x] `data-testid="new-highlight"`

**Step 8** — Test `NewHighlight` (5 tests)
- [x] `src/client/components/staff/__tests__/NewHighlight.test.tsx`
- [x] Renders "★ New" label when `active=true`
- [x] Does not render highlight when `active=false`
- [x] Applies correct CSS class for animation
- [x] Run vitest scoped; confirm green

**Step 9** — Implement `OrderCard` component [US5.1, US5.2, US5.3, FR2.1, FR2.2, FR2.3] — `src/client/components/staff/OrderCard.tsx`
- [x] Shows order number `#N`, status pill (icon + word per NFR5), placed timestamp
- [x] Lists line items (emoji, name, quantity)
- [x] Wraps in `NewHighlight` when order status is `Pending`
- [x] Action buttons: "Start preparing" (Pending → Preparing), "Mark complete" (Preparing → Completed); calls `PATCH /api/orders/:id/status`; button disabled while request in flight
- [x] `data-testid="order-card-<id>"`, `data-testid="btn-preparing-<id>"`, `data-testid="btn-complete-<id>"`

**Step 10** — Test `OrderCard` (5–8 tests)
- [x] `src/client/components/staff/__tests__/OrderCard.test.tsx`
- [x] Renders order number, status pill, line items
- [x] "Start preparing" button present for Pending orders; not for Preparing/Completed
- [x] "Mark complete" button present for Preparing orders
- [x] Button click sends PATCH and disables button while in flight
- [x] `NewHighlight` active for Pending, inactive for others
- [x] Run vitest scoped; confirm green

**Step 11** — Implement `MenuAvailabilityPanel` [US6.1–US6.3, FR2.6, FR2.7] — `src/client/components/staff/MenuAvailabilityPanel.tsx`
- [x] Lists all menu items with availability toggle (checkbox or toggle switch)
- [x] Calls `useMenuAvailability`'s `toggleAvailability` on change
- [x] Shows optimistic update immediately; reverts on error with error message
- [x] `data-testid="availability-toggle-<id>"`

**Step 12** — Test `MenuAvailabilityPanel` (5–8 tests)
- [x] `src/client/components/staff/__tests__/MenuAvailabilityPanel.test.tsx`
- [x] Renders items with correct availability state
- [x] Toggle calls `toggleAvailability`
- [x] Error state shown on failed toggle
- [x] Run vitest scoped; confirm green

**Step 13** — Implement `KitchenBoardScreen` [US5.1–US6.3, FR2.1–FR2.7] — `src/client/screens/staff/KitchenBoardScreen.tsx`
- [x] Uses `useBoardOrders` and `useMenuAvailability`
- [x] Renders table sections: each table with its orders as `OrderCard` components in placement order
- [x] "Table N →" link in each table card header navigating to `/staff/tables/:id` (U4 scope; link only)
- [x] `MenuAvailabilityPanel` in a side panel or collapsible section
- [x] Loading shimmer while `useBoardOrders` loads; empty state "No active orders"
- [x] `data-testid="kitchen-board"`, `data-testid="table-section-<id>"`

**Step 14** — Test `KitchenBoardScreen` (5–8 tests)
- [x] `src/client/screens/staff/__tests__/KitchenBoardScreen.test.tsx`
- [x] Renders table sections with order cards
- [x] Shows loading state
- [x] Shows empty state when no orders
- [x] "Table N →" links rendered correctly
- [x] Run vitest scoped; confirm green

**Step 15** — Wire staff routing in `StaffView.tsx`
- [x] Update `src/client/views/StaffView.tsx` to render `KitchenBoardScreen` at `/staff`
- [x] Add route `/staff/tables/:id` as a placeholder (empty shell; U4 builds `TableBillScreen`)

**Step 16** — Playwright E2E tests [US5.1–US6.3]
- [x] `e2e/u3-kitchen-board/kitchen-board.spec.ts`
- [x] Flow 1: Board loads with active orders; each order card shows correct status
- [x] Flow 2: "Start preparing" click transitions order to Preparing; button changes to "Mark complete"
- [x] Flow 3: "Mark complete" transitions to Completed; card no longer shows action buttons
- [x] Flow 4: New order SSE arrives → "★ New" highlight visible; transitions to Preparing → highlight clears
- [x] Flow 5: Toggle menu item availability; item shows unavailable state

**Step 17** — Playwright mockup-match spec
- [x] `e2e/u3-kitchen-board/mockup-match.spec.ts`
- [x] Seed board with one Pending and one Preparing order
- [x] Check: "★ New" highlight on Pending, action buttons present and labelled correctly, status pills correct
- [x] Check: `MenuAvailabilityPanel` renders all items with toggle controls
- [x] Save screenshots to `test-results/mockup-match/u3-kitchen-board/`
- [x] Table Bill link (U4 scope) noted in spec comment as outside this unit's comparison

**Step 17a** — Fix found by Build and Test (Loop-back 1): a table stays on the board until it is closed [FR2.2, FR3.1, FR3.3, FR3.5, NFR6] — `src/client/screens/staff/KitchenBoardScreen.tsx`, `src/client/hooks/useBoardOrders.ts`
- [ ] What went wrong: the board keeps a table only while one of its orders is Pending or Preparing. When the last open order is completed the table's card, and with it the "Table N →" link to the bill, leaves the board, so staff cannot open the bill to close the table from the screens
- [ ] New rule: a table is on the board while its current visit has any order (any status) and leaves it only when the table is closed (`TABLE_CLOSED`) or all its orders are gone. A table with no Pending or Preparing order shows its finished orders as they are (Completed, Cancelled), keeps the "Table N →" link, and shows a short line "No open orders. Open the bill to close this table." with `data-testid="table-ready-to-close-<id>"`
- [ ] The empty state "No open orders right now." stays for a board with no table at all
- [ ] Keep every other behaviour: new-order highlight only on Pending, buttons only on Pending and Preparing, loading shimmer, reconnect banner
- [ ] Note in `code-summary.md` that this reads FR2.2 ("a card per table with its open orders") as "a card per table with an open visit", and why
- [ ] Update `src/client/screens/staff/__tests__/KitchenBoardScreen.test.tsx` and `src/client/hooks/__tests__/useBoardOrders.test.ts` for the new rule, and add a unit test named "regression: a table with only completed orders stays on the board with its bill link until it is closed" that fails on the old filter
- [ ] Update `e2e/u3-kitchen-board/kitchen-board.spec.ts` Flow 3 so it expects the card to stay marked Completed; update `e2e/u3-kitchen-board/mockup-match.spec.ts` only if a checked word changed
- [ ] The two browser specs found by Build and Test, `e2e/build-and-test/board-bill-link.spec.ts` and the first test of `e2e/build-and-test/keyboard-journey.spec.ts`, are marked expected-to-fail with a `test.fail(true, …)` line until this fix lands (so the walking skeleton's and the other Units' checkpoints can run). In this step, remove those two `test.fail` lines and confirm both specs now pass in Chromium (they are Build and Test's regression tests for this fix)
- [ ] Run vitest scoped (the U3 command in `unit-test-instructions.md`) and `E2E_PORT=5100 npx playwright test e2e/u3-kitchen-board/ e2e/build-and-test/`; confirm green

**Step 18** — `source-manifest.json` and `traceability.json`
- [x] Write `aidlc/spaces/default/intents/261105-table-order-app/construction/u3-kitchen-board/code-generation/source-manifest.json` listing every file created/modified
- [x] Run `aidlc engine sensor-traceability --stage code-generation --output-path aidlc/spaces/default/intents/261105-table-order-app/construction/u3-kitchen-board/code-generation/traceability.json --write-upstream` and fill in OK targets
