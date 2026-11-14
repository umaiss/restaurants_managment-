# Requirements — Manager TV Wall

**Depth:** Standard. **Type:** new feature (enhancement to the finished v1 and v2 app). **Scope:** one new staff screen plus one new server read and one new setting; multi-component, low complexity.

Sources: `ideation/intent-capture/intent-statement.md` (problem, viewers, success targets), `ideation/scope-definition/scope-document.md` (in and out of scope, agreed meanings, changes to v1 and v2), the code knowledge base `aidlc/spaces/default/codekb/table-order/` (`business-overview.md`, `architecture.md`, `code-structure.md`) and `requirements-analysis-questions.md` (Q1 to Q6).

## Intent Analysis

The manager and front-of-house staff at the pass want to see how service is going at a glance, on one big screen, without touching a device (intent-statement.md). Today the facts are spread across the Kitchen Board, the floor map and the Past visits and sales page, each on its own staff screen (business-overview.md). The TV wall brings five facts onto one screen: the open orders and their waits, today's takings, the busiest table and the top dish. Revenue must stay out of diners' sight, so takings start hidden (scope-document.md S6).

## Functional Requirements

### FR1 — The TV wall screen

- **FR1.1** The system shall serve the TV wall at its own staff address (`/staff/tv`). It fills the whole screen with no staff side navigation (Q4). Source: scope-document.md S1, Q4.
  - Given a signed-in staff browser, When it opens the TV wall address, Then the TV wall fills the window and no staff navigation is shown.
  - Given a browser with no staff sign-in, When it opens the TV wall address, Then it shows the staff PIN screen, and after a correct PIN it shows the TV wall.
- **FR1.2** The staff navigation shall gain one "TV wall" link that opens the TV wall. Source: scope-document.md S7, Q4.
  - Given a signed-in staff member on any staff page, When they choose "TV wall" in the navigation, Then the TV wall opens full screen.
- **FR1.3** The TV wall shall need no buttons, touch or keyboard input to do its job: everything it shows updates by itself. Source: intent-statement.md (left out: touch).
  - Given the TV wall is open, When nobody touches the device for a whole service, Then every figure still updates as orders change.

### FR2 — Live orders

- **FR2.1** The TV wall shall list every open order (status Pending or Preparing) across all tables, oldest first by the time it was placed; orders placed in the same second are ordered by order number. Source: scope-document.md S2, Q5.
  - Given orders 41 (placed 19:02) and 42 (placed 19:05) are open, When the TV wall shows the list, Then order 41 is above order 42.
  - Given an order moves to Completed or Cancelled, When the change happens, Then the order leaves the list.
- **FR2.2** Each listed order shall show the table number, the order number, the number of items and how many whole minutes it has waited since it was placed. Source: scope-document.md S2.
- **FR2.3** Each listed order's wait shall use the Kitchen Board's thresholds: "Slow" from 8 minutes and "Late" from 15 minutes, shown as a word as well as a colour. Source: business-overview.md (Kitchen Board ticket timers), corner checklist (status never by colour alone).
  - Given an order has waited 9 minutes, When the TV wall shows it, Then its row shows the word "Slow" in the amber style.
  - Given an order has waited 16 minutes, When the TV wall shows it, Then its row shows the word "Late" in the red style.
- **FR2.4** The TV wall shall show the oldest wait as its own headline figure: the minutes the oldest open order has waited. Source: intent-statement.md success target, scope-document.md S2.
  - Given no order is open, When the TV wall shows the headline, Then it reads "No open orders" instead of a number.
- **FR2.5** When more open orders exist than fit on the screen, the last visible row shall read "+N more", where N is the number not shown. Source: Q5.
  - Given 30 open orders and room for 12 rows, When the list is shown, Then 11 orders show and the 12th row reads "+19 more".
- **FR2.6** When no order is open, the list shall say "No open orders" rather than show an empty area. Source: corner checklist (empty list).

### FR3 — Today's takings

- **FR3.1** The TV wall shall show "Today's takings": the total of tables closed today, using exactly the Sales page's rules. A day is the server's local calendar day of the table's close time, cancelled orders count nowhere, and prices are the ones frozen when each order was placed. Source: scope-document.md (Meanings Agreed), business-overview.md (sales rules), Q1.
  - Given two tables closed today with bills of 42.50 and 18.00, When the TV wall shows takings, Then "Today's takings" reads 60.50.
  - Given the TV wall and the Sales page are open at the same moment, When both show today, Then "Today's takings" equals the Sales page's total sales for today.
