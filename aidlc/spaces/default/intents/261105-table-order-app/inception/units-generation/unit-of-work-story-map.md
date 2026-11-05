# Unit of Work — Story Map

**Based on:** `unit-of-work.md` from this stage, `stories.md` from `inception/user-stories/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Mapping

| Unit | Stories (primary) | Stories (supporting) |
|---|---|---|
| U1 u1-walking-skeleton | US8.1 (one-command start) | shell/routing for every story |
| U2 u2-diner-screens | US1.1, US1.2, US2.1, US2.2, US2.3, US2.4, US2.5, US3.1, US3.2, US4.1 | — |
| U3 u3-kitchen-board | US5.1, US5.2, US5.3, US6.1, US6.2, US6.3 | — |
| U4 u4-bill-and-close | US7.1, US7.2 | US4.1 (table-closed takeover ends on U2 but is triggered here) |

## Journey → Unit

| Journey | Stories | Unit |
|---|---|---|
| J1 Open the table and browse the menu | US1.1, US1.2 | U2 |
| J2 Build a cart and place an order | US2.1, US2.2, US2.3, US2.4, US2.5 | U2 |
| J3 Track and cancel orders | US3.1, US3.2 | U2 |
| J4 Table closed takeover | US4.1 | U2 (receiver), U4 (trigger) |
| J5 See the live kitchen board | US5.1, US5.2, US5.3 | U3 |
| J6 Update status and sold-out | US6.1, US6.2, US6.3 | U3 |
| J7 Open the bill and close the table | US7.1, US7.2 | U4 |
| J8 Start the app with one command | US8.1 | U1 |

## Coverage check

- Every story has a primary Unit.
- Every Unit owns at least one journey end-to-end (U1: J8; U2: J1-J4 receiver; U3: J5-J6; U4: J4 trigger + J7).
- No story spans more than one Unit for primary ownership.

## Walking-skeleton verification against stories

U1 verifies against US8.1 (`npm install && npm start` opens both views at `http://localhost:3000` and seeds the database on first start). This is the smallest working integrated slice that demonstrates the app's real end-to-end result. [team: project.md > Walking Skeleton]
