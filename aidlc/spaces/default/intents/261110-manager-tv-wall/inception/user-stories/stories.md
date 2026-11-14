# User Stories — Manager TV Wall

Built from `inception/requirements-analysis/requirements.md`, for the personas in `personas.md` (P1 Maria the manager, P2 Sam front-of-house). Components named in `aidlc/spaces/default/codekb/table-order/component-inventory.md` (Staff Shell and Page Registry, Staff Session and PIN Gate, Staff Live Stream Hook, Sales and Ratings Reports, Kitchen Board) are the places these stories build on. Grouped by what the TV shows (Q2).

## Group 1 — Opening the TV wall

### US1.1 — Open the TV wall from the staff navigation (Must)

As Maria (P1), I want to open a full-screen TV wall from the staff navigation, so that the TV at the pass shows the whole service without anything else on screen.

- **AC1.1.1** Given Maria is signed in on any staff page, When she chooses "TV wall" in the staff navigation, Then the TV wall opens at `/staff/tv` and fills the window with no staff navigation.
- **AC1.1.2** Given the TV wall is open in a 1920 by 1080 window, When it shows, Then the oldest wait, today's takings (or "Takings hidden"), on open tables, the busiest table, the top dish and at least 8 order rows are all visible without scrolling.
- **AC1.1.3** Given the TV wall is open in a 1920 by 1080 window, When its text is measured, Then every text is at least 32 px tall and the five headline figures are at least 72 px tall.
- **AC1.1.4** Given the TV wall is open, When nobody touches the device, Then it needs no button, touch or key press to keep showing current figures.

Requirements: FR1.1, FR1.2, FR1.3, NFR1, NFR2. INVEST: independent of the other groups once the page exists; small (one page and one link).

### US1.2 — Sign in on the TV (Must)

As Maria (P1), I want the TV wall to ask for the staff PIN when it is not signed in, so that only staff can open a screen showing the restaurant's figures.

- **AC1.2.1** Given a browser with no staff sign-in, When it opens `/staff/tv`, Then it shows the staff PIN screen, not the TV wall.
- **AC1.2.2** Given the PIN screen is showing on `/staff/tv`, When the correct PIN is entered, Then the TV wall opens.
- **AC1.2.3** Given a browser with no staff sign-in, When it asks the server for the TV wall's data, Then the request is refused as not signed in (HTTP 401) and no figures are returned.

Requirements: FR1.1, FR8.2, NFR4.

## Group 2 — Live orders

### US2.1 — See open orders, oldest first (Must)

As Sam (P2), I want every open order listed with how long it has waited, oldest first, so that I can chase the orders that have waited longest.

- **AC2.1.1** Given orders 41 (placed 19:02) and 42 (placed 19:05) are Pending or Preparing, When the TV wall shows the list, Then order 41 is above order 42, and orders placed in the same second are ordered by order number.
- **AC2.1.2** Given an order is listed, When the TV wall shows it, Then its row shows the table number, the order number, the number of portions and the whole minutes waited, worked out from the server's clock.
- **AC2.1.3** Given an order has waited 9 minutes, When it is shown, Then its row shows the word "Slow" in the amber style; given 16 minutes, Then it shows "Late" in the red style.
- **AC2.1.4** Given 30 open orders and room for 12 rows, When the list is shown, Then 11 orders show and the last row reads "+19 more".
- **AC2.1.5** Given no order is open, When the list is shown, Then it reads "No open orders".
- **AC2.1.6** Given an order moves to Completed or Cancelled, When the change happens, Then the order leaves the list.

Requirements: FR2.1, FR2.2, FR2.3, FR2.5, FR2.6, NFR7.

### US2.2 — See the oldest wait as a headline (Must)

As Maria (P1), I want the oldest wait shown as one big number, so that I know in a glance whether the kitchen is keeping up.

- **AC2.2.1** Given the oldest open order was placed 12 minutes ago, When the TV wall shows the headline, Then it reads 12 minutes.
- **AC2.2.2** Given no order is open, When the TV wall shows the headline, Then it reads "No open orders".
- **AC2.2.3** Given the headline shows 12 minutes and no event arrives, When a minute passes, Then it reads 13 minutes.

Requirements: FR2.4, FR7.3.

## Group 3 — Money and the day's figures

### US3.1 — See today's takings and the money on open tables (Must)

As Maria (P1), I want today's takings and the money still on open tables, so that I know how the day is going without opening the Sales page.

- **AC3.1.1** Given takings are shown and two tables closed today with bills of 42.50 and 18.00, When the TV wall shows takings, Then "Today's takings" reads 60.50.
- **AC3.1.2** Given takings are shown, When the TV wall and the Sales page are read at the same moment, Then "Today's takings" equals the Sales page's total sales for today.
- **AC3.1.3** Given takings are shown and table 3 is still eating with a live bill of 31.00 and no other table is open, When the TV wall shows takings, Then "On open tables" reads 31.00.
- **AC3.1.4** Given takings are shown and nothing has been sold today, When the TV wall shows takings, Then both figures read 0.00, never a blank.
- **AC3.1.5** Given an order is cancelled, When the TV wall shows takings, Then the cancelled order counts in neither figure.

Requirements: FR3.1, FR3.2, FR3.3, NFR6.

### US3.2 — See the busiest table (Must)

As Maria (P1), I want to see which table has ordered the most today, so that I can give it extra attention.