- **FR3.2** Under it, the TV wall shall show a smaller "On open tables" figure: the sum of the live bills of every table whose visit is still open, cancelled orders excluded. Source: Q1.
  - Given table 3 is still eating with a live bill of 31.00 and no other table is open, When the TV wall shows takings, Then "On open tables" reads 31.00.
- **FR3.3** Money shall be shown in the staff screens' existing money format, and zero shall show as an amount (for example 0.00), never as a blank. Source: code-structure.md (`components/staff/money.ts`), corner checklist (unknown vs zero).

### FR4 — Busiest table

- **FR4.1** The TV wall shall show the busiest table: the table with the most orders placed today, cancelled orders excluded, counting both open and closed visits. It shows the table number and its order count. Source: scope-document.md (Meanings Agreed).
  - Given table 5 has 4 orders today and table 2 has 3, When the TV wall shows the busiest table, Then it shows table 5 with 4 orders.
- **FR4.2** When two tables tie, the lower table number is shown. Source: corner checklist (ordering with a tiebreaker).
- **FR4.3** When no order has been placed today, it shall read "No orders yet". Source: corner checklist (empty).

### FR5 — Top dish

- **FR5.1** The TV wall shall show the top dish: the menu item with the most portions ordered today, cancelled orders excluded. It shows the dish name and the number of portions. Source: scope-document.md (Meanings Agreed).
  - Given 7 portions of "Margherita" and 5 of "Caesar salad" were ordered today, When the TV wall shows the top dish, Then it shows "Margherita, 7".
- **FR5.2** When two dishes tie, the one whose name comes first alphabetically is shown. Source: corner checklist (ordering with a tiebreaker).
- **FR5.3** When no dish has been ordered today, it shall read "No dishes yet". Source: corner checklist (empty).

### FR6 — Hide-takings setting

- **FR6.1** The system shall keep one restaurant-wide "Show takings on the TV" setting on the server. It survives a server restart, and it is off (takings hidden) until a staff member turns it on. Source: scope-document.md S6, Q3.
  - Given the setting has never been changed, When the TV wall opens, Then no revenue figure appears on it.
  - Given a staff member turned the setting on, When the server restarts, Then the setting is still on.
- **FR6.2** Any signed-in staff member shall be able to switch the setting from the staff screens. Source: scope-document.md S6.
  - Given a browser with no staff sign-in, When it tries to change the setting, Then the change is refused and the setting stays as it was.
- **FR6.3** While takings are hidden, both takings figures (FR3.1 and FR3.2) shall be replaced on the TV wall by the words "Takings hidden". No revenue amount shall be sent to the TV wall while the setting is off. Source: scope-document.md (assumption: neutral label), intent-statement.md (diners must not see revenue).
  - Given takings are hidden, When the TV wall's data is inspected in the browser, Then it contains no takings amount.
- **FR6.4** Every open TV wall shall follow a change to the setting within 2 seconds. Source: scope-document.md S6, intent-statement.md (freshness target).

### FR7 — Live updates

- **FR7.1** The TV wall shall show any change within 2 seconds when an order is placed, changes status or is cancelled, when a table is closed, or when the hide-takings setting changes. Source: intent-statement.md (freshness), architecture.md (write then publish, shared staff stream).
- **FR7.2** When the live connection drops, the TV wall shall keep the last figures on screen, show "Reconnecting…" with the time of the last update, and re-read everything as soon as the connection returns. Source: architecture.md (reconnect re-read), corner checklist (stale data).
- **FR7.3** The "minutes waited" values shall keep counting up between events, at least once a minute, without needing a new event. Source: FR2.2.

### FR8 — Staying signed in

- **FR8.1** While the TV wall is open, it shall check in with the server at least every 5 minutes, so the 12-hour idle sign-out does not end its session. Source: Q2, architecture.md (staff stream does not refresh the idle timer).
  - Given the TV wall has been open for 13 hours with no other staff activity, When the next update arrives, Then the TV wall still shows it and has not returned to the PIN screen.
- **FR8.2** After a server restart or a closed browser, the TV wall shall show the staff PIN screen as every staff page does today, and return to the TV wall after a correct PIN. Source: Q2, business-overview.md (sessions in server memory).

