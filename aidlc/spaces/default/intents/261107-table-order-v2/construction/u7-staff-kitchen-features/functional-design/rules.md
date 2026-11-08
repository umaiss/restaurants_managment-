# Business Rules: u7-staff-kitchen-features

The decision logic of the staff and kitchen features, built from the requirements (`inception/requirements-analysis/requirements.md`), the stories (`inception/user-stories/stories.md`), the component catalogue (`inception/domain-design/components.md`), the contracts (`inception/contract-design/contract-summary.md`) and U5's finished rules (`construction/u5-foundation/functional-design/rules.md`, called "U5 rule 3.8" and so on here). Every staff route here sits behind U5's staff guard, so a request without a session never reaches these rules (401 first). The rules settle Contract Design's open question 3 (validation limits). No code or SQL.

```yaml
rules:
  - id: BR1.1
    statement: "A station's board lists only open orders that have lines for that station and no done mark for it, with only that station's lines."
    category: policy
    applies_to: KitchenStations
    trigger: "Reading a station's board"
    logic: "Stations are Grill, Cold, Bar and Desserts; any other value answers 404 UNKNOWN_STATION. An order is listed when its status is Pending or Preparing, at least one of its lines has this station, and no done mark exists for (order, station). Each listed order shows only this station's lines with their frozen options, its table, its placed time and its status. A line frozen with no station counts as Grill (U5 rule 3.3)."
    violation: "404 UNKNOWN_STATION."
    source: "FR13.2, FR13.1"
  - id: BR1.2
    statement: "Marking a station done writes one mark, moves a Pending order to Preparing, and completes the order when every station with lines is done."
    category: policy
    applies_to: KitchenStations
    trigger: "POST station done"
    logic: "In one transaction, in this order: the order must exist (404 UNKNOWN_ORDER); the order must have lines for the station (else 422 NO_LINES_FOR_STATION); IF the mark already exists THEN change nothing, publish nothing and answer 200 with the current state, even when the order has since become Completed (so a second press, or the second of two cooks, is never an error); OTHERWISE the order must be Pending or Preparing (else 422 ILLEGAL_TRANSITION) and the mark is written. IF the order is Pending THEN move it to Preparing through U5's transitionOrder with actor station. IF every station that has lines in the order now has a mark THEN move it to Completed through transitionOrder (which sets completed_at). The answer is 200 with the order's status and the stations done and remaining."
    violation: "404 UNKNOWN_ORDER, 422 ILLEGAL_TRANSITION or 422 NO_LINES_FOR_STATION; nothing is written."
    source: "FR13.3, FR13.5"
  - id: BR1.3
    statement: "A done mark publishes STATION_DONE and one status event for each status change it made, after the write."
    category: policy
    applies_to: KitchenStations
    trigger: "A station done that changed something"
    logic: "After the transaction succeeds, publish STATION_DONE to staff with the order, table, station and the stations remaining; then publish ORDER_STATUS_CHANGED (with completed_at when Completed) to staff and the order's table for each status change in the order it happened (Preparing, then Completed). A repeated mark publishes nothing."
    violation: "Not applicable."
    source: "FR13.3, FR4.1"
  - id: BR1.4
    statement: "On the All stations view, Start preparing, Complete and Cancel are v1's order-level actions and need no done marks."
    category: constraint
    applies_to: KitchenStations
    trigger: "Using the All stations view"
    logic: "These actions use U5's order status route as v1 did. Complete finishes the order at once; the boards list only open orders, so no marks are needed for the remaining stations. Cancelling is always an order-level action and removes the order from every board. An order whose lines are all for one station behaves exactly as in v1."
    violation: "Not applicable."
    source: "FR13.4, FR13.5"
  - id: BR1.5
    statement: "The page says that an item with no station counts as Grill."
    category: policy
    applies_to: MenuManagement
    trigger: "Showing an item's station"
    logic: "An item with no station is shown under Grill with the note 'No station set: counts as Grill'."
    violation: "Not applicable."
    source: "FR13.1"
  - id: BR2.1
    statement: "A ticket's timer counts from its placed time and is green under 8 minutes, amber with 'Slow' from 8, and red with 'Late' from 15."
    category: calculation
    applies_to: KitchenBoard
    trigger: "Showing a Pending or Preparing ticket"
    logic: "elapsed = whole minutes since placed_at. Under 8: green. 8 to 14: amber and the word 'Slow'. 15 or more: red and the word 'Late'. The text is shown with the colour, never colour alone. It updates every 30 seconds and a reload does not restart it. The thresholds are named constants in one place."
    violation: "Not applicable."
    source: "FR15.1, FR15.2, FR15.3"
  - id: BR2.2
    statement: "A finished ticket stops its timer."
    category: policy
    applies_to: KitchenBoard
    trigger: "Showing a Completed or Cancelled ticket"
    logic: "A Completed ticket shows the minutes from placed_at to completed_at and does not count on. A Completed order with no completed_at (placed before v2) shows no time. A Cancelled ticket shows 'Cancelled' and 'placed <time>' and no running timer (the app stores no cancel time, so there is nothing to stop a count at)."
    violation: "Not applicable."
    source: "FR15.4"
  - id: BR2.3
    statement: "Chosen options show under each item on the ticket and on the station board."
    category: policy
    applies_to: KitchenBoard
    trigger: "Showing an order line"
    logic: "Each line shows its chosen options in the order they were chosen, as text, under the item name."
    violation: "Not applicable."
    source: "FR8.4"
  - id: BR3.1
    statement: "A new order raises a banner once, with sound unless muted, and the mute switch is in the header."
    category: policy
    applies_to: KitchenBoard
    trigger: "An ORDER_PLACED event on the staff stream"
    logic: "Through U5's alert logic: the banner 'New order #<n> from Table <n>' shows within 2 seconds; a short sound plays only after the first tap on the page and when sound is not muted; an event seen before, or older than the page load, raises nothing. The Sound on / Muted switch in the page header uses U5's sound preference."
    violation: "Not applicable."
    source: "FR4.2, FR4.3, FR4.4"
  - id: BR3.2
    statement: "A table with an open request pulses with words until staff respond."
    category: policy
    applies_to: KitchenBoard
    trigger: "An open service call, SERVICE_CALL_OPENED, SERVICE_CALL_RESPONDED, TABLE_CLOSED"
    logic: "A table card with an open 'waiter' request shows 'Calling the waiter' and with an open 'bill' request 'Asking for the bill', both when both are open, with a pulse. 'Respond' sends the respond route; the pulse stops when the response event arrives. Under reduced motion there is no pulse and the words stay. A TABLE_CLOSED event clears the table's requests on the screen."
    violation: "Not applicable."
    source: "FR17.2, FR17.3"
  - id: BR4.1
    statement: "The server provides the list of tables, and no screen keeps a fixed number."
    category: policy
    applies_to: FloorStatus
    trigger: "GET /api/staff/tables"
    logic: "Return every table in order with its id, label, floor state, number of diner pages present (U5's getPresence), the latest sign of life, and its open requests (id, kind, opened time). The Kitchen Board, the floor map and the QR page read it instead of assuming 10 tables."
    violation: "Not applicable."
    source: "FR12.4"
  - id: BR4.2
    statement: "A table's floor state is the first of Needs the bill, Waiting, Eating, Browsing, Empty that applies."
    category: policy
    applies_to: FloorStatus
    trigger: "Working out a table's state"
    logic: "Needs the bill: an open 'bill' request. Waiting: an order of the open visit is Pending or Preparing. Eating: the open visit has an order that is not Cancelled and none is open. Browsing: at least one diner page is present (5-minute rule, U5 BR8.2) and none of the above applies. Empty: none apply."
    violation: "Not applicable."
    source: "FR12.1"
  - id: BR4.3
    statement: "The floor map updates within 2 seconds of a change."
    category: constraint
    applies_to: FloorStatus
    trigger: "ORDER_PLACED, ORDER_STATUS_CHANGED, TABLE_CLOSED, TABLE_PRESENCE_CHANGED, SERVICE_CALL_OPENED, SERVICE_CALL_RESPONDED"
    logic: "Each of these events makes the page read the table list again; the answer shows within 2 seconds. After a reconnect the page reads the list again."
    violation: "The timing test fails."
    source: "FR12.2, NFR1"
  - id: BR4.4
    statement: "Selecting a table on the map opens its bill."
    category: policy
    applies_to: FloorStatus
    trigger: "Selecting a table"
    logic: "Open /staff/tables/<id>, the v1 bill screen."
    violation: "Not applicable."
    source: "FR12.3"
  - id: BR5.1
    statement: "Staff read the whole menu, hidden items included."
    category: policy
    applies_to: MenuManagement
    trigger: "GET /api/staff/menu"
    logic: "Return U5's getStaffMenu result: every category and item with hidden flags, stations, allergens (null when not set), availability and option groups with choices."
    violation: "401 without a session (U5)."
    source: "FR6.1"
  - id: BR5.2
    statement: "An item is checked on the server: name, description, price, image, category, station and allergens."
    category: validation
    applies_to: MenuManagement
    trigger: "POST or PATCH an item"
    logic: "name is required and 1 to 60 characters after trimming; description is at most 300; price_cents is a whole number from 1 to 1,000,000; image is empty, a short emoji of at most 8 characters with no spaces, or an http:// or https:// address of at most 500 characters; category_id must exist; station is one of the four; allergens is not set (null) or a list from the nine keys with no repeats; no text holds control characters. A PATCH changes only the fields sent. The server makes the id of a new item (a prefix 'i-' and a random value) and POST answers 201 with the whole item as the staff menu shows it; PATCH answers 200 with the updated item. A new item starts available and not hidden, with its station defaulting to Grill and its allergens not set unless sent. An unknown item answers 404 UNKNOWN_ITEM. A price change never changes an order already placed (prices are frozen on lines)."
    violation: "400 INVALID_REQUEST with details.field naming the first invalid field and a plain message; nothing is saved."
    source: "FR6.1, FR6.4, FR6.5, FR10.2, FR13.1"
  - id: BR5.3
    statement: "A category has a unique name, a place in the order and a hidden flag; a hidden category hides its items."
    category: validation
    applies_to: MenuManagement
    trigger: "POST or PATCH a category"
    logic: "name is required, 1 to 60 characters after trimming and unique ignoring case. A new category goes last; the server makes its id (a prefix 'c-' and a random value) and POST answers 201 with the category. PATCH answers 200 with the category and can rename, set hidden, or move up or down (it swaps places with its neighbour; moving the first up or the last down changes nothing). A hidden category's items are not offered; the diner Menu shows a category pill only when it has a visible item. An unknown category answers 404 UNKNOWN_CATEGORY."
    violation: "400 INVALID_REQUEST with details.field; nothing is saved."
    source: "FR6.2"
  - id: BR5.4
    statement: "An item's option groups are replaced as a whole and checked so no line price can go below zero."
    category: validation
    applies_to: MenuManagement
    trigger: "PUT an item's options"
    logic: "At most 6 groups per item; each group has a name of 1 to 60 characters, a kind (one, any or leave_out), required only for kind one, and 1 to 12 choices; each choice has a label of 1 to 60 characters and a price change that is a whole number of cents from -100,000 to 100,000. A group or choice listed with its existing id keeps that id, new ones get new ids, one left out is removed (U5 rule 2.5). The cheapest possible line price must be at least 0: the item price plus, for each group, the lowest it can contribute (for choose-one the cheapest choice when the group is required and otherwise 0 or the cheapest choice if it is negative; for choose-any and leave-out the sum of the negative changes). The save is one transaction, and the answer is 200 with the item's groups and their choices, each with its id (new ids made by the server)."
    violation: "400 INVALID_REQUEST with details.field (for example groups[1].choices[0].price_delta_cents) and a plain message; nothing is saved."
    source: "FR8.5, FR8.1"
  - id: BR5.5
    statement: "Every successful menu write is published to open menus."
    category: policy
    applies_to: MenuManagement
    trigger: "A successful item, category or options write, hiding or showing"
    logic: "After the write, call U5's publishMenuChange with the reason (item, category or options) and the ids, so every open diner Menu reloads within 2 seconds."
    violation: "Not applicable."
    source: "FR6.3, FR6.6"
  - id: BR5.6
    statement: "Hiding is not deleting."
    category: constraint
    applies_to: MenuManagement
    trigger: "Hiding an item or category"
    logic: "No item or category is ever removed. A hidden item stays on past orders, bills and sales with the price frozen on its lines; its name is read from the item as v1 does, so a later rename shows on old lines (the accepted risk recorded in U5). There is no delete route."
    violation: "Not applicable."
    source: "FR6.4"
  - id: BR5.7
    statement: "An invalid save names the field and keeps what was typed."
    category: policy
    applies_to: MenuManagement
    trigger: "A 400 answer to a save"
    logic: "The form shows the server's message beside the named field, keeps every field as typed, and shows all text as text, never as markup. The Save button is disabled while a save is in flight."
    violation: "Not applicable."
    source: "FR6.5"
  - id: BR6.1
    statement: "The special's page shows the live special and the server's refusal beside the field."
    category: policy
    applies_to: SpecialPage
    trigger: "Opening the page, launching a special"
    logic: "Show the live special with its countdown and stock left, or 'No special is live.' The launch form offers only visible, available items, takes the price in dollars (sent in whole cents), a stock and minutes, and shows U5's refusal (400 INVALID_REQUEST with details.field) beside the named field with what was typed kept. Because a special's price replaces the item price and the options still add their changes, the form also checks that the special price plus the item's cheapest option total is not below zero, and says so beside the price field; otherwise every order line for that special would fail. This check is on the page only (the launch route is U5's), so a request sent by hand could still make such a special; that is recorded as accepted."
    violation: "Not applicable."
    source: "FR11.1"
  - id: BR6.2
    statement: "Launching a special ends the current one, and staff can end it now."
    category: policy
    applies_to: SpecialPage
    trigger: "Launch or End special now"
    logic: "Launch and End use U5's routes (POST /api/specials, DELETE /api/specials/current); only one special runs at a time (U5 BR5.1)."
    violation: "Not applicable."
    source: "FR11.5"
  - id: BR6.3
    statement: "The page follows the special's live changes."
    category: policy
    applies_to: SpecialPage
    trigger: "A SPECIAL_CHANGED event"
    logic: "A special that sells out or runs out of time while the page is open switches to 'No special is live.' at once; a launch from another screen shows at once."
    violation: "Not applicable."
    source: "FR11.3"
  - id: BR7.1
    statement: "Closed visits are grouped by the day they closed, newest day first, with totals that add up."
    category: calculation
    applies_to: SalesReporting
    trigger: "GET /api/staff/sales"
    logic: "A day is the server's local calendar day of the visit's closed_at, read from either stored time format (U5 rule 11.6). For each day: visits = the closed visits; orders = their orders that are not Cancelled; total_cents = the sum of those orders' frozen line subtotals. Days are returned newest first. The optional from and to (YYYY-MM-DD, both inclusive local dates) limit the days; an unreadable value answers 400 INVALID_REQUEST. No closed visits returns an empty list."
    violation: "400 INVALID_REQUEST with details.field."
    source: "FR5.1, FR5.5"
  - id: BR7.2
    statement: "Best sellers are ranked by quantity sold, ties by item name."
    category: calculation
    applies_to: SalesReporting
    trigger: "Building a day's best sellers"
    logic: "Sum the quantity of each item over the day's orders that are not Cancelled, using the item's current name; rank by quantity descending, then by name ascending; return the top 5."
    violation: "Not applicable."
    source: "FR5.2"
  - id: BR7.3
    statement: "The day's average time to Completed is in minutes, or says there is none."
    category: calculation
    applies_to: SalesReporting
    trigger: "Building a day"
    logic: "average_minutes = the mean of completed_at minus placed_at, in minutes rounded to one decimal, over the day's Completed orders that have a completed_at. IF there are none THEN average_minutes is null and the page says 'No completed orders', never 0."
    violation: "Not applicable."
    source: "FR5.3"
  - id: BR7.4
    statement: "Cancelled orders are left out of every figure, and shown amounts add up to the total."
    category: constraint
    applies_to: SalesReporting
    trigger: "Building any total, best seller or average"
    logic: "Cancelled orders count nowhere. Money is whole cents converted for display; the day's total equals the sum of its orders' subtotals and each order's subtotal equals the sum of its lines."
    violation: "Not applicable."
    source: "FR5.4"
  - id: BR7.5
    statement: "The page says so when there is nothing to show."
    category: policy
    applies_to: SalesReporting
    trigger: "No closed visits, no ratings, a failed load"
    logic: "No closed visits: 'No closed visits yet.' No ratings for the day: 'No ratings yet today.' A failed load: 'Sales could not be loaded. Try again.' with Retry."
    violation: "Not applicable."
    source: "FR5.1, FR18.4"
  - id: BR7.6
    statement: "Best and worst rated dishes are ranked by share of thumbs up, with a stated tie rule."
    category: calculation
    applies_to: SalesReporting
    trigger: "GET /api/staff/ratings?day="
    logic: "day is YYYY-MM-DD in the server's local time (default today; unreadable answers 400 INVALID_REQUEST). A rating belongs to the local day it was made (rated_at), which can differ from the day its visit is counted on the sales cards; that is intended. Group the day's ratings by dish: up = thumbs up, total = ratings, share = up / total. A dish with no ratings is not ranked. best = share descending, then total descending, then name ascending; worst = share ascending, then total descending, then name ascending; the top 3 of each, each with its share and its number of ratings. The answer states the tie rule in words."
    violation: "400 INVALID_REQUEST with details.field."
    source: "FR18.3, FR18.4"
  - id: BR8.1
    statement: "A table's code holds the address the page was opened on followed by /table/ and the table's number."
    category: policy
    applies_to: TableQrCodes
    trigger: "Showing the QR page"
    logic: "For table n the code holds exactly <origin>/table/<n>, where origin is the scheme, host and port the staff page was opened on, with no trailing slash. The table list comes from GET /api/staff/tables."
    violation: "Not applicable."
    source: "FR7.1"
  - id: BR8.2
    statement: "The print view shows every table's code and label and none of the screen's buttons."
    category: policy
    applies_to: TableQrCodes
    trigger: "Printing"
    logic: "A print stylesheet hides the navigation, buttons and notes; several codes fit on a page; every table's label and code show."
    violation: "Not applicable."
    source: "FR7.2"
  - id: BR8.3
    statement: "Codes are made inside the app, with no outside service."
    category: constraint
    applies_to: TableQrCodes
    trigger: "Making a code"
    logic: "The codes are drawn in the browser by a library bundled with the app; no request leaves the app, so they appear with no internet connection."
    violation: "Not applicable."
    source: "FR7.3"
  - id: BR9.1
    statement: "The bill shows each line's chosen options under the item."
    category: policy
    applies_to: Billing
    trigger: "Showing the Table Bill"
    logic: "Each bill line shows its frozen options as text under the item name; lines with none show nothing extra."
    violation: "Not applicable."
    source: "FR8.3"
  - id: BR9.2
    statement: "The bill and the sales page show the frozen line price, which includes the options."
    category: constraint
    applies_to: Billing
    trigger: "Showing a bill line or a sales total"
    logic: "Use the stored line price (U5 BR3.2); never recalculate from the menu."
    violation: "Not applicable."
    source: "FR8.3, FR6.4"
  - id: BR10.1
    statement: "Every new staff screen uses the design system and is compared with its mockup."
    category: constraint
    applies_to: DesignSystem
    trigger: "Building any new staff screen"
    logic: "Use U5's tokens and shared components with no literal colour a token covers, 44 px touch areas, visible focus, keyboard use, words with colour, and no motion under reduced motion. A mockup-match spec compares each built screen with its mockup in both themes and lists the parts other Units own."
    violation: "The mockup-match or style test fails."
    source: "FR1.1, FR1.4, NFR3"
  - id: BR10.2
    statement: "New staff pages and routes load from any folder."
    category: constraint
    applies_to: ApiRoutes
    trigger: "Opening a new staff page or calling a new route"
    logic: "The five route modules replace their stub bodies and stay mounted before the page catch-all through U5's registry; the pages are served with the root setting. Every port and the database file come from the environment."
    violation: "A new route answers with the page, or a page fails to load from a worktree."
    source: "FR19.5"
  - id: BR10.3
    statement: "What v1 staff screens did keeps working."
    category: constraint
    applies_to: KitchenBoard
    trigger: "Changing a v1 staff screen"
    logic: "v1's tests for the Kitchen Board and the bill stay in the suite; a v1 test is changed only when a chosen change makes it out of date and is listed in the Unit's code summary under 'v1 tests changed' with the reason. The board no longer keeps a fixed number of tables (BR4.1), which is a chosen change on the list of changes to v1."
    violation: "An unlisted change to a v1 test is a finding at the Unit's review."
    source: "FR19.1, FR12.4"
```

