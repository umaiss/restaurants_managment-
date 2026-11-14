# Risk and Sequencing Rationale — Manager TV Wall

A **Bolt** is one build pass over a piece of the work that ends in something that runs and is signed off.

## Heuristic: walking skeleton first, then risk-first inside the skeleton

A **walking skeleton** (Cockburn) is the smallest version that works end to end. Building it first proves that the pieces fit before any polish goes on top. This plan uses walking-skeleton-first for two reasons:
- the project's rules make the first Unit the skeleton;
- the dependency graph in `inception/units-generation/unit-of-work-dependency.md` allows only one order: U8, then U9.

No formal scoring model such as WSJF (value and urgency weighed against size) is used. With two Bolts and a single valid order, there is nothing to rank.

The order follows the graph exactly; nothing is moved out of it.

Inside Bolt 8, the work is ordered risk-first: the riskiest change goes first, so that a problem shows up before anything depends on it.

## Risks

| Risk | Likelihood | Impact | Mitigation | Bolt |
|---|---|---|---|---|
| Moving the Sales money rule changes the Sales page's figures | Medium | High | A regression test of the Sales output is written first, before the move. The TV total is tested against the Sales total for today. | 8 |
| Filtering the closed tables by day misses visits stored in v1's older time format | Medium | Medium | The day filter takes a slightly wider time range and then checks each visit with the Sales page's own day rule. A test covers visits in both formats near midnight. | 8 |
| The switch on an open staff page shows an old value after a dropped connection | Medium | Medium | The switch re-reads the setting when the page loads and after every reconnect. A browser test covers it. | 8 |
| Takings reach the browser while hidden | Low | High | Money is left out of the summary on the server. A test checks the JSON has no takings while the setting is off. | 8 |
| Existing v1 and v2 tests that count routes, events or upgrade steps break | High | Low | Expected. Each change is listed with its reason in U8's `code-summary.md`, as the project rules require. | 8 |
| A server restart leaves the TV on the PIN screen | Medium | Low | Accepted as a known limit (requirements Q2). Someone enters the PIN once on the TV. | 8 |
| TV-sized type does not fit 8 rows plus every tile on a real TV | Low | Medium | The mockups were measured at 1920 by 1080. Bolt 9 tests the 8-row minimum and the mockup match. | 9 |
| Too many reads on a busy evening | Low | Low | Bursts of events are combined into one read, and the summary reads only today's rows (`inception/contract-design/contract-summary.md` C3, C5). | 8 |

## Why this order is good value

Bolt 8 alone already gives the restaurant a working TV wall: plain, but live and safe for takings. If Bolt 9 slipped, the team could still use the TV.
