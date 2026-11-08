# Risk and Sequencing Rationale: Table Order v2

Why the Bolts are in this order. A **Bolt** is one build pass over a piece of the work, ending in something that runs; the three Bolts (5, 6 and 7) are in `bolt-plan.md`. A **walking skeleton** is the first Unit, built as the smallest working end-to-end slice before the rest, so the shared parts are proven early. This rationale uses the Units and their dependency graph (`inception/units-generation/unit-of-work-dependency.md`), the contracts (`inception/contract-design/contract-summary.md`), the stories (`inception/user-stories/stories.md`) and the planning answers (`delivery-planning-questions.md`).

## The Sequence and Why

- **No scoring model.** The order is set by the team's plan for v2, not by a score (no WSJF, which would weigh value and urgency against size). The Units Generation graph allows exactly two orderings: U5 then U6 then U7, or U5 then U7 then U6, with U6 and U7 free to run at the same time.
- **Walking skeleton first (Bolt 5).** U5 is first because both other Units depend on it (it is the only edge in the graph) and because it holds the riskiest shared parts: the Staff PIN guard on every staff route, the database upgrade on a v1 file, the order changes that every feature reads, and the specials stock update that must not oversell. If those are wrong, both feature Bolts inherit the problem, so they are proven first and signed off alone.
- **Parallel feature Bolts after sign-off (Bolts 6 and 7).** U6 and U7 have no edge between them and meet only through contracts 1 to 5, so they can be built at the same time in separate copies, which is the quickest way to finish by Tuesday. This is a deliberate use of the allowed parallelism, not a deviation from the graph.
- **No Bolt 8.** Nothing needs both U6 and U7. If Functional Design finds something that does, a Bolt 8 is added after the merge.
- **No deviation from the graph.** The sequence respects every dependency.

## Risks, Ranked

| # | Risk | Why it matters | What we do |
|---|---|---|---|
| 1 | **Time.** The hand-in is Tuesday 10 November 2026 end of day, today is Sunday 8 November, and Bolt 5 is the largest Unit and runs alone. Planning answer Q2 is to build every feature in a Unit before its sign-off, with no ranking inside a Unit. | A slow Bolt 5 delays both parallel Bolts, and a Bolt that cannot finish all its features blocks its sign-off. | Keep the scope-document ranking as the tie-breaker when something has to give, and tell the team early if a Bolt is running behind. The team can change this answer at any gate. |
| 2 | **Contract gaps carried forward.** The last review of Contract Design raised seven Major points that were accepted as risk: a YAML block that does not parse, no staff read route for hidden menu items, an undefined presence heartbeat, no client rule for an expired staff session, an open estimate formula, a rating lock with no route, and an unspecified station-done transition. | Two parallel Bolts that each guess differently can collide at the merge. | Functional Design for U6 and U7 settles each of these in its questions-free section first (the AI decides the minor ones and lists them as assumptions), and U5's code plan starts by fixing the contract file. |
| 3 | **The Staff PIN lockout** could be bypassed by clearing cookies in the version first drafted. | A 4-digit PIN is easy to guess without a real lockout. | Contract Design already keys the lockout by client address alone; Bolt 5 builds it that way and tests it, including a test-only reset so parallel test workers do not lock each other out. |
| 4 | **v1 tests that call staff actions without signing in** will fail once the guard is on. | It looks like a regression. | They are updated to sign in, and each is listed under "v1 tests changed" in U5's `code-summary.md` (contract answer Q2). |
| 5 | **Shared files.** U6 and U7 both touch the client event hooks, the stylesheet and the server route list. | A merge conflict in a parallel build. | U5 pre-fills the registries and creates the stubs; U6 and U7 edit only their own folders (contract 7). |
| 6 | **Dark mode changes how v1 looks by default** on a light device, and Playwright browsers default to light. | v1's mockup-match tests could start failing. | Bolt 5 sets the test browsers to the dark scheme for v1's specs, or lists any test change it needs. |
| 7 | **The 17 features in three days.** | Scope. | The ranking in the scope document says Could items slip first, if the team chooses to cut. |

## Confidence Built Bolt by Bolt

1. After Bolt 5: the shared parts work end to end, and the contracts are real.
2. After Bolt 6 and Bolt 7: each side works against U5 alone, so the merge is low risk.
3. After the merge: the whole journey works in both themes in Chrome and WebKit.

## Accepted Review Findings Carried Forward

The review findings accepted as risk at earlier gates stay on record in each stage's review file. The ones that affect construction are the Contract Design Majors above, the Domain Design finding about which parts belong in the foundation (settled here: U5 holds them), the Units Generation findings about the menu write side and the connection count (settled in Contract Design: U5 provides `publishMenuChange()` and the presence service), and the open estimate formula.

## Assumptions & Open Questions

- Bolt 5's size is the main schedule risk; if the team prefers, a later decision could move a self-contained part of U5 (for example the specials engine) into U6 or U7, but that would add a dependency the plan avoids.
- The estimate allowance per open order ahead (2 minutes is proposed in Contract Design) is settled in Functional Design.
