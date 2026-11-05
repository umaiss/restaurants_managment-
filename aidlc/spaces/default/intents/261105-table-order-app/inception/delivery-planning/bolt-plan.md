# Bolt Plan — Table Order Web App

**Based on:** `unit-of-work.md` and `unit-of-work-dependency.md` from `inception/units-generation/`, `contract-summary.md` from `inception/contract-design/`, `stories.md` from `inception/user-stories/`, team rules from `aidlc/spaces/default/memory/project.md`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Settled before this stage (not asked)

- The walking skeleton comes first (U1 alone). [team: project.md > Walking Skeleton]
- No scoring model is used; the sequence is dictated by the team's Construction plan. [team: project.md > Construction]
- Each Bolt is exactly one Unit. [team: project.md > Construction]
- The biggest risk is the 5-hour session timebox. [desc]

## The four Bolts

The Bolt table is the workshop dashboard's source; one row per Bolt with the Bolt number, name, Unit directory and the Bolt's Code Generation timebox. [team: project.md > Construction]

| Bolt | Name | Unit | Timebox | Ports / DB |
|---|---|---|---|---|
| 1 | u1-walking-skeleton | U1 `u1-walking-skeleton` | 45 min | main folder; PORT=3000, E2E_PORT=3100 |
| 2 | u2-diner-screens | U2 `u2-diner-screens` | 30 min | worktree; E2E_PORT=4100, worktree-local DB_FILE |
| 3 | u3-kitchen-board | U3 `u3-kitchen-board` | 30 min | worktree; E2E_PORT=5100, worktree-local DB_FILE |
| 4 | u4-bill-and-close | U4 `u4-bill-and-close` | 25 min | main folder after merges; E2E_PORT=6100, main-local DB_FILE |

## Build order and construction mode

- **Build order:** Bolt 1 alone → Bolts 2 and 3 in parallel → Bolt 4 alone.
- **Construction iteration:** `stage-major` (every remaining Unit runs Functional Design first, then one grouped Code Generation plan approval, then the build). [team: project.md > Construction]
- **Construction execution:** `swarm` for Bolts 2 and 3; serial for Bolt 1 and Bolt 4. [team: project.md > Construction]
- **How to continue after Bolt 1:** "Review each checkpoint" — the team signs off the parallel Bolts together. [team: project.md > Construction]

## Timeline (5-hour workshop)

| Minutes | Activity | Notes |
|---|---|---|
| 0–10 | Setup, intent and resume | Already done by this point. |
| 10–60 | Bolt 1 — walking skeleton | Built, verified, signed off, committed. |
| 60–95 | Bolts 2 and 3 — parallel | Each in its own worktree. |
| 95–105 | Merge + re-verify in main | Checkpoint routine on the merged app. |
| 105–135 | Bolt 4 — bill and close | Built, verified, signed off. |
| 135–150 | Buffer, demo, retro | — |

Totals: 45 + 30 + 10 + 25 + 15 = 125 min planned work in a ~150-min envelope; a 25-min buffer absorbs the unknowns. [desc]

## Per-Bolt details

### Bolt 1 — u1-walking-skeleton (45 min)

- **Confidence hypothesis:** The app's end-to-end shape is reachable from `npm install && npm start`. [FR5.1]
- **Definition of Done:**
  - `npm install && npm start` opens `/table/5` and `/staff` at `http://localhost:3000`.
  - The SQLite database seeds 10 tables, 4 categories, 12 items on empty start.
  - An EventSource client receives a test SSE event within 2 seconds.
  - `npm test && npm run test:e2e` exits 0.
- **Checkpoint:** human sign-off and commit so Bolts 2 and 3 start from a clean tree.

### Bolt 2 — u2-diner-screens (30 min)

- **Confidence hypothesis:** A diner can go from browsing to tracking live status without staff help.
- **Definition of Done:**
  - Menu, Cart, My orders and the TableClosedTakeover render per `mockups.md`.
  - Cart survives a page refresh.
  - Placing an order creates an order on the server; sold-out lines are dropped with a named-item message.
  - Live status updates reach "My orders" within 2 seconds.
  - A diner can cancel a Pending order.
  - Playwright + mockup-match specs pass in the worktree.
- **Worktree:** `.aidlc/worktrees/u2-diner-screens/`, `E2E_PORT=4100`, worktree-local `DB_FILE`.

### Bolt 3 — u3-kitchen-board (30 min)

- **Confidence hypothesis:** Staff can move orders through the kitchen and mark items sold out without leaving the one board.
- **Definition of Done:**
  - Kitchen Board renders table cards with status pills; a new order appears highlighted within 2 seconds.
  - Pending → Preparing → Completed transitions succeed; illegal ones are refused.
  - Menu availability panel toggles propagate within 2 seconds.
  - Playwright + mockup-match specs pass in the worktree.
- **Worktree:** `.aidlc/worktrees/u3-kitchen-board/`, `E2E_PORT=5100`, worktree-local `DB_FILE`.

### Bolt 4 — u4-bill-and-close (25 min)

- **Confidence hypothesis:** Staff can close out a table and the diners' devices reset at the same time.
- **Definition of Done:**
  - Table Bill lists orders with lines, prices and subtotals, plus a combined total; cancelled orders are excluded.
  - Close is disabled while any order is Pending or Preparing, and when the table has no orders.
  - Close archives the visit and resets every open diner device within 2 seconds via `TABLE_CLOSED`.
  - Playwright + mockup-match specs pass.
- **Runs in the main folder** after Bolts 2 and 3 have merged. `E2E_PORT=6100`, main-local `DB_FILE`.

## Verification

The intent's Construction Verification Command for every Unit is:

```
npm test && npm run test:e2e
```

Test results feed the workshop dashboard from `test-results/unit.json`, `coverage/coverage-summary.json` and `test-results/e2e.json`. [team: project.md > Testing Posture]

## Assumptions

- Each Bolt is one Unit, and each Unit is one Bolt. [team: project.md > Construction]
- The 25-min buffer at the end absorbs slips without stretching the session. [assumption]
- If the parallel build fails, the team says "build them one at a time instead"; the approved plans are kept. [team: project.md > Construction]