- **AC3.2.1** Given table 5 has 4 orders today and table 2 has 3, When the TV wall shows the busiest table, Then it shows table 5 with 4 orders.
- **AC3.2.2** Given tables 2 and 5 each have 4 orders today, When the TV wall shows the busiest table, Then it shows table 2.
- **AC3.2.3** Given no order has been placed today, When the TV wall shows the busiest table, Then it reads "No orders yet".

Requirements: FR4.1, FR4.2, FR4.3.

### US3.3 — See the top dish (Must)

As Maria (P1), I want to see today's most-ordered dish, so that I know what is selling and can warn the kitchen.

- **AC3.3.1** Given 7 portions of "Margherita" and 5 of "Caesar salad" were ordered today, When the TV wall shows the top dish, Then it shows "Margherita, 7".
- **AC3.3.2** Given "Caesar salad" and "Margherita" each have 7 portions today, When the TV wall shows the top dish, Then it shows "Caesar salad".
- **AC3.3.3** Given no dish has been ordered today, When the TV wall shows the top dish, Then it reads "No dishes yet".

Requirements: FR5.1, FR5.2, FR5.3.

## Group 4 — The hide-takings setting

### US4.1 — Takings start hidden (Must)

As Maria (P1), I want the takings hidden until a staff member chooses to show them, so that diners never see the restaurant's revenue by accident.

- **AC4.1.1** Given the setting has never been changed, When the TV wall opens, Then both takings figures read "Takings hidden".
- **AC4.1.2** Given takings are hidden, When the TV wall's data is inspected in the browser, Then it contains no takings amount.
- **AC4.1.3** Given an existing database from v2 is upgraded, When the TV wall first opens, Then takings are hidden.
- **AC4.1.4** Given a staff member showed the takings, When the server restarts, Then the takings are still shown.

Requirements: FR6.1, FR6.3, NFR5.

### US4.2 — Switch takings on or off from the staff navigation (Must)

As Maria (P1), I want a "Show takings on the TV" switch in the staff navigation, under the "TV wall" link, so that I can show or hide the takings from any staff page.

- **AC4.2.1** Given Maria is signed in on any staff page, When she looks at the staff navigation, Then a "Show takings on the TV" switch sits directly under the "TV wall" link and shows the current setting.
- **AC4.2.2** Given the switch is off, When Maria turns it on, Then every open TV wall shows both takings figures within 2 seconds.
- **AC4.2.3** Given the switch is on, When Maria turns it off, Then every open TV wall shows "Takings hidden" within 2 seconds.
- **AC4.2.4** Given a browser with no staff sign-in, When it tries to change the setting, Then the change is refused and the setting stays as it was.

Requirements: FR6.2, FR6.4, NFR4.

## Group 5 — Staying live and signed in

### US5.1 — The TV keeps itself up to date (Must)

As Sam (P2), I want the TV wall to update by itself when anything changes, so that what I read is what is happening now.

- **AC5.1.1** Given the TV wall is open, When an order is placed, changes status or is cancelled, or a table is closed, Then the TV wall shows the change within 2 seconds for at least 95% of changes.
- **AC5.1.2** Given the live connection drops, When the TV wall notices, Then it keeps the last figures, shows "Reconnecting…" with the time of the last update, and re-reads everything when the connection returns.

Requirements: FR7.1, FR7.2, NFR3.

### US5.2 — The TV stays signed in (Must)

As Maria (P1), I want the TV wall to stay signed in for the whole day, so that nobody has to type the PIN on the TV during service.

- **AC5.2.1** Given the TV wall has been open for 13 hours with no other staff activity, When the next change happens, Then the TV wall shows it and has not returned to the PIN screen.
- **AC5.2.2** Given the server restarts, When the TV wall next talks to the server, Then it shows the staff PIN screen, and after the correct PIN it returns to the TV wall.

Requirements: FR8.1, FR8.2.

### US5.3 — See waiter and bill requests (Could)

As Sam (P2), I want open "call the waiter" and "ask for the bill" requests shown on the TV with their table numbers, so that I can answer them without checking a phone.

- **AC5.3.1** Given table 4 asked for the bill, When the TV wall shows requests, Then it shows "Table 4 — Bill".
- **AC5.3.2** Given the request is answered, When the change happens, Then it leaves the TV wall within 2 seconds.

Requirements: FR9.1.

## Dependencies

- US1.1 comes first: every other story shows its content on the TV wall page.
- US4.1 before US4.2: the switch changes a setting that must exist with its hidden default.
- US3.1 depends on US4.1: takings are only sent while the setting is on.
- All other stories are independent of each other once US1.1 exists.

## Assumptions

- [assumption] At least 8 order rows show at 1920 by 1080 before "+N more" appears; when space is short, the headline figures keep their size and the list gets shorter (review of the requirements, R-02 and R-03).
- [assumption] The 2-second target is one rule: at least 95% of changes appear within 2 seconds (R-04).
- [assumption] "Number of items" means portions, and minutes waited are worked out from the server's clock so a wrong TV clock does not change them (R-06).
- [assumption] Busiest table, top dish and "On open tables" count by the server-local day an order was placed; "Today's takings" counts by the day a table was closed, as on the Sales page (R-05).
- [assumption] The speed target in NFR6 is checked by a test that the TV wall's data read only reads today's rows (R-07).
- [assumption] The TV wall's own data reads count as staff activity, which keeps it signed in; the existing test this changes is listed in the Unit's code summary (R-08, NFR8).
- [assumption] The "Show takings on the TV" switch in the staff navigation is listed as a v1/v2 change next to the "TV wall" link (Q1).