### FR9 — Waiter and bill requests (Could)

- **FR9.1** If time allows, the TV wall shall show open "call the waiter" and "ask for the bill" requests with their table numbers, removed when answered. Source: scope-document.md S8 (Could).

## Non-Functional Requirements

- **NFR1 — Readable from the pass.** On a 43-inch landscape TV at 1920 by 1080 read from about 4 metres (Q6), every text on the TV wall is at least 32 px tall and the five headline facts (oldest wait, today's takings, on open tables, busiest table, top dish) are at least 72 px tall, measured at a 1920 by 1080 browser window. Source: intent-statement.md (read in under 5 seconds), Q6.
- **NFR2 — Everything at once.** At a 1920 by 1080 window, all five headline facts and the first rows of the orders list are visible without scrolling. Source: intent-statement.md (read in under 5 seconds, hands-free).
- **NFR3 — Freshness.** 95% of changes appear on the TV wall within 2 seconds of the write that caused them, measured in browser tests on the local machine. Source: intent-statement.md.
- **NFR4 — Staff only.** Every TV wall data read and every setting change is refused with "not signed in" (HTTP 401) without a staff session; the TV wall's data is never reachable from a diner address. Source: intent-statement.md (staff-only), architecture.md (staff guard).
- **NFR5 — Takings safe by default.** On a fresh database and after an upgrade of an existing database, the setting starts off and no revenue figure is sent to or shown on the TV wall. Source: scope-document.md (success target "Takings safe by default"), Q3.
- **NFR6 — Light load.** Working out today's figures reads only today's data: with 10,000 past closed visits in the database, the TV wall's data read answers in under 300 ms on the restaurant machine, measured in an integration test. Source: architecture.md (improvement opportunity: day-bounded queries), corner checklist (very many items).
- **NFR7 — Accessible.** Text meets WCAG 2.1 AA contrast in the dark and light themes; status is never shown by colour alone; all motion stops when the device asks for reduced motion. Source: project.md (Screen design: reduced motion), corner checklist (contrast).
- **NFR8 — v1 and v2 untouched.** Every existing v1 and v2 test still passes. A test changes only where the new navigation link, the new live event or the new server route makes it out of date, and each such change is listed with its reason in that Unit's `code-summary.md`. Source: scope-document.md (Changes to v1 and v2, success target), project.md (Protecting v1, applied to v1 and v2 here).
- **NFR9 — Tested in the team's browsers.** The TV wall's main flows have Playwright tests in `e2e/<unit>/` and a mockup-match spec, run in Chromium, the installed Google Chrome and WebKit. Source: project.md (Testing Posture).

## Constraints

- One Node process, one SQLite file and plain HTTP on the restaurant network; no new hosting (architecture.md).
- Database changes only add a table or a column with a default, through a new named upgrade step; existing data and seed data still load (architecture.md, project.md).
- The new screen uses the existing design system's tokens only, with no colour values outside `tokens.css` (code-structure.md).
- The new page joins through the staff page registry and the new server route through the route registry, listed after the staff guard (architecture.md, code-structure.md).
- The TV wall subscribes through the one shared staff live stream and never opens its own (architecture.md).
- Ports and the database file come from `PORT`, `E2E_PORT` and `DB_FILE` (project.md).
- Page routes serve `index.html` with `res.sendFile('index.html', { root: distDir })` (project.md).

## Assumptions

- [assumption] The "Show takings on the TV" switch sits in the staff navigation directly under the new "TV wall" link, so the only v1 or v2 screen that changes is the navigation (scope-document.md: only the navigation changes). Reason: it keeps the switch one tap away from every staff page without altering the Sales page.
- [assumption] "Today" for the busiest table, the top dish and the "On open tables" figure uses the same server-local calendar day as the Sales page. Reason: one day rule for every figure on the screen.
- [assumption] The TV wall follows the staff screens' theme setting, dark by default. Reason: the design system already defaults to dark, which suits a wall screen.

## Out of Scope

- Buttons, touch or controls on the TV (intent-statement.md).
- History and date ranges; the TV shows today only (intent-statement.md).
- Different layouts or settings per screen or per restaurant, deferred (scope-document.md).
- Sound alerts on the TV, deferred (scope-document.md).
- Designing for the kitchen team as an audience (scope-document.md).
- Changes to any v1 or v2 screen other than the navigation link and switch (scope-document.md).

## Open Questions

- None.
