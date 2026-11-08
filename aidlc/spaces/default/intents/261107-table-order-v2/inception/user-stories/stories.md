# User Stories: Table Order v2

One story per feature (story plan Q2), grouped by feature in the order of the scope document: Must, then Should, then Could (Q3). Story IDs follow the requirement groups in `inception/requirements-analysis/requirements.md`: `US3.1` is the story for requirement group `FR3`, and `AC3.1.2` is the second criterion of that story. Personas are in `personas.md`: Dina the Diner (P1), Kai the Kitchen cook (P2) and Frankie from front of house (P3).

Every story depends only on v1 and on the shared foundation (the design system, the Staff PIN check, the new stored information and the new live events), never on another feature story, so the feature stories can be built in parallel after the foundation. Where a story uses information that Menu management would let staff edit (options, allergens, stations), the seeded data is enough for the story to pass if Menu management slips.

## Must Have

### US1.1 A professional look on every screen

**As** Dina the Diner (and every member of staff who uses a screen), **I want** every screen to share one clear, professional look, **so that** the app feels trustworthy and is easy to read at a glance.

**Priority:** Must Have. **Requirements:** FR1.1, FR1.2, FR1.3, FR1.4, NFR3. **INVEST:** independent of the feature stories (they build on it); testable by comparing each screen with its mockup.

- **AC1.1.1** Given the design system is written down, when a new screen is built, then its colours, type, spacing, corner radius and shadows come from the shared design tokens, with no literal colour value that a token already covers.
- **AC1.1.2** Given any v1 screen (Menu, Cart, My orders, Kitchen Board, Table Bill and Close table), when it is opened, then it matches its new mockup: the same headings, labels, buttons, messages and status words.
- **AC1.1.3** Given any screen, when it is used, then the bottom tab bar with the Cart count, the sticky category pills, 44 px touch areas, frosted bars, reduced-motion support and keyboard access all still work.
- **AC1.1.4** Given a new or changed screen, when it is planned, then a high-fidelity mockup exists first and a mockup-match test compares the built screen with it.

### US3.1 Protect the staff screens with a PIN

**As** Frankie from front of house, **I want** every staff screen and action to need a PIN, **so that** guests cannot move orders, change the menu or close tables.

**Priority:** Must Have. **Requirements:** FR3.1, FR3.2, FR3.3, FR3.4, FR3.5, FR3.6, NFR2. **INVEST:** independent; testable through screens and server answers.