## Rules Summary (derived)

| Group | Rules | What they decide |
|---|---|---|
| BR1 Stations | BR1.1 to BR1.5 | The board's content, the done mark and the order's moves, events, the All stations view, the Grill default |
| BR2 Tickets | BR2.1 to BR2.3 | Timer colours and words, finished tickets, options on tickets |
| BR3 Alerts and calls | BR3.1 to BR3.2 | The new-order banner and mute, the call pulse and Respond |
| BR4 Floor map | BR4.1 to BR4.4 | The table list, the state order, live updates, opening a bill |
| BR5 Menu management | BR5.1 to BR5.7 | The staff menu, item, category and option checks, live publishing, hiding, form errors |
| BR6 Chef's special page | BR6.1 to BR6.3 | The page, launching and ending, live changes |
| BR7 Sales and ratings | BR7.1 to BR7.6 | Days and totals, best sellers, average, cancelled orders, empty states, best and worst rated |
| BR8 QR codes | BR8.1 to BR8.3 | The address, the print view, made inside the app |
| BR9 Bill | BR9.1 to BR9.2 | Option lines and frozen prices |
| BR10 Seams and design | BR10.1 to BR10.3 | The design system, routes and pages from any folder, v1 kept working |

## Assumptions & Open Questions

- The validation limits (BR5.2 to BR5.4), the top-3 and top-5 list lengths, the tie rules, and the "Cancelled shows no timer" rule are my choices; they are listed in `functional-spec.md` for you to change.
