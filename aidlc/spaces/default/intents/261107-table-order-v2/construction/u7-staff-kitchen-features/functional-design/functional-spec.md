# Functional Specification: u7-staff-kitchen-features

The behaviour of everything new that staff and the kitchen see and do, in the order things happen: the server routes that only staff use and the staff screens on top of them. It is the source of truth for the workflows, the screen states and the state machines of U7; the decision logic is in `rules.md` (rule ids BR1.1 to BR10.3 point there) and the screens and components are in `frontend-components.md`. U7 builds on U5's finished foundation (`construction/u5-foundation/functional-design/`, called "U5 rule 3.8" and so on here), follows the contracts in `inception/contract-design/contract-summary.md` (contracts 2, 3, 4, 7 and 8) and the screens you approved (`inception/refined-mockups/mockups/`: `staff-board`, `staff-station`, `staff-floor`, `staff-menu`, `staff-special`, `staff-sales`, `staff-qr`, `staff-bill`).

The requirements it answers are in `inception/requirements-analysis/requirements.md` (FR1, FR4, FR5, FR6, FR7, FR8, FR10, FR11, FR12, FR13, FR15, FR17, FR18, FR19 and NFR1, NFR2, NFR3, NFR7).

U7 implements, in whole or in part, these stories (from `inception/units-generation/unit-of-work-story-map.md`): US1.1 (its new screens), US4.1 (the new-order alert), US5.1 (past visits and sales), US6.1 (menu management), US7.1 (QR codes), US8.1 (options on the ticket and the bill), US10.1 (staff editing of allergens), US11.1 (the special's staff page), US12.1 (the floor map), US13.1 (kitchen stations), US15.1 (ticket timers), US17.1 (the call pulse and Respond), US18.1 (best and worst rated) and US19.1 (the new staff pages load from any folder, v1's tests stay green).

## What U7 Changes

- **Staff files and its own server modules only.** U7 replaces the bodies of the five stub route modules U5 made (`staff-stations`, `staff-menu`, `staff-floor`, `staff-sales`, `staff-qr`) and never edits `routes/registry.ts`; it fills the staff page files U5 registered (`src/client/staff/pages/*`) and edits the v1 staff screens and components it must change (`KitchenBoardScreen`, `OrderCard`, `useBoardOrders`, `TableBillScreen`, `BillOrderCard`, and the staff hooks). It edits no diner file, no U5 server file, no `orders.ts`, no database schema, no file under `src/shared/` and none of U5's test helpers, and its package changes are limited to the one new package the QR code needs, which U7's code plan names and asks about first. U7's new types live next to its own code (`src/server/routes/` modules and `src/client/staff/`). The `staff-qr.ts` module stays exactly as U5 made it (its stub route is never called, because the codes are drawn in the browser), so no U5 test changes. U6 edits only diner files and one place in `orders.ts`, and adds no package, so the two Units never touch the same file and `package.json` changes only on U7's side.
- **It uses U5's functions** and does not reimplement them: `transitionOrder`, `publishMenuChange`, `getPresence`, `getStaffMenu`, the session guard (the stubs already sit behind it), the shared alert logic, the shared components and the helpers in `src/server/__tests__/helpers/`.
- **A staff route that is missing a session is never reached:** the guard in U5 answers 401 first for every `/api/staff` route.

## Workflows

### W1. A station marks its part done (US13.1; BR1.1 to BR1.6)

1. Staff open a station tab on the Kitchen Board (Grill, Cold, Bar or Desserts). The page reads `GET /api/staff/stations/{station}/board`: every order that is Pending or Preparing, has at least one line for that station, and has no done mark for it, showing only that station's lines with their options.
2. Staff press "<Station> done" on a ticket. The page sends `POST /api/staff/orders/{n}/stations/{station}/done`.
3. In one transaction the server checks the order exists and is Pending or Preparing, that it has lines for that station, and writes the done mark if it is not there already. If the order is Pending it first moves it to Preparing through U5's `transitionOrder` (actor `station`).
4. If every station that has lines in the order now has a done mark, the server moves the order to Completed through `transitionOrder` (which records `completed_at`).
5. After the write the server publishes `STATION_DONE` to staff (with the stations still remaining), and an `ORDER_STATUS_CHANGED` event for each status change it made (Preparing, then Completed), to staff and to the order's table. The diner's ready banner and tracker follow from those events.
6. Marking a station done twice changes nothing and publishes nothing, and answers 200 even when the order has since been Completed (so two cooks pressing the last station at once never see an error). A done mark on an order with no lines for that station is refused, and a first mark on a Completed or Cancelled order is refused.
7. On the All stations tab nothing changes from v1: "Start preparing", "Complete" and "Cancel" are the v1 order-level actions. "Complete" there finishes the order at once, so its remaining station parts need no marks (the boards only list open orders). An order with lines for one station behaves exactly as in v1.