- **AC3.1.1** Given no PIN has been entered, when anyone opens the Kitchen Board, the bill or any new staff page, then only the PIN entry screen shows.
- **AC3.1.2** Given no valid staff session, when a request is made to a staff action or the staff live stream (staff status change, menu availability, menu management, Close table, the bill, the table list, sales, specials), then the server answers 401 `UNAUTHORIZED` and changes nothing; and the diner actions (view the menu, place an order, cancel a Pending order of their own table, see their own table's orders, call the waiter, rate a meal) still work.
- **AC3.1.3** Given a wrong PIN, when it is entered, then a plain message shows and the digits clear; and given 5 wrong tries in a row from one client (counted by the server), when a sixth is made within 60 seconds, then it is refused even if the PIN is right.
- **AC3.1.4** Given `STAFF_PIN=2468` is set, when 2468 is entered, then the staff screens open; and given no `STAFF_PIN`, when the server starts, then it prints a random 4-digit PIN once and no PIN is written in any source file.
- **AC3.1.5** Given a staff session, when the browser is closed or Sign out is chosen, then the PIN is asked for again.
- **AC3.1.6** Given a request to move an order to Preparing, Completed or Cancelled as staff with no staff session, when it is sent, then it is answered 401; and given a diner cancelling their own Pending order, then it still works.

### US4.1 Be told when an order is ready

**As** Dina the Diner, **I want** a clear alert when my order is ready, **so that** I do not have to keep checking the screen. Staff (Kai the Kitchen cook) also get an alert for each new order.

**Priority:** Must Have. **Requirements:** FR4.1, FR4.2, FR4.3, FR4.4, NFR1, NFR7. **INVEST:** independent; testable with two open pages.

- **AC4.1.1** Given a table's page is open, when its order becomes Completed, then a banner shows within 2 seconds, the phone vibrates where it can, and a short sound plays unless muted.
- **AC4.1.2** Given the Kitchen Board is open, when a new order is placed, then an alert banner shows and a short sound plays unless muted, within 2 seconds.
- **AC4.1.3** Given the live stream drops and reconnects and replays old events, or the page is reloaded after an order was Completed, when the page is back, then no banner shows again for events that already happened.
- **AC4.1.4** Given nobody has tapped the page yet or the sound is muted, when an alert arrives, then no sound plays and the banner still shows, and a mute control is always in reach.

### US8.1 Make it yours: choose options on a dish

**As** Dina the Diner, **I want** to choose options such as spice level, size or "no onions" on a dish, **so that** my food arrives the way I like it and the kitchen knows.

**Priority:** Must Have. **Requirements:** FR8.1, FR8.2, FR8.3, FR8.4, FR8.5, FR8.6. **INVEST:** independent; works on seeded options if Menu management slips; testable end to end.

- **AC8.1.1** Given an item with a Large option at +300 cents, when Dina chooses it, then the line price is 300 cents more than the item price.
- **AC8.1.2** Given an item with a required option group, when Dina taps Add without choosing, then Add does not work and the missing choice is named; and given two Burgers, one with "No onions" and one without, then the cart has two lines.
- **AC8.1.3** Given an order with options is placed, when Dina opens My orders, the bill or the sales page, then the same frozen line price with options shows.
- **AC8.1.4** Given an order with "No onions", when Kai opens the Kitchen Board, then "No onions" shows under that item on the ticket.
- **AC8.1.5** Given an option was removed or its price changed after Dina added the item, when the cart opens, then it refreshes with a notice and the new price.

### US9.1 See an honest wait time

**As** Dina the Diner, **I want** to see how long my food will take before and after I order, **so that** I can decide whether to wait and plan my evening.

**Priority:** Must Have. **Requirements:** FR9.1, FR9.2, FR9.3, FR9.4, FR9.5, NFR1. **INVEST:** independent; testable with a known set of durations.

- **AC9.1.1** Given a known set of today's placed-to-Completed times and a known number of open orders, when the estimate is worked out, then it equals the documented formula.
- **AC9.1.2** Given Dina is in the Cart, when the screen opens, then an estimate shows before she places the order; and given an open order, then the estimate shows on its tracker.
- **AC9.1.3** Given an open order has waited longer than its estimate, when Dina looks, then it says "Running late" and never a zero or negative time; otherwise it shows minutes such as "About 12 min".
- **AC9.1.4** Given no order has been completed today, when the estimate shows, then it uses the fixed starting value and says "Estimate", never "0 min".
- **AC9.1.5** Given orders move through the kitchen, when the estimate changes, then every open screen shows the change within 2 seconds.

### US14.1 Watch the order tracker

**As** Dina the Diner, **I want** to see my order move from Pending to Preparing to Completed as a progress bar, **so that** I know where my food is without asking.

**Priority:** Must Have. **Requirements:** FR14.1, FR14.2, FR14.3, FR14.4, NFR3. **INVEST:** independent; testable by moving an order through its steps.

- **AC14.1.1** Given an open order, when Dina opens My orders, then a progress bar shows Pending, Preparing and Completed with the current step highlighted.
- **AC14.1.2** Given the order moves to the next step, when the status changes, then the bar animates to it; and given the device asks for reduced motion, then it changes with no animation.
- **AC14.1.3** Given an open order, when the tracker shows, then the estimated wait from the wait-time story shows beside the bar.
- **AC14.1.4** Given a Cancelled order, when it shows, then it says "Cancelled" and has no progress bar.

### US15.1 See how long each ticket has waited

**As** Kai the Kitchen cook, **I want** each ticket to show how long it has waited and turn amber then red, **so that** I do the oldest orders first.

**Priority:** Must Have. **Requirements:** FR15.1, FR15.2, FR15.3, FR15.4, NFR3. **INVEST:** independent; testable by placing orders at known times.

- **AC15.1.1** Given a Pending or Preparing ticket, when the Kitchen Board shows it, then it shows how long ago the order was placed.
- **AC15.1.2** Given a ticket placed 9 minutes ago and one placed 16 minutes ago, when the board shows them, then the first is amber and the second is red.
- **AC15.1.3** Given an amber or red ticket, when it shows, then the text "Slow" or "Late" also shows, so colour is not the only signal.
- **AC15.1.4** Given a Completed or Cancelled ticket, or a page reload, when the board shows it, then a finished ticket's timer has stopped and the age still counts from the placed time.

## Should Have

### US2.1 Dark mode that follows the device

**As** Dina the Diner (and every member of staff), **I want** the app to follow my device's light or dark setting, with a switch to override it, **so that** it is comfortable to read wherever I am.

**Priority:** Should Have. **Requirements:** FR2.1, FR2.2, FR2.3, FR2.4, NFR3. **INVEST:** depends only on the design system; testable by switching the device scheme. If it slips, the app stays dark only.

- **AC2.1.1** Given the device is set to dark, when any diner or staff screen opens, then the dark theme shows; and given it is set to light, then the light theme shows.
- **AC2.1.2** Given the dark theme, when it is compared with v1, then it uses v1's palette; and a light theme exists for every design token.
- **AC2.1.3** Given Dina chooses Light on a dark device, when the page reloads, then light still shows; and choosing "Follow device" returns to the device setting.
- **AC2.1.4** Given either theme, when text is measured, then body text has a contrast ratio of at least 4.5 to 1, and no status is shown by colour alone.

### US5.1 Review past visits and sales

**As** Frankie from front of house, **I want** to see closed visits by day with totals, best sellers and the average time to Complete, **so that** I know how the day went.

**Priority:** Should Have. **Requirements:** FR5.1, FR5.2, FR5.3, FR5.4, FR5.5. **INVEST:** independent; testable with seeded closed visits.

- **AC5.1.1** Given closed visits on two different days, when Frankie opens the page, then both days show, newest first, each with total sales, visits and orders that add up correctly.
- **AC5.1.2** Given a day's orders, when best sellers show, then they are ranked by quantity sold with ties ordered by item name, and the top item matches the sum of quantities.
- **AC5.1.3** Given orders placed and completed a known number of minutes apart, when the average shows, then it matches; and given a day with no Completed orders, then it says "No completed orders" and not 0.
- **AC5.1.4** Given Cancelled orders, when totals, best sellers and averages are worked out, then Cancelled orders are left out and shown amounts add up to the shown total.
- **AC5.1.5** Given a visit closed at 23:59 and another at 00:01, when the page shows, then they fall on different days; both timestamp formats read correctly; and an empty list says so.

### US6.1 Manage the menu

**As** Frankie from front of house, **I want** to add, edit and hide items and categories, **so that** the menu is always right without a developer.

**Priority:** Should Have. **Requirements:** FR6.1, FR6.2, FR6.3, FR6.4, FR6.5, FR6.6, NFR1, NFR2. **INVEST:** independent; testable with an open Menu on a second device.

- **AC6.1.1** Given Frankie adds an item with a name, description, price, emoji or web address image and category, when it is saved, then it shows on the diner Menu; and a hidden item does not.
- **AC6.1.2** Given Frankie adds, renames, reorders or hides a category, when the Menu opens, then the category shows as a pill only if it has a visible item, and a hidden category hides its items.
- **AC6.1.3** Given a Menu is open on a phone, when Frankie edits a price, then the phone shows the change within 2 seconds with no reload.
- **AC6.1.4** Given an item is hidden or its price edited, when an open visit's bill, a past order or the sales page shows it, then they are unchanged.
- **AC6.1.5** Given an invalid save (no name, a name over 60 characters, or a price outside 1 to 1,000,000 cents), when Frankie saves, then the field is named, what was typed is kept, and any text is shown as text.
- **AC6.1.6** Given Dina's cart holds an item that was hidden or changed, when the cart opens, then the cart-refresh notice shows.

### US10.1 Allergy shield

**As** Dina the Diner, **I want** to set my allergies once and have unsafe dishes marked, **so that** I can order safely.

**Priority:** Should Have. **Requirements:** FR10.1, FR10.2, FR10.3, FR10.4, FR10.5. **INVEST:** independent; works on seeded allergens if Menu management slips; testable on the Menu and Cart.

- **AC10.1.1** Given Dina picks allergies from the fixed list (gluten, dairy, eggs, peanuts, tree nuts, fish, shellfish, soy, sesame), when the page reloads, then they are still set.
- **AC10.1.2** Given an item with no allergen information, when it shows, then it says "Allergens not set" and is never shown as safe.
- **AC10.1.3** Given "dairy" is set, when the Menu shows, then Margherita Pizza is marked unsafe with a label and House Salad is not.
- **AC10.1.4** Given the cart holds an unsafe item, when Dina taps Place order, then the cart names the unsafe items and the order cannot finish without an extra confirmation.
- **AC10.1.5** Given the marks show, when Dina reads the screen, then it says the marks are guidance and to tell the staff about serious allergies.

### US13.1 Kitchen stations

**As** Kai the Kitchen cook, **I want** a board for my station that shows only my dishes, **so that** each station works without the others' clutter, and an order is Completed only when every station is done.

**Priority:** Should Have. **Requirements:** FR13.1, FR13.2, FR13.3, FR13.4, FR13.5. **INVEST:** independent; works on seeded stations if Menu management slips; testable with a mixed order.

- **AC13.1.1** Given every item belongs to one station (Grill, Cold, Bar or Desserts), when an item has none, then it counts as Grill and the page says so.
- **AC13.1.2** Given an order with a Burger and a drink, when the boards show, then the Burger is on the Grill board and the drink on the Bar board, and the All stations view shows the whole order as v1 does.
- **AC13.1.3** Given Grill has finished its part and Bar has not, when the order is checked, then it is still Preparing; and when Bar finishes, then it becomes Completed.
- **AC13.1.4** Given the All stations view, when Kai presses Complete, then every station's remaining part is finished at once, as v1 behaved.
- **AC13.1.5** Given an order with lines for only one station, then it behaves exactly as in v1; and Cancelling stays an order-level action.

### US17.1 Call the waiter or ask for the bill

**As** Dina the Diner, **I want** buttons to call the waiter or ask for the bill, **so that** I get help without flagging anyone down. Frankie (P3) and Kai see and answer the call.

**Priority:** Should Have. **Requirements:** FR17.1, FR17.2, FR17.3, FR17.4, FR17.5, NFR3. **INVEST:** independent; testable with two screens.

- **AC17.1.1** Given a table's page is open, when Dina taps "Call the waiter" or "Ask for the bill", then a request is made for that table.
- **AC17.1.2** Given an open request, when the Kitchen Board or floor map shows that table, then its card pulses with a text label until staff respond; and given reduced motion, then it does not pulse.
- **AC17.1.3** Given an open request, when staff press Respond, then the pulse stops and Dina sees "Help is on the way".
- **AC17.1.4** Given a request is open, when Dina presses the same button again, then no second request is created; and the two requests are independent of each other.
- **AC17.1.5** Given open requests, when the table is closed, then they clear.

## Could Have

### US7.1 Print QR codes for the tables

**As** Frankie from front of house, **I want** a page that prints a QR code for every table, **so that** guests can open their table's menu by scanning.

**Priority:** Could Have. **Requirements:** FR7.1, FR7.2, FR7.3. **INVEST:** independent; testable by decoding the codes.

- **AC7.1.1** Given Frankie opens the QR page at an address, when each code is decoded, then it gives that address followed by `/table/` and the table's number.
- **AC7.1.2** Given the print view, when it is printed, then every table's label and code show, several to a page, with none of the screen's buttons.
- **AC7.1.3** Given no internet connection, when the page opens, then the codes still appear, because they are made inside the app.

### US11.1 Chef's special drop

**As** Frankie from front of house, **I want** to launch a limited special with a countdown and a stock count, **so that** guests see it at once and rush to order it.

**Priority:** Could Have. **Requirements:** FR11.1, FR11.2, FR11.3, FR11.4, FR11.5, NFR4. **INVEST:** independent; testable with a short special.

- **AC11.1.1** Given Frankie launches a special (an existing item, a special price, a stock of 1 to 999 and an end time in the future), when invalid values are entered, then they are refused.
- **AC11.1.2** Given a special is live, when any Menu is open, then it shows the countdown and the stock left, and Dina can add it like any item.
- **AC11.1.3** Given the stock reaches 0 or the end time passes, when whichever comes first happens, then the special disappears from every open Menu within 2 seconds.
- **AC11.1.4** Given one special is left and two diners order it at the same moment, when both orders are placed, then one gets it and the other is told it is gone.
- **AC11.1.5** Given a special is live, when Frankie ends it early or launches another, then only one special runs at a time.

### US12.1 Live floor map

**As** Frankie from front of house, **I want** to see every table coloured by what is happening there, **so that** I know where to go next.

**Priority:** Could Have. **Requirements:** FR12.1, FR12.2, FR12.3, FR12.4, NFR1. **INVEST:** independent; testable by putting a table into each state.

- **AC12.1.1** Given each of five situations (no visit, a diner page open with no order, an order Pending or Preparing, every order Completed, the bill asked for), when the map shows, then each table shows Empty, Browsing, Waiting, Eating or Needs the bill.
- **AC12.1.2** Given a table changes state, when the map is open, then it updates within 2 seconds.
- **AC12.1.3** Given Frankie selects a table on the map, when it opens, then that table's bill shows.
- **AC12.1.4** Given the server provides the list of tables, when the map and the board load, then no screen hard-codes 10 tables.

### US16.1 "Same again"

**As** Dina the Diner, **I want** one tap to add a previous order's items to my cart, **so that** ordering a second round is quick.

**Priority:** Could Have. **Requirements:** FR16.1, FR16.2, FR16.3. **INVEST:** independent; testable on My orders.

- **AC16.1.1** Given a past order on My orders, when Dina taps "Same again", then its items, with the same options, are added to the cart.
- **AC16.1.2** Given an item in that order is sold out, hidden or no longer offered, when "Same again" is tapped, then it is skipped and listed in a notice; the rest use current prices and quantities never go above 20 per line.
- **AC16.1.3** Given the items were added, when the tap finishes, then the Cart tab opens with a notice of what was added.

### US18.1 Rate your meal

**As** Dina the Diner, **I want** to give each dish a thumbs up or down after my table is closed, **so that** the restaurant knows what I liked. Frankie (P3) sees the best and worst dishes.

**Priority:** Could Have. **Requirements:** FR18.1, FR18.2, FR18.3, FR18.4. **INVEST:** independent; testable by closing a table.

- **AC18.1.1** Given a table has just been closed, when Dina's screen shows the closed message, then each dish from that visit has a thumbs up and a thumbs down.
- **AC18.1.2** Given Dina has rated a dish, when she taps the other thumb before leaving the screen, then her rating changes; and there is at most one rating per dish per table visit.
- **AC18.1.3** Given ratings exist today, when Frankie opens Past visits and sales, then the best- and worst-rated dishes show, ranked by share of thumbs up with a stated tie rule and the number of ratings, and an unrated dish is not ranked.
- **AC18.1.4** Given no ratings today, when the page shows, then it says so.

## Keeping v1 Safe

### US19.1 Everything v1 does keeps working

**As** Frankie from front of house using v1 today, **I want** my existing orders, menu, sample data and tests to keep working after the upgrade, **so that** adding features never breaks the restaurant.

**Priority:** Must Have. **Requirements:** FR19.1, FR19.2, FR19.3, FR19.4, FR19.5, NFR4, NFR7, NFR8. **INVEST:** independent; testable by starting v2 on a v1 database file.

- **AC19.1.1** Given v1's unit and browser tests, when the full verification command runs, then they pass; any v1 test that had to change is named with its reason.
- **AC19.1.2** Given a database file made by v1, when v2 starts on it, then every order, visit and item is still there and only new tables and columns with defaults have been added.
- **AC19.1.3** Given an empty database, when v2 starts, then the sample data loads with 10 tables, 4 categories and 12 items.
- **AC19.1.4** Given a new live event, when a page is open, then it receives it, because every new event is registered in the browser's event lists.
- **AC19.1.5** Given the app is run from any folder, including a worktree under `.aidlc/worktrees/`, when a new staff page is opened, then it loads, because page routes serve `index.html` with a `root` setting and new routes come before the catch-all; and every port and the database file come from `PORT`, `E2E_PORT` and `DB_FILE`.
