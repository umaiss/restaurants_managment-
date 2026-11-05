# Team Allocation — Table Order Web App

**Based on:** `bolt-plan.md` from this stage.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Who builds

The decision point "who builds" is settled by the workshop setup: **Just me** — the workshop team acts as one mob, with AI-DLC taking turns at each specialist role inside the stages. [Q6 of intent-capture]

## Mob composition

| Role | Human | AI-DLC persona |
|---|---|---|
| Product Owner / Sponsor | Workshop team | `aidlc-product-agent` (intent, scope, requirements, stories) |
| Designer | Workshop team | `aidlc-design-agent` (mockups) |
| Architect | Workshop team | `aidlc-architect-agent` (components, units, contracts, functional design) |
| Delivery Lead | Workshop team | `aidlc-delivery-agent` (this stage) |
| Developer | Workshop team | `aidlc-developer-agent` (code generation) |
| QA | Workshop team | `aidlc-quality-agent` (build and test) |

## Per-Bolt owners

Because there is one team, every Bolt is owned by the same mob. The parallel execution for Bolts 2 and 3 is driven by AI-DLC's swarm construction mode, with each worktree running independently. Review happens together at the "Review each checkpoint" sign-off.

| Bolt | Owner | Review |
|---|---|---|
| Bolt 1 u1-walking-skeleton | Workshop mob + AI-DLC | Team signs off after seeing `npm test && npm run test:e2e` pass and trying the app. |
| Bolt 2 u2-diner-screens | Workshop mob + AI-DLC (swarm worktree) | Grouped swarm sign-off with Bolt 3. |
| Bolt 3 u3-kitchen-board | Workshop mob + AI-DLC (swarm worktree) | Grouped swarm sign-off with Bolt 2. |
| Bolt 4 u4-bill-and-close | Workshop mob + AI-DLC | Team signs off after Bolt 4 passes. |

## Checkpoint cadence

- **Bolt 1:** approval at end; commit before Bolts 2 and 3 start (project rule — parallel Bolts start from that commit).
- **Bolts 2 and 3:** grouped approval after both complete; the Unit checkpoint routine runs again in the main folder on the merged app before the team tries it.
- **Bolt 4:** approval at end.

## Communication norms

- The team watches the workshop dashboard, which reads from `bolt-plan.md` and the test results files.
- AI-DLC asks only the scripted questions per stage. Where a scripted question assumes something an earlier answer changed, AI-DLC asks it as written and adds one sentence stating its assumption.
- Review findings are classified Minor / Major / Critical as per the team rule. The first Major of the whole run goes to the team; later Majors are decided and fixed by AI-DLC; every Critical goes to the team. [team: project.md > Way of Working]
