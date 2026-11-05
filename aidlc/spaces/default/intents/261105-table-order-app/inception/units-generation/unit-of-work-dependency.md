# Unit of Work — Dependency Graph

**Based on:** `unit-of-work.md` from this stage, `components.md` from `inception/domain-design/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Code dependencies (what a Unit's code uses at runtime)

| Unit | Direct code dependencies |
|---|---|
| U1 u1-walking-skeleton | (none) |
| U2 u2-diner-screens | U1 |
| U3 u3-kitchen-board | U1 |
| U4 u4-bill-and-close | U1 |

No Unit's code depends on another Unit's code except U1. This is enforced by the walking-skeleton rule in `aidlc/spaces/default/memory/project.md`.

## Build-order edges (team choice at Delivery Planning)

| From | To | Reason |
|---|---|---|
| U2 | U4 | Team's build plan: Bolt 4 starts after Bolts 2 and 3 merge (not a code edge). |
| U3 | U4 | Team's build plan: Bolt 4 starts after Bolts 2 and 3 merge (not a code edge). |

The build-order edges mean U4's `depends_on` lists U2 and U3 as well as U1. AI-DLC builds Units in the order of `depends_on`, which is how the team keeps the "Bolts 2 and 3 in parallel, then Bolt 4 alone" plan.

## Units block (machine-readable)

```yaml
units:
  - name: u1-walking-skeleton
    kind: packaging
    depends_on: []
  - name: u2-diner-screens
    kind: ui
    depends_on: [u1-walking-skeleton]
  - name: u3-kitchen-board
    kind: ui
    depends_on: [u1-walking-skeleton]
  - name: u4-bill-and-close
    kind: service
    depends_on: [u1-walking-skeleton, u2-diner-screens, u3-kitchen-board]
```

`u4-bill-and-close`'s edges on U2 and U3 are build-order edges chosen by the team (Bolt 4 starts after Bolts 2 and 3 merge); U4's code uses only `u1-walking-skeleton`.

## Acyclicity

The code graph and the build-order graph are both acyclic:

```
            ┌────── U2 ────────┐
U1 ────────┼                   │─────── U4
            └────── U3 ────────┘
```

- U1 has no predecessors.
- U2 and U3 depend only on U1 and can run in parallel.
- U4 depends on U1 (code) and on U2 and U3 (build-order only).

## Parallelism plan

| Wave | Units built in this wave | Notes |
|---|---|---|
| 1 | U1 u1-walking-skeleton | Built in the main folder; signed off before anything else starts; committed before the parallel build. |
| 2 | U2 u2-diner-screens, U3 u3-kitchen-board | Built in parallel, each in its own git worktree (`.aidlc/worktrees/<bolt>/`). Each worktree uses its own `E2E_PORT` and `DB_FILE`. |
| 3 | U4 u4-bill-and-close | Built on its own in the main folder after U2 and U3 have merged and been signed off. |

## Port and DB file assignments (from team rules)

| Bolt | `E2E_PORT` | `DB_FILE` |
|---|---|---|
| Bolt 2 (U2) | 4100 | worktree-local |
| Bolt 3 (U3) | 5100 | worktree-local |
| Bolt 4 (U4) | 6100 | worktree-local |
| (Main — U1) | 3100 (`E2E_PORT` default) | main-local |

Bolts 2 and 3 must never share a port or database with each other or with the main folder. [team: project.md > Testing Posture]

## Verification

- Each Unit's own verification runs `npm test && npm run test:e2e` inside its worktree (or the main folder for U1).
- After U2 and U3 merge back, the Unit checkpoint routine is re-run in the main folder on the merged app. [team: project.md > Mandated]
