# Bolt Plan — Manager TV Wall

| Bolt | Name | Unit | Walking skeleton | Depends on |
|---|---|---|---|---|
| 8 | TV foundation | U8 `u8-tv-foundation` | Yes | — |
| 9 | Finished TV wall screen | U9 `u9-tv-wall-screen` | No | Bolt 8 |

A **Bolt** is one build pass over a piece of the work. Each Bolt ends in something that runs and that the team signs off. This plan has one Bolt per Unit from `inception/units-generation/unit-of-work.md`. Those Units group the building blocks in `inception/domain-design/components.md` and implement `inception/requirements-analysis/requirements.md`. The order follows the dependency graph in `unit-of-work-dependency.md` (U9 depends on U8) and the team's answer to Q1: one Bolt at a time.

Construction runs one Unit at a time, through its design, code, tests and checkpoint, before the next Unit starts. The team reviews each checkpoint. Nothing is built in parallel.

## Bolt 8 — TV foundation (walking skeleton)

A **walking skeleton** is the smallest version that works end to end and proves the pieces fit together.

- **Unit:** U8 `u8-tv-foundation`.
- **What it proves:** the whole path works from the database to the TV. That path is the new setting table, the "today across all tables" reads, the shared Sales money rule, the summary and setting routes (`contract-summary.md` C1, C2, C5), the new live event (C3), the navigation link and switch, and a plain full-screen page.
- **Order of work:**
  1. Write a regression test of the Sales page's output, then move the Sales money rule into the shared module.
  2. Add the setting table and the new reads.
  3. Build the summary.
  4. Add the routes and the event.
  5. Add the link and the switch.
  6. Build the plain page.
- **The design points the team accepted as risks at earlier gates are settled here, in U8's Functional Design and code plan:**
  - the day filter for the Sales rule has to handle both stored time formats;
  - the switch re-reads the setting when a page loads and after a reconnect;
  - the route registry's owner type gains `'U8'`;
  - saving the value it already has publishes no event;
  - the route relies on the existing staff guard;
  - a server restart signs the TV out, and this is recorded as a known limit.
- **Definition of Done:**
  - `npm test && npm run test:e2e` passes, with every existing v1 and v2 test still green. Any test that had to change is listed with its reason in `code-summary.md`.
  - The Sales page gives the same output before and after the move. The TV's takings equal the Sales total for today. No takings appear in the summary while the setting is off. A signed-out read is refused (401). The summary answers in under 300 ms with 10,000 past visits.
  - Playwright tests in `e2e/u8-tv-foundation/` cover the link, the switch, live updates and the PIN gate, and the mockup match for `staff-nav-switch.html` passes.
  - The code is reviewed, and the team signs off at the checkpoint.
- **Confidence hypothesis:** one summary read, re-read on live events, keeps a full-screen staff page current within 2 seconds. Takings stay off the wire until a staff member turns them on, and the Sales page does not change at all.
- **Expected demo:**
  - Open "TV wall" from the staff navigation and see today's open orders and figures.
  - Place an order from a diner phone: it appears on the TV within 2 seconds.
  - Flip "Show takings on TV": the amounts appear and disappear.
  - The Sales page shows the same takings figure as the TV.

## Bolt 9 — Finished TV wall screen

- **Unit:** U9 `u9-tv-wall-screen`.
- **What it adds:** the TV wall exactly as the refined mockups (`inception/refined-mockups/mockups.md`) draw it. That means:
  - the two-column layout, TV-sized type, the Slow and Late words and bars, "+N more", and the tiles with their empty wording;
  - "Takings hidden", the requests strip, and the Live and Reconnecting header;
  - the loading and error states, both themes, and reduced motion.
- **Definition of Done:**
  - `npm test && npm run test:e2e` passes, v1, v2 and U8 tests included.
  - Playwright tests in `e2e/u9-tv-wall-screen/` cover the main flows; the 7, 8, 14 and 15 minute boundaries; contrast in dark and light; reduced motion; the 8-row minimum at 1920 by 1080; and the mockup match for all four TV wall mockups.
  - The code is reviewed, and the team signs off at the checkpoint.
- **Confidence hypothesis:** from 4 metres on a 43-inch TV, a viewer reads the five figures and the oldest waits in under 5 seconds, in every state, without touching anything.
- **Expected demo:** the TV wall at 1920 by 1080 in a busy state, with takings hidden, at the start of the day, and while reconnecting, each matching its mockup side by side.

## Construction Settings

- One Unit at a time (`Construction Iteration: unit-major`), one after another (`Construction Execution: serial`), with a checkpoint after each Unit (`Construction Checkpoints: enabled`). These settings are already recorded and match the team's answer.
- Verification command for every checkpoint: `npm test && npm run test:e2e`, from the project's Testing Posture. It needs the team's approval before Construction starts.
