# Team Allocation: Table Order v2

A **Bolt** is one build pass over a piece of the work, ending in something that runs (the Bolts are listed in `bolt-plan.md`). A **mob** is the group that works on one Bolt together; here the mob is the AI developer agent, with the team as the people who decide and sign off. This allocation uses the Units (`inception/units-generation/unit-of-work.md`) and the team's rules in `aidlc/spaces/default/memory/project.md`.

The team-formation stage is not part of this plan, so no human mobs were formed. Every Bolt is executed by the AI developer (aidlc-developer-agent), and the team decides, approves each plan and signs off each Bolt.

| Bolt | Unit | Built by | Reviewed by | Signed off by |
|---|---|---|---|---|
| 5 | U5 `u5-foundation` | AI developer, in the main folder | Code review at the Unit checkpoint | The team |
| 6 | U6 `u6-diner-features` | AI developer, in its own worktree | Code review at the Unit checkpoint | The team, together with Bolt 7 |
| 7 | U7 `u7-staff-kitchen-features` | AI developer, in its own worktree | Code review at the Unit checkpoint | The team, together with Bolt 6 |

## How the Work Is Shared Out

- **Bolt 5** runs alone, so the AI developer works on it with no other build in progress.
- **Bolts 6 and 7** run at the same time. Each has its own separate copy of the project, its own `E2E_PORT` (4100 for Bolt 6, 5100 for Bolt 7) and its own database file inside its copy, so they never share a port or a database. They edit different folders and different lines of the shared registries, as the contracts describe, so they merge without conflicts.
- **The team's part:** answer the Functional Design questions, approve the grouped code plan, try the merged app, and sign each Bolt off. The team never runs tests by hand.

## Program Board

One team and one AI developer, so there is no cross-team Program Board. The only hand-off between Bolts is the commit after Bolt 5's sign-off, which Bolts 6 and 7 start from.

## Assumptions & Open Questions

- All Bolts use the AI developer agent, because there is no team-formation output to refer to.
- Whether the team wants a second pair of eyes on Bolt 5's PIN and session code is up to them; the code review at the checkpoint covers it by default.