### W2. The Kitchen Board with tickets, timers, the new-order alert and calls (US4.1, US13.1, US15.1, US17.1, US8.1; BR2.x, BR3.x)

1. The board reads the table list from `GET /api/staff/tables` (no screen keeps a fixed number of tables) and each table's open orders as v1 does, and keeps them in line from the live events.
2. Each Pending or Preparing ticket shows how long ago it was placed: green under 8 minutes, amber with the word "Slow" from 8, red with the word "Late" from 15. The count starts at the placed time, so a reload does not restart it, and it updates every 30 seconds. A Completed ticket shows the time it took (placed to completed) and no longer counts. A Cancelled ticket shows "Cancelled" and when it was placed, and no running timer. The board keeps v1's way of reading orders, one table at a time for each table the server lists, which is fine for a restaurant's tables.
3. Each line shows the options chosen under the item name ("Large, Extra cheese, No onions").
4. A new `ORDER_PLACED` event raises a banner "New order #<n> from Table <n>" within 2 seconds, and a short sound unless muted, through U5's alert logic (once per event, never for events from before the page loaded, sound after the first tap). The Sound on / Muted switch is in the page header.
5. A table that has an open request shows its card pulsing with the words "Calling the waiter" or "Asking for the bill" (both can be open at once). "Respond" sends `POST /api/service-calls/{id}/respond`; the pulse stops when the `SERVICE_CALL_RESPONDED` event arrives (or the table closes). Under reduced motion the card does not pulse but the words stay.

### W3. The floor map (US12.1; BR4.1 to BR4.4)

1. The page reads `GET /api/staff/tables`: every table with its label, its state (Empty, Browsing, Waiting, Eating or Needs the bill), the number of diner pages present and its open requests.
2. The server decides the state from the table's open visit, its orders and open requests, and U5's presence count (rule BR4.2). Each table shows the state as a word and a colour.
3. The page refreshes on `ORDER_PLACED`, `ORDER_STATUS_CHANGED`, `TABLE_CLOSED`, `TABLE_PRESENCE_CHANGED`, `SERVICE_CALL_OPENED` and `SERVICE_CALL_RESPONDED` within 2 seconds.
4. Selecting a table opens that table's bill (`/staff/tables/<id>`).

### W4. Menu management (US6.1, US8.1, US10.1, US13.1; BR5.1 to BR5.7)

1. The page reads `GET /api/staff/menu` (hidden items included): a list by category showing each item's station, price, availability and hidden flag, with Edit and Hide/Show.
2. Add or Edit opens the item form: name, description, price (shown in dollars, sent in whole cents), image (an emoji or a web address), category, station, allergens (nine, or "not set") and the option groups (each with a name, a kind, "required" for choose-one, and its choices with a label and a price change).
3. Save sends `POST /api/staff/menu/items` or `PATCH /api/staff/menu/items/{id}`, and `PUT /api/staff/menu/items/{id}/options` for the groups. The server checks every field (BR5.2, BR5.4). An invalid save answers 400 `INVALID_REQUEST` naming the field; the form shows the message beside that field and keeps everything typed.
4. Hide and Show change the item's hidden flag; hiding is not deleting, so past orders, bills and sales keep their frozen prices. An item's name is read from the item as v1 does, so a rename also shows on old lines (the accepted risk recorded in U5). The server makes the ids of new items and categories, and each write answers with the saved item, category or groups.
5. Categories: add, rename, move up or down, hide and show (`POST /api/staff/menu/categories`, `PATCH /api/staff/menu/categories/{id}`). A hidden category hides its items from the diner Menu, and a category shows as a pill only when it has a visible item.
6. After every successful write the server calls U5's `publishMenuChange(reason, ids)`, so every open diner Menu reloads within 2 seconds, and a diner whose cart holds a changed or hidden item gets the cart-refresh notice (the diner side is U6's).
7. A page that cannot load shows "The menu could not be loaded. Try again." with Retry; a save that fails keeps the form.

### W5. The Chef's special page (US11.1; BR6.1 to BR6.3)

