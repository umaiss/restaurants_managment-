# Requirements: Table Order v2

This document turns the intent statement (`ideation/intent-capture/intent-statement.md`), the scope document (`ideation/scope-definition/scope-document.md`) and the code knowledge base of v1 (`aidlc/spaces/default/codekb/table-order/business-overview.md`, `architecture.md`, `code-structure.md`) into testable requirements. Each requirement ends with where it comes from:
- **IC-Q1, IC-Q2, IC-Q3**: your feature picks in Intent Capture.
- **SD-Q1, SD-Q2, SD-Q3**: your Scope Definition answers.
- **RA-Q1 to RA-Q4**: your answers in this stage (`requirements-analysis-questions.md`).
- **Scope**: the scope document (Must / Should / Could ranking and "Changes to v1").
- **v1**: how v1 works today, from the code knowledge base.
- **Assumption A1 to A20**: a choice I made, listed under Assumptions for you to accept or change.

## Intent Analysis

- **Goal:** turn the signed-off Table Order v1 into a product a restaurant would choose over its competitors, by adding 17 chosen features and a professional look on every screen (IC-Q1, IC-Q2, IC-Q3, SD-Q2).
- **Type:** enhancement of an existing app (brownfield), 17 features plus a design change, across the diner screens, the kitchen board, the bill screen and a set of new staff pages.
- **Scope and complexity:** system-wide and complex. Almost every v1 screen and the server's order flow are touched, so protecting v1 (FR19) is a requirement in its own right.
- **Priority:** Must / Should / Could as ranked in the scope document (SD-Q1). Must: Staff PIN, Notifications, Make it yours, Honest wait time, Animated order tracker, Kitchen ticket timers, and the new look on every screen. Should: Past visits and sales, Menu management, Allergy shield, Kitchen stations, Dark mode, Call the waiter / Ask for the bill. Could: QR codes, Chef's special drop, Live floor map, "Same again", Rate your meal.
- **Deployment shape:** one restaurant, run locally (`npm install && npm start`, http://localhost:3000), several diners' phones and a few staff screens on one network, one server process, one SQLite file (v1, Assumption A1).

## Functional Requirements

### FR1 Design system and new look (Must; SD-Q2, Scope)

- **FR1.1** A small design system is written down once and used everywhere: colours, a type scale, a spacing scale, corner radius, shadows and the reusable components (buttons, cards, pills, banners, tab bar). Pass: one design-system document and one set of design tokens exist, and a new screen can be built from them without a literal colour. (SD-Q2)
- **FR1.2** Every v1 screen (Menu, Cart, My orders, Kitchen Board, Table Bill and Close table) and every new screen takes its colours, type, spacing, radius and shadows from the design system. Pass: the mockup-match test for each screen matches its new mockup, and no component styles itself with a literal colour value that the tokens already cover. (SD-Q2, v1: about 143 literal colour values in the client code today)
- **FR1.3** What v1 got right stays, on every screen: the bottom tab bar with the Cart count, the sticky category pills, 44 px touch areas, frosted bars, reduced-motion support and keyboard access. Pass: the v1 tests that check them still pass. (Scope, v1)
- **FR1.4** New screens are designed as high-fidelity mockups first, in this record, and the built screen matches its mockup. Pass: a mockup-match test exists for every new or changed screen. (Scope, v1 rule)

### FR2 Dark mode (Should; IC-Q3, RA-Q4)

- **FR2.1** The app follows the device's light or dark setting. Pass: with the device set to dark the dark theme shows; set to light, the light theme shows, on every diner and staff screen. (RA-Q4)
- **FR2.2** v1's current dark look becomes the dark theme, and a new light theme is added. Pass: the dark theme uses v1's palette in the design tokens; a light theme exists for every token. (RA-Q4)
- **FR2.3** A manual toggle overrides the device setting and the choice is remembered in that browser. Pass: choosing Light on a dark device shows light after a reload; choosing "Follow device" returns to the device setting. (IC-Q3, Assumption A2)
- **FR2.4** Both themes keep readable text. Pass: body text has a contrast ratio of at least 4.5 to 1 against its background in both themes, and status is never shown by colour alone. (NFR3)

### FR3 Staff PIN (Must; IC-Q1, RA-Q1)

- **FR3.1** Every staff screen asks for a PIN before it opens: the Kitchen Board, the Table Bill and Close table, the menu availability panel, and every new staff page. Pass: opening any staff address with no PIN shows the PIN entry screen and nothing else. (RA-Q1)
- **FR3.2** The server checks the PIN on every staff action and every staff live stream, not only on the screen. Pass: a staff request with no valid PIN (staff order status change, menu availability, menu management, Close table, the bill, the staff live stream, the table list, sales, specials, ratings summary) is answered 401 `UNAUTHORIZED` and changes nothing. Diner actions (view the menu, place an order, cancel a Pending order, see their own table's orders, the table live stream, call the waiter, rate a meal) stay open. (RA-Q1, v1: no auth today, the server trusts the `by` field)
- **FR3.3** A wrong PIN is refused with a plain message and the entered digits are cleared. After 5 wrong tries in a row from one browser the screen waits 60 seconds before it accepts another try. Pass: the sixth try inside 60 seconds is refused even with the right PIN. (Assumption A3)
- **FR3.4** The PIN is read from the environment (`STAFF_PIN`), never written in the code. When it is not set, the server makes a random 4-digit PIN at start and prints it once on the console. Pass: no source file holds a PIN; with `STAFF_PIN=2468` only 2468 opens the staff screens. (Assumption A3)
- **FR3.5** A correct PIN opens a staff session that lasts until the browser is closed, and staff can sign out. Pass: after sign-out the PIN is asked again. (Assumption A3)
- **FR3.6** The server decides who is acting. A status change to Preparing, Completed or Cancelled as staff needs the staff session; the `by` field in the request is no longer trusted for staff changes. Pass: a request with `by: "staff"` and no staff session is answered 401, and a diner cancelling their own Pending order still works. (v1, RA-Q1)

### FR4 Notifications (Must; IC-Q1)

- **FR4.1** When an order becomes Completed (ready), the diner at that table sees a banner. If the device allows it the phone also vibrates, and a short sound plays unless the diner has muted it. Pass: with a table open and an order moved to Completed, the banner shows within 2 seconds. (IC-Q1, Assumption A4)
- **FR4.2** When a new order arrives, staff on the Kitchen Board see an alert banner and hear a short sound unless they have muted it. Pass: a new order placed from a phone raises the alert on an open board within 2 seconds. (IC-Q1, Assumption A4)
- **FR4.3** A notification is shown once per event. Pass: after a live-stream reconnect that replays old events, no old notification shows again. (v1: event replay on reconnect)
- **FR4.4** Sound and vibration only start after the person has tapped something on the page, as browsers require, and a mute control is always in reach. Pass: a muted device makes no sound; the banner still shows. (Assumption A4)

### FR5 Past visits and sales (Should; IC-Q1)

- **FR5.1** A staff page lists closed visits by day, newest day first, with each day's total sales, number of visits and number of orders. Pass: with seeded closed visits on two days, both days show with correct totals. (IC-Q1)
- **FR5.2** Each day shows its best-selling items, ranked by quantity sold, with a stated tie rule (ties are ordered by item name). Pass: the top item matches the sum of quantities in the day's orders. (IC-Q1)
- **FR5.3** Each day shows the average time from an order being placed to it being Completed, in minutes. Pass: for orders placed and completed a known number of minutes apart, the average matches. A day with no Completed orders shows "No completed orders" instead of 0. (IC-Q1)
- **FR5.4** Cancelled orders are left out of totals, best sellers and averages, as they are left off the bill in v1. Money is shown in whole cents converted for display, and the shown parts add up to the shown total. (v1)
- **FR5.5** Days are cut at midnight in the server's local time, and both timestamp formats v1 stores (database text and ISO text) are read correctly. Pass: a visit closed at 23:59 and one at 00:01 land on different days. An empty list says so. (v1, Assumption A5)

### FR6 Menu management (Should; IC-Q1)

- **FR6.1** Staff can add, edit and hide menu items: name, description, price, image and category. The image is an emoji or a web address; uploading files is not part of this. Pass: an added item shows on the diner Menu; a hidden item does not. (IC-Q1, Assumption A6)
- **FR6.2** Staff can add, rename, reorder and hide categories. Pass: a new category shows as a pill on the Menu once it has a visible item; a hidden category hides its items from the Menu. (IC-Q1)
- **FR6.3** Changes reach open diner menus live, within 2 seconds, with no reload. Pass: with a Menu open on a phone, a price edit shows without a refresh. (IC-Q1)
- **FR6.4** Hiding is not deleting: a hidden item stays in past orders, bills and sales. A price change never changes an order already placed. Pass: the bill of an open visit is unchanged after its item's price is edited. (v1: prices are frozen at order time)
- **FR6.5** Input is checked on the server: a name is required and at most 60 characters, a price is a whole number of cents from 1 to 1,000,000, and text is shown as text, never as markup. An invalid save names the field and keeps what was typed. (NFR2)
- **FR6.6** A diner whose cart holds an item that was hidden or changed gets the same cart-refresh notice v1 shows for items no longer on the menu. (v1)

### FR7 QR codes (Could; IC-Q1)

- **FR7.1** A staff page lists every table with a QR code that opens `/table/<id>` for that table. The address in the code is built from the address the staff page was opened on. Pass: decoding each code gives `<that address>/table/<id>`. (IC-Q1, Assumption A7)
- **FR7.2** The page prints cleanly: one code per table with the table's label, several per page. Pass: the print view shows every table's label and code and none of the screen's buttons. (IC-Q1)
- **FR7.3** QR codes are made inside the app, with no outside service. (Scope: out of scope: paid external services)

### FR8 Make it yours (Must; IC-Q2)

- **FR8.1** An item can have options: a choice of one (for example spice level, size), a choice of several (for example extra cheese), or a "no" choice (for example no onions). Each choice can change the price by a whole number of cents, up or down from the item price. Pass: an item with a Large option at +300 shows 300 cents more. (IC-Q2, Assumption A8)
- **FR8.2** A diner chooses options on the Menu before adding the item. A group marked required must be chosen before "Add" works. The same item with different options is a separate cart line. Pass: two Burgers, one with no onions and one without, make two lines. (IC-Q2)
- **FR8.3** The line price is the item price plus the chosen options, frozen when the order is placed. Cart, My orders, bill and the sales page all show it. Pass: the bill total equals the sum of frozen line prices with options. (IC-Q2, v1)
- **FR8.4** The kitchen ticket shows every chosen option under its item. Pass: a placed order with "No onions" shows "No onions" on its Kitchen Board card. (IC-Q2)
- **FR8.5** Staff define options in Menu management, and some seeded items have options so the feature can be shown. The seeded item, category and table counts stay as v1 has them. (FR6, FR19.3)
- **FR8.6** If an option is removed or its price changed after the diner added it, the cart refreshes with a notice and the new price, as v1 does for item prices. (v1)

### FR9 Honest wait time (Must; IC-Q2, RA-Q2)

- **FR9.1** The estimate is worked out from how long today's completed orders took from placed to Completed and from how busy the kitchen is right now (open Pending and Preparing orders). Pass: with a known set of today's durations and open orders, the estimate equals the documented formula. (IC-Q2, Assumption A9)
- **FR9.2** It shows in the cart before the diner places the order, and on the order tracker for each open order. (IC-Q2, IC-Q3)
- **FR9.3** It shows as minutes, for example "About 12 min", and as "Running late" once an open order has been waiting longer than its own estimate. Pass: an order older than its estimate shows "Running late" and not a negative or zero time. (RA-Q2)
- **FR9.4** With no completed orders today the estimate uses a fixed starting value and says "Estimate", never "0 min". It is always labelled as an estimate, not a promise. (Assumption A9, corner: unknown is not zero)
- **FR9.5** The estimate updates live as orders move, within 2 seconds. (v1: live updates)

### FR10 Allergy shield (Should; IC-Q2)

- **FR10.1** A diner sets their allergies once and the choice is remembered in that browser. The list is fixed: gluten, dairy, eggs, peanuts, tree nuts, fish, shellfish, soy and sesame. Pass: after a reload the same allergies are still set. (IC-Q2, Assumption A10)
- **FR10.2** Each item carries the allergens it contains. Staff set them in Menu management, and the seeded items have them. An item with no allergen information is shown as "Allergens not set", never as safe. (IC-Q2, Assumption A10)
- **FR10.3** On the Menu, items that contain a diner's allergen are marked unsafe with a label, not only a colour. Pass: with "dairy" set, Margherita Pizza is marked and House Salad is not. (IC-Q2)
- **FR10.4** Before an order with an unsafe item is placed, the cart warns and names the items, and the diner must confirm to go on. Pass: Place order with an unsafe line cannot finish without the extra confirmation. (IC-Q2)
- **FR10.5** The marks help the diner but are not a promise; the screen says to tell the staff about serious allergies. (Assumption A10)

### FR11 Chef's special drop (Could; IC-Q2)

- **FR11.1** Staff launch a special: an existing menu item, a special price, a stock count and an end time. Pass: only valid stock (1 to 999) and an end time in the future are accepted. (IC-Q2, Assumption A11)
- **FR11.2** The special shows live on every open Menu with a countdown and the stock left, and a diner can add it like any item. (IC-Q2)
- **FR11.3** It disappears from every open Menu when the stock reaches 0 or the time runs out, whichever is first, within 2 seconds. Pass: selling the last one removes it everywhere. (IC-Q2)
- **FR11.4** Stock is never oversold: when two diners order the last one at the same moment, one gets it and the other is told it is gone, using the same "dropped line" message v1 shows for sold-out items. (v1, corner: two actors at once)
- **FR11.5** Only one special runs at a time, and staff can end it early. (Assumption A11)

### FR12 Live floor map (Could; IC-Q2)

- **FR12.1** A staff page shows every table, each coloured and labelled by what is happening: Empty, Browsing, Waiting, Eating, Needs the bill. Pass: each of the five states can be shown by setting up its situation. (IC-Q2, Assumption A12)
- **FR12.2** The map updates live, within 2 seconds. (IC-Q2)
- **FR12.3** Selecting a table opens its bill. (v1: bill screen)
- **FR12.4** The server provides the list of tables, so no screen needs to hard-code 10 tables. (v1: the board hard-codes 10 tables)

### FR13 Kitchen stations (Should; IC-Q2, SD-Q3)

- **FR13.1** Every item belongs to one station: Grill, Cold, Bar or Desserts. Staff set it in Menu management, and the seeded items have one. An item with no station is treated as Grill and the page says so. (IC-Q2, Assumption A13)
- **FR13.2** Each station has its own board showing only that station's lines of each open order. The v1 board stays as an "All stations" view. Pass: an order with a burger and a drink shows the burger on Grill and the drink on Bar. (SD-Q3)
- **FR13.3** A station marks its part done. An order becomes Completed only when every station that has lines in it has finished. Pass: with Grill done and Bar not, the order is still Preparing. (IC-Q2, SD-Q3)
- **FR13.4** On the All stations view, the v1 Complete button finishes every station's remaining part at once, so v1 behaviour and its tests still work. (SD-Q3, v1)
- **FR13.5** An order with lines for only one station behaves exactly as in v1. Cancelling stays an order-level action. (v1)

### FR14 Animated order tracker (Must; IC-Q3)

- **FR14.1** On My orders each open order shows Pending, then Preparing, then Completed as a progress bar with the current step highlighted. (IC-Q3)
- **FR14.2** The bar animates when the step changes. Pass: with reduced motion set, it changes with no animation. (IC-Q3, NFR3)
- **FR14.3** It shows the estimated wait from FR9 beside the bar. (IC-Q3, RA-Q2)
- **FR14.4** A Cancelled order shows "Cancelled" and no progress bar. (v1: statuses)

### FR15 Kitchen ticket timers (Must; IC-Q3)

- **FR15.1** Every Pending or Preparing ticket shows how long ago it was placed. (IC-Q3)
- **FR15.2** The ticket turns amber at 8 minutes and red at 15 minutes. Pass: a ticket placed 9 minutes ago is amber and one placed 16 minutes ago is red. (IC-Q3, Assumption A14)
- **FR15.3** Colour is never the only signal: amber shows "Slow" and red shows "Late" as text. (NFR3)
- **FR15.4** Completed and Cancelled tickets stop their timer. The timer counts from the order's placed time, so a reload does not restart it. (v1: `placed_at`)

### FR16 "Same again" (Could; IC-Q3)

- **FR16.1** On My orders each past order has a "Same again" button that adds its items, with the same options, to the cart in one tap. (IC-Q3)
- **FR16.2** Items sold out, hidden or no longer offered are skipped and listed in a notice. Prices are the current ones. Quantities never go above 20 per line. (v1, FR6.4)
- **FR16.3** After adding, the diner is taken to the Cart with a notice of what was added. (Assumption A15)

### FR17 Call the waiter / Ask for the bill (Should; IC-Q3)

- **FR17.1** A diner can press "Call the waiter" or "Ask for the bill" from their table screen. (IC-Q3)
- **FR17.2** The table's card pulses on the Kitchen Board and on the floor map until a staff member responds. The pulse also has a text label, and stops with reduced motion. (IC-Q3, NFR3)
- **FR17.3** Staff press Respond to clear it; the diner then sees that help is on the way. (Assumption A16)
- **FR17.4** Pressing again while a request is open creates no second request. The two requests are independent of each other. (v1: idempotent placement)
- **FR17.5** Open requests clear when the table is closed. (v1: Close table)

### FR18 Rate your meal (Could; IC-Q3, RA-Q3)

- **FR18.1** After a table is closed, the diner sees each dish from that visit with one-tap thumbs up and thumbs down. (IC-Q3, RA-Q3)
- **FR18.2** A diner gives at most one rating per dish per visit and can change it until they leave the screen. (Assumption A17)
- **FR18.3** Staff see today's best-rated and worst-rated dishes on the Past visits and sales page, ranked by share of thumbs up with a stated tie rule, and showing how many ratings each has. A dish with no ratings is not ranked. (IC-Q3, Assumption A17)
- **FR18.4** With no ratings today the page says so. (corner: empty list)

### FR19 Keeping v1 safe (Must; Scope, project rules)

- **FR19.1** Every v1 behaviour that is not in the "Changes to v1" table of the scope document is unchanged. Pass: v1's unit and browser tests still pass; any v1 test that must change is named with its reason. (Scope)
- **FR19.2** Database changes only add: new tables, or new columns with defaults. Existing v1 data is kept. Pass: a database file made by v1 starts under v2 with all its orders intact. (v1: no migrations today)
- **FR19.3** v1's sample data still loads, with 10 tables, 4 categories and 12 items. (v1: `db.test.ts`)
- **FR19.4** Every new live event is registered in the browser's event lists, because the browser ignores event types that are not listed. (v1)
- **FR19.5** Server routes for new pages are added before the page catch-all, and the page route serves `index.html` with a `root` setting so it works from any folder. (v1, project rule)

## Non-Functional Requirements

- **NFR1 Speed.** A live change (new order, status change, menu change, special, call) shows on every open screen within 2 seconds, as v1 does. Every API answer comes back within 300 ms on a developer laptop with the seed data. (v1)
- **NFR2 Security.** The Staff PIN is checked on the server (FR3). No PIN or other secret is in the source or the logs. All input is checked on the server and shown as text. Staff routes answer 401 without a session. (project rule: no hard-coded secrets, validate at boundaries)
- **NFR3 Accessibility.** Every function works with the keyboard. Touch areas are at least 44 px. Text contrast is at least 4.5 to 1 in both themes. Status never relies on colour alone. All motion (tracker, pulse, countdown, theme change) stops when the device asks for reduced motion. (v1, project rule)
- **NFR4 Data safety.** Database changes are additive and safe to run twice. Special stock and order numbers cannot be oversold or duplicated when two people act at once. (FR19.2, FR11.4, v1)
- **NFR5 Browsers.** The app works in Chromium, Google Chrome and WebKit (Safari's engine). Firefox is not tested. (project rule)
- **NFR6 Tests.** `npm test && npm run test:e2e` passes with v1's tests and v2's together. Every Unit has browser tests for its main flows, and every new or changed screen has a mockup-match test. No coverage limit or time limit is lowered. (project rule)
- **NFR7 Reliability.** After a live-stream reconnect, every screen reloads its data so missed events leave nothing stale, and no notification repeats. (v1, FR4.3)
- **NFR8 Running locally.** The app starts with `npm install && npm start` at http://localhost:3000. Every port and the database file come from `PORT`, `E2E_PORT` and `DB_FILE`, so parallel builds never share either. (project rule)

## Constraints

- Same stack as v1: React single-page app, Node.js with Express, SQLite, Server-Sent Events. (v1)
- No payments, native apps, cloud deployment, diner accounts, email or SMS, or paid outside service. (Scope)
- v1's records and mockups are never edited; v2 writes its own. v1's tests stay in the suite. (project rule)
- The work is built as a shared foundation first, then two feature groups in parallel that depend only on v1 and the foundation, never on each other. (project rule, Scope)
- Hand-in is due Tuesday 10 November 2026, end of day. Today is Saturday 7 November 2026, so the Could items are expected to slip first. (Scope, SD-Q1)

## Assumptions

These are my recommended choices for points your answers and the brief leave open. Accept them in one reply at the approval, or tell me which to turn into a question.

- **A1** One restaurant, one server process, one SQLite file; no sign-in for diners; the table number in the address identifies the diner.
- **A2** The Dark mode toggle has three choices: Follow device, Light, Dark, and sits in the app header on every screen.
- **A3** One shared staff PIN of 4 digits, set with `STAFF_PIN`; 5 wrong tries lock that browser for 60 seconds; the session lasts until the browser closes.
- **A4** "Ready" means the order is Completed. Notification sound is a short beep; vibration is a short buzz where the device supports it; both can be muted.
- **A5** A "day" runs midnight to midnight in the server's local time.
- **A6** Menu images stay emoji or a web address; file uploads are out of scope.
- **A7** QR codes use the address staff opened the QR page on (for example `http://localhost:3000`); for phones to scan them, staff open the page using the machine's network address.
- **A8** Option groups are of three kinds (choose one, choose several, remove an ingredient). Seeded options go on a few items (for example the Burger and the Pizza).
- **A9** The wait estimate is the average of today's placed-to-Completed times, plus a small allowance for each order ahead in the kitchen; with no data it starts at a fixed 15 minutes and is labelled "Estimate".
- **A10** The allergen list is the nine listed in FR10.1; the seeded items get plausible allergens; marks are guidance, not a promise.
- **A11** Only one Chef's special at a time; a special is an existing item at a new price.
- **A12** "Browsing" means a diner screen for that table is open with no order yet; "Waiting" means an order is Pending or Preparing; "Eating" means every order is Completed; "Needs the bill" means the diner asked for the bill.
- **A13** Seeded stations: the two salads are Cold; Garlic Bread and every main (Burger, Salmon, Pizza, Pasta) are Grill; the two desserts are Desserts; the three drinks are Bar. An item with no station counts as Grill.
- **A14** Ticket timer limits are 8 minutes (amber) and 15 minutes (red).
- **A15** "Same again" adds to the cart and opens the Cart tab.
- **A16** Responding to a call clears the pulse; the diner sees "Help is on the way".
- **A17** The rating rank is the share of thumbs up, needing at least 1 rating; the page shows the counts.
- **A18** The kitchen board's new alert sound and the diner's ready sound are the same short beep.
- **A19** The Staff PIN screen is one shared screen for all staff addresses; signing out is a link in the staff header.
- **A20** The estimate is shown per order on the tracker and once in the cart for the order about to be placed.

## Out of Scope

- Payments, native mobile apps, cloud deployment, diner accounts, email or SMS, and any paid outside service. (Scope)
- Multi-language, Shared table cart and Manager TV wall, which were not picked. (IC-Q1, IC-Q2, IC-Q3)
- Menu image file uploads. (Assumption A6)
- Changing v1's records or mockups. (project rule)

## Open Questions

- The exact words, layout and look of each new screen are for Refined Mockups.
- Where each new live event, table and route goes, and how the work is split into Units, is for Domain Design, Units Generation and Contract Design.
- The estimate formula's allowance per order ahead (A9) can be tuned in Functional Design once the data is known.
