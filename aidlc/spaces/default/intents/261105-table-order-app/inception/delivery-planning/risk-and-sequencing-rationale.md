# Risk and Sequencing Rationale — Table Order Web App

**Based on:** `bolt-plan.md` and `team-allocation.md` from this stage.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Why this Bolt order

The sequence (Bolt 1 alone → Bolts 2 and 3 in parallel → Bolt 4 alone) is dictated by the team's project rules and is the economic choice for the 5-hour workshop:

1. **Walking skeleton first** eliminates the biggest unknown — can the end-to-end shape work on one machine with SSE and SQLite? — before anything else is built.
2. **Bolts 2 and 3 in parallel** halves the elapsed time for the two feature areas that do not touch each other's components (diner UI vs staff UI). Each runs in its own worktree with its own `E2E_PORT` and `DB_FILE`, so they never collide.
3. **Bolt 4 alone** builds Billing + the Close action against a quiet main folder once Bolts 2 and 3 have merged, so there is no three-way merge pressure during the shortest timebox (25 min).

The confidence hypothesis per Bolt is written in `bolt-plan.md`; each Bolt validates something the next assumes.

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | The 5-hour session runs out of time. | Medium | High | Fixed per-Bolt timeboxes (45/30/30/25 min) with a 25-min buffer; if the parallel build fails the team falls back to serial without re-planning. |
| R2 | Parallel Bolts collide on port or DB file. | Low | High | Project rules mandate all ports and the DB file come from env vars (`PORT`, `E2E_PORT`, `DB_FILE`) and give each Bolt its own values. Enforced by `team: project.md > Mandated`. |
| R3 | Express refuses to serve a page from a worktree path (dot-folder issue). | Medium | High | The walking skeleton uses `res.sendFile('index.html', { root: distDir })` instead of `res.sendFile(<absolute path>)` — recorded in `team: project.md > Walking Skeleton`. |
| R4 | A flaky test in a parallel Bolt stalls the swarm. | Low | Medium | Project rules forbid lowering a coverage threshold or a timed-test limit; flaky tests are fixed in test code. |
| R5 | A refined-mockup detail is missed in the built UI (Dark theme, bottom tab bar, category pills, `+ Add` pill touch area). | Medium | Medium | Every Unit includes a `mockup-match.spec.ts` under `test-results/mockup-match/<unit>/` that fails if the built screen diverges. |
| R6 | Order deduplication edge case (retry across tables). | Low | Medium | `placement_key` scope is `(table_id, visit_id, placement_key)`; `sse_replay.spec` and `order_place.spec` cover it. |
| R7 | SSE reconnect drops events during a worktree build. | Low | Low | Per-channel 1-hour ring buffer replays events on reconnect with `Last-Event-ID`; `sse_replay.spec` covers it. |
| R8 | The team wants a different look at Refined Mockups (Dark vs Warm). | Realised | — | Team chose Dark at Q1; all mockups and the design system are consistent with that choice. |

## Sequencing heuristic

Walking-skeleton-first + topological order through the Unit DAG. The `depends_on` edges in `unit-of-work.md` are respected: U1 before everything, U2 and U3 anywhere after U1, U4 only after U2 and U3 (build-order edge).

## Go/no-go criteria

- **Bolt 1 → Bolt 2/3:** `npm test && npm run test:e2e` exits 0 on main; team signs off; main is committed. Fail → the team fixes Bolt 1 before anything else starts.
- **Bolt 2/3 → merge:** Both worktrees pass their verification command; team approves the grouped sign-off. Fail on one → the team picks between "merge the good one and re-queue the other" or "build them one at a time instead".
- **Merge → Bolt 4:** Unit checkpoint routine passes in the main folder on the merged app; team approves.
- **Bolt 4 → ship:** `npm test && npm run test:e2e` exits 0; team signs off after trying the app.

## Deferred decisions

- None at the Delivery Planning level. Per-Unit decisions (what highlights as "★ New" on the Kitchen Board) are deferred to Functional Design per the script.
