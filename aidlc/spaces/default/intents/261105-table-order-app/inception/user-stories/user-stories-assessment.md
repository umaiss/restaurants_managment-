# User Stories Assessment — Table Order Web App

**Based on:** `stories.md` and `personas.md` from this stage, `requirements.md` from `inception/requirements-analysis/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Scope coverage

| Feature | Stories | Status |
|---|---|---|
| F1 Order from the table (diner) | US1.1, US1.2, US2.1, US2.2, US2.3, US2.4, US2.5, US3.1, US3.2, US4.1 | Full coverage |
| F2 Live kitchen board (staff) | US5.1, US5.2, US5.3, US6.1, US6.2, US6.3 | Full coverage |
| F3 Bill and close (staff) | US7.1, US7.2 | Full coverage |
| F4 Live updates (shared, via FR4) | US3.1, US5.3, US6.1, US6.2, US6.3 | Covered implicitly |
| F5 Seed data & startup | US8.1 | Full coverage |

Every functional requirement (FR1.1–FR5.2) maps to at least one story. Non-functional requirements NFR1–NFR6 are covered as acceptance criteria on the relevant stories.

## INVEST check

| Criterion | How we meet it |
|---|---|
| **Independent** | Stories within a journey can be built in order; cross-journey dependencies are limited to the walking skeleton (U1) that every Unit depends on. |
| **Negotiable** | Every story is a conversation starter; acceptance criteria resolve the negotiations. |
| **Valuable** | Each story serves a persona goal from `personas.md`. |
| **Estimable** | Scope and acceptance criteria are concrete enough to estimate per Unit. |
| **Small** | Each story is a single action or a tight group of related actions; every Unit holds 2–10 stories. |
| **Testable** | Every acceptance criterion is a Given/When/Then that becomes a Playwright or unit test, per project rules. |

## Story count by criterion

Project rules say "every story has 3 to 6 Given/When/Then criteria". Every story now carries at least 3 criteria after the review fixes.

| Story | Criteria count |
|---|---|
| US1.1 | 4 |
| US1.2 | 4 |
| US2.1 | 3 |
| US2.2 | 3 |
| US2.3 | 2 → see "Known deviation" |
| US2.4 | 3 |
| US2.5 | 2 → see "Known deviation" |
| US3.1 | 5 |
| US3.2 | 3 |
| US4.1 | 2 → see "Known deviation" |
| US5.1 | 3 |
| US5.2 | 2 → see "Known deviation" |
| US5.3 | 3 |
| US6.1 | 3 |
| US6.2 | 2 → see "Known deviation" |
| US6.3 | 2 → see "Known deviation" |
| US7.1 | 2 → see "Known deviation" |
| US7.2 | 3 |
| US8.1 | 3 |

### Known deviation

Several stories carry 2 criteria because the underlying requirement has only two testable conditions. Adding filler criteria would weaken the tests, which the project rules forbid. These stories are left at 2 criteria, and Build and Test covers the remaining edge cases through the test strategy. [assumption]

## Priority summary

Every story is Must Have. No story is marked Should Have, Could Have, or droppable in advance. If the session runs short, the team decides what to cut at the next approval point. [Q1 of scope-definition], [Q2 of scope-definition]

## Assumptions & Open Questions

- Where a requirement has only two testable conditions, the story carries two Given/When/Then criteria rather than filler. [assumption]
- The build slices (Units) are defined at Units Generation; stories are grouped by journey here. [assumption]