1. The page shows the live special with its countdown and stock left, or "No special is live."
2. "Launch" takes an item (a visible, available one), a special price in dollars, a stock from 1 to 999 and minutes from 1 to 720, and sends `POST /api/specials` (U5's route). An invalid value is refused by the server with the field named and the form shows the message beside it.
3. Launching a new special ends the current one (U5). "End special now" sends `DELETE /api/specials/current`.
4. The page follows `SPECIAL_CHANGED`: a special that sells out or runs out of time while the page is open switches to "No special is live." at once.

### W6. Past visits and sales (US5.1, US18.1; BR7.1 to BR7.7)

1. The page reads `GET /api/staff/sales` and `GET /api/staff/ratings?day=<today>`.
2. One card per day, newest first: total sales, number of visits, number of orders, the average minutes from placed to Completed (or "No completed orders"), and the best sellers by quantity with ties by item name. Cancelled orders are left out of every figure.
3. For today the page also shows the best-rated and worst-rated dishes with how many ratings each has; a dish with no ratings is not ranked; with no ratings today it says so.
4. An empty list says "No closed visits yet." A page that cannot load says so with Retry.

### W7. QR codes (US7.1; BR8.1 to BR8.3)

1. The page reads the table list (`GET /api/staff/tables`) and shows a code and the label for each table, made in the browser from the address the page was opened on followed by `/table/<number>`, with no outside service.
2. "Print" prints only the codes and labels, several to a page, with none of the screen's buttons. A note says a phone needs the restaurant's network address, not "localhost".

### W8. Option lines on the bill (US8.1; BR9.1, BR9.2)

1. The Table Bill shows each line's chosen options under the item name (from the bill route, where each line carries its frozen options) and the frozen line price, which already includes the options.
2. Everything else on the bill and Close table stays as v1; closing also clears open requests (U5), so the table's pulse stops.

## State Machines

### Station done mark (per order and station)

| State | Meaning | Moves to |
|---|---|---|
| Open | the station has lines in an open order and no mark | Done (the station is marked done), or gone (the order is Cancelled or Completed) |
| Done | marked; the station's board no longer lists the order | none |

An order's own status follows U5's table: the first mark on a Pending order makes it Preparing; the last mark makes it Completed.

### Floor state of a table (first rule that applies wins)

| State | Applies when |
|---|---|
| Needs the bill | an open "bill" request exists |
| Waiting | an order is Pending or Preparing |
| Eating | the open visit has at least one order that is not Cancelled and none is open |
| Browsing | at least one diner page is present and none of the above applies |
| Empty | none of the above |

### Kitchen ticket timer

| State | Meaning | Moves to |
|---|---|---|
| Green | open, placed under 8 minutes ago | Amber |
| Amber ("Slow") | 8 to 14 minutes | Red |
| Red ("Late") | 15 minutes or more | Stopped |
| Stopped | Completed (shows the time it took) or Cancelled (no timer) | none |

## Business Scenarios

- **Happy path:** A diner places a Classic Burger (Large, no onions) and a Fresh Orange Juice. Kai sees the ticket on the Grill board with "Large, no onions" and on the Bar board with the juice. Grill is marked done: the order becomes Preparing. Bar is marked done: it becomes Completed, the diner's banner shows. Frankie adds a new item, a price edit reaches open menus in 2 seconds, launches a special, and prints the QR codes.
- **Unhappy path:** A second press of "Bar done" changes nothing. A save with a 61-character name is refused with the field named and the typed text kept. A launch with stock 0 is refused. An item is hidden while a diner's cart holds it: the diner is told, the bill of the open visit is unchanged.
- **Concurrency:** Two cooks press the last station's done at the same moment: one makes the order Completed and the other changes nothing and publishes nothing.

## Assumptions & Open Questions

- Validation limits (this settles Contract Design's open question 3): an item name and a category name 1 to 60 characters (category names unique ignoring case); a description up to 300 characters; an image either empty, a short emoji of at most 8 characters, or an `http://` or `https://` address up to 500 characters; at most 6 option groups per item, 12 choices per group, group and choice names up to 60 characters, a price change a whole number of cents from -100,000 to 100,000; and the cheapest possible line price (the price plus the lowest choices) never below zero.
- Best and worst rated: ranked by the share of thumbs up; ties are broken by the larger number of ratings, then by item name; the page shows the top 3 of each.
- A Cancelled ticket shows "Cancelled" and when it was placed, with no running timer, because the app stores no cancel time; a Completed ticket shows the time it took. This is the one place AC15.1.4's "the age still counts from the placed time" is met only in part for a Cancelled ticket.
- Best and worst rated use the day a rating was made, and the sales cards use the day a visit closed, so the two can differ near midnight; that is intended. `from` and `to` on the sales route are inclusive local dates.
- The special's launch form checks that the special price plus the item's cheapest options is not below zero, on the page only, because the launch route is U5's; a request sent by hand could still make such a special (accepted).
- A day on the sales page is the day a visit was closed, in the server's local time; the orders and sales of that visit count on that day.
- The Kitchen Board's station tabs live on the board page itself. The separate station page that U5 registered (`stations/:station`) shows the same station board and is reachable by link; both read the same route.
- The new package for QR codes (the only new package of the whole of v2) is named in U7's code plan, which asks you before anything is installed.
