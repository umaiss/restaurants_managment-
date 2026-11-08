# Business Rules: u5-foundation

The decision logic of the foundation Unit, built from the requirements (`inception/requirements-analysis/requirements.md`), the stories (`inception/user-stories/stories.md`), the component catalogue (`inception/domain-design/components.md`) and the contracts (`inception/contract-design/contract-summary.md`). It also settles the open points the Contract Design review raised, as decisions here (marked "settles" in the rule), and uses your two answers in `functional-design-questions.md`: a page heartbeat for "Browsing" (Q1), and a 12-hour idle end for staff sessions (Q2). No code or SQL: that belongs to Code Generation.

```yaml
rules:
  - id: BR1.1
    statement: "The staff PIN comes from the environment and is never written in code or logs."
    category: policy
    applies_to: StaffAccess
    trigger: "Server start"
    logic: "IF the STAFF_PIN setting holds a 4-digit value THEN use it. IF it is missing or not 4 digits THEN make a random 4-digit PIN and print it once on the console. The PIN is compared in constant time and is never logged or sent to the browser."
    violation: "Start-up continues with the random PIN; a malformed STAFF_PIN is reported on the console as a warning that names the setting, not its value."
    source: "FR3.4, NFR2"
  - id: BR1.2
    statement: "A correct PIN opens a staff session carried by a cookie that page scripts cannot read."
    category: authorization
    applies_to: StaffAccess
    trigger: "POST staff login with a correct PIN"
    logic: "IF the PIN matches and the client is not locked THEN make a random 128-bit session value, keep it in server memory and answer 204 with a cookie named staff_session that is HttpOnly, SameSite=Strict, Path=/ and has no expiry date (it ends when the browser closes). The cookie is not marked Secure because the app runs on plain HTTP on the restaurant's network; SameSite=Strict is the defence against cross-site requests."
    violation: "A wrong PIN answers 401 INVALID_PIN with the tries left."
    source: "FR3.5, NFR2"
  - id: BR1.3
    statement: "A staff session ends on sign-out, a server restart, or 12 hours without staff action."
    category: constraint
    applies_to: StaffAccess
    trigger: "Any staff request, sign-out, or restart"
    logic: "Every staff request that carries a valid session refreshes its last-action time. IF now minus the last action is more than 12 hours THEN the session is gone and the request is answered 401. Sign-out removes the session and clears the cookie. A restart forgets every session. Expired sessions are purged when found and by a sweep every 10 minutes, so the sessions held in memory stay small. An open staff live stream does not count as staff action (BR1.9). (Settles Q2.)"
    violation: "The request is answered 401 UNAUTHORIZED and the screen returns to the PIN screen (BR1.7)."
    source: "FR3.5, Functional Design Q2"
  - id: BR1.4
    statement: "Five wrong PIN tries in a row from one client address lock that address for 60 seconds."
    category: constraint
    applies_to: StaffAccess
    trigger: "POST staff login"
    logic: "Wrong tries are counted per client address as the server sees it (the connection's address, not a header the client can set), never per session or cookie. After 5 wrong tries in a row the address is locked for 60 seconds and even a correct PIN is refused with 429 LOCKED and retry_after_seconds. A correct PIN resets that address's count. Counts live in memory, expire after 10 minutes without a try, and at most 1,000 addresses are kept; when full, an address that is not locked is dropped first, so an active lock is never lifted by the cap. There is no limit across all addresses: someone using many addresses on the restaurant's network could still try many PINs, which is recorded as an accepted risk for a one-restaurant app on a local network. A test-only function resets all counts so parallel test workers on one address do not lock each other out; it is not reachable from any route. (Settles the Contract Design lockout points.)"
    violation: "429 LOCKED; nothing else changes."
    source: "FR3.3, NFR2"
  - id: BR1.5
    statement: "Every staff route and the staff live stream need a valid staff session; diner routes stay open."
    category: authorization
    applies_to: ApiRoutes
    trigger: "Any request to a staff route or the staff stream"
    logic: "IF the request has no valid staff session THEN answer 401 UNAUTHORIZED in v1's error shape and change nothing. The staff routes are the sold-out toggle, the bill, Close table, order status changes with by=staff, specials launch and end, service-call respond, every route under /api/staff, and the staff stream. Diner routes (menu, place an order, a table's orders, table status, estimate, current special, calls, ratings, presence, a diner's own cancel, the table stream) need no session."
    violation: "401 UNAUTHORIZED; no data is read or changed."
    source: "FR3.1, FR3.2, NFR2"
  - id: BR1.6
    statement: "Only the by value staff needs the session; a diner cancel may only move a Pending order to Cancelled."
    category: authorization
    applies_to: OrderManagement
    trigger: "Order status change"
    logic: "IF the request says by=staff THEN it needs a staff session (BR1.5). IF it says by=diner THEN it is allowed only for Pending to Cancelled, and the contract carries no table check, because the request names only the order number. Any caller who knows an order number can therefore cancel that Pending order, exactly as in v1: this exposure is recorded as accepted, not fixed here, and contract 2 is amended to say the same."
    violation: "401 for by=staff without a session; 422 ILLEGAL_TRANSITION for any other diner change."
    source: "FR3.6"
  - id: BR1.7
    statement: "A refused staff request returns the staff screen to the PIN screen."
    category: policy
    applies_to: StaffApp
    trigger: "Any 401 from the staff API, or the staff live stream failing while the session check also fails"
    logic: "IF any staff request is answered 401 THEN the screen shows the PIN screen and keeps nothing the person typed elsewhere. IF the staff live stream fails and the session check then answers 401 THEN do the same, because a stream that was refused does not retry by itself. After a correct PIN the screen returns to the page that was open."
    violation: "Not applicable; this is the client's reaction to a refusal."
    source: "FR3.1, NFR7"
  - id: BR1.8
    statement: "The shell checks the session before it shows any staff page."
    category: policy
    applies_to: StaffApp
    trigger: "Opening any staff address"
    logic: "Ask the server whether the browser is signed in. IF yes THEN show the page. IF no THEN show only the PIN screen."
    violation: "Not applicable."
    source: "FR3.1"
  - id: BR1.9
    statement: "A staff live stream ends when its session ends."
    category: authorization
    applies_to: LiveEvents
    trigger: "Sign-out, session expiry, or a keep-alive on an open staff stream"
    logic: "Each open staff stream is tied to the session that opened it. Sign-out and the idle end close that session's open streams at once. Every keep-alive (every 20 seconds) also re-checks the session and closes the stream if it is gone, so a stream never outlives its session by more than 20 seconds. Stream traffic does not count as staff action and does not refresh the idle time. The server sends no separate sign-out notice (this answers Contract Design open question 2); a closed stream is the signal, and the client reacts as BR1.7 says."
    violation: "Not applicable."
    source: "FR3.2, NFR2"
  - id: BR2.1
    statement: "A hidden item or category is not offered but stays in past orders, bills and sales."
    category: constraint
    applies_to: MenuCatalog
    trigger: "Reading the menu for a diner, or placing an order"
    logic: "The diner menu leaves out hidden items and the items of a hidden category. An order that names a hidden item is refused with UNKNOWN_ITEM. Past orders, bills and sales keep showing hidden items by the name and price frozen on their lines. A diner cart holding an item that has become hidden is refreshed with the notice v1 shows for items no longer on the menu."
    violation: "UNKNOWN_ITEM for an order line that names a hidden item."
    source: "FR6.1, FR6.2, FR6.4, FR6.6"
  - id: BR2.2
    statement: "Every item has one station from a fixed list; none set counts as Grill."
    category: constraint
    applies_to: MenuCatalog
    trigger: "Reading or saving an item"
    logic: "The stations are Grill, Cold, Bar and Desserts. An item with no station set is treated as Grill."
    violation: "A station outside the list is refused on save with INVALID_REQUEST naming the field."
    source: "FR13.1"
  - id: BR2.3
    statement: "Allergens come from a fixed list of nine; no list means not set, and an empty list means none."
    category: constraint
    applies_to: MenuCatalog
    trigger: "Reading or saving an item"
    logic: "The allergens are gluten, dairy, eggs, peanuts, tree nuts, fish, shellfish, soy and sesame. An item whose list is not set is shown as 'Allergens not set' and is never treated as safe. An empty list means the item contains none."
    violation: "An allergen outside the list is refused on save with INVALID_REQUEST naming the field."
    source: "FR10.2"
  - id: BR2.4
    statement: "Option groups are choose one, choose any or leave out, and each choice may change the price by a whole number of cents."
    category: constraint
    applies_to: MenuCatalog
    trigger: "Saving or reading an item's options"
    logic: "A group of kind one lets the diner pick at most one choice and may be required (at least one). A group of kind any or leave_out lets the diner pick any number. A choice's price change is a whole number of cents, positive, zero or negative; the line price after all choices may never be below zero."
    violation: "A save that would let a line price fall below zero, or that has a non-integer change, is refused with INVALID_REQUEST naming the field."
    source: "FR8.1"
  - id: BR2.5
    statement: "Option group and choice ids stay the same when a group is saved again with its id."
    category: policy
    applies_to: MenuCatalog
    trigger: "Replacing an item's options"
    logic: "When a replacement lists a group or choice with its existing id, that id is kept. A choice left out of the replacement is removed, and an order or cart that names its id sees it as no longer offered (BR3.4). New groups and choices get new ids. A removed choice's id exists nowhere afterwards, so an order that names it has the line dropped with OPTION_UNAVAILABLE (BR3.1, BR3.4). (Settles the choice-id point.)"
    violation: "Not applicable."
    source: "FR8.5, FR8.6"
  - id: BR2.6
    statement: "The sample data keeps v1's counts; v2 adds options, allergens and stations to existing items only."
    category: constraint
    applies_to: MenuCatalog
    trigger: "First start on an empty database"
    logic: "The seed makes the same 10 tables, 4 categories and 12 items as v1. It adds option groups to Classic Burger (Size choose-one required, Extras choose-any, Leave out) and to Margherita Pizza (Size), allergens to every item except Grilled Salmon (left not set so 'Allergens not set' can be shown), and a station to every item: the two salads Cold, Garlic Bread and the four mains Grill, the two desserts Desserts, the three drinks Bar."
    violation: "Not applicable."
    source: "FR8.5, FR10.2, FR13.1, FR19.3"
  - id: BR2.7
    statement: "Staff can read the whole menu, including hidden items, options, allergens and stations."
    category: policy
    applies_to: MenuCatalog
    trigger: "A staff page needs the full menu"
    logic: "The menu data layer offers a staff read that returns hidden items and categories with their options, allergens, stations and hidden flags. The route that serves it (GET /api/staff/menu) is mounted in the U7 route module and needs a staff session; U5 provides and tests the data function. (Settles the hidden-item read gap.)"
    violation: "401 without a session."
    source: "FR6.1, FR6.2"
  - id: BR3.1
    statement: "Chosen options must belong to the item and obey their group kinds."
    category: validation
    applies_to: OrderManagement
    trigger: "Placing an order line with option_ids"
    logic: "Checks for one line run in this order: (1) the item is known and not hidden (else the whole order is refused UNKNOWN_ITEM); (2) the item is not sold out (else the line is dropped, BR3.4); (3) the special, if any, is checked only: it must be live and for this item (BR5.4), and its stock is not touched yet; (4) every option id must exist now: an id that exists nowhere (removed, or never existed) drops the whole line with OPTION_UNAVAILABLE (BR3.4), which also covers a required group that was replaced with new ids; (5) every option id that exists must belong to the line's item, else the whole order is refused (an id of another item is a mistake, not a removal); (6) two choices of a choose-one group are refused; (7) a required choose-one group with no choice is refused. Only after every line has passed all of these does the guarded stock reduction of BR5.3 run, once, for the special lines that remain, so a special line that is dropped or an order that is refused never uses up stock. A test checks that a special line with a removed option leaves the special's stock unchanged. The check happens on the server whatever the screen did."
    violation: "400 INVALID_OPTIONS with details.menu_item_id and the group for checks 5 to 7."
    source: "FR8.2"
  - id: BR3.2
    statement: "The line price is the item price (or the special price) plus the chosen options, frozen at placement."
    category: calculation
    applies_to: OrderManagement
    trigger: "Placing an order"
    logic: "price_each = base price + sum of the chosen choices' price changes, where the base is the item's price, or the special's price on a Chef's special line. It is stored on the line in whole cents. Later menu or option price edits never change it. The subtotal is price_each times quantity; the bill and sales add the frozen subtotals."
    violation: "Not applicable."
    source: "FR8.3, FR6.4"
  - id: BR3.3
    statement: "The station and the chosen options are frozen on each order line as text."
    category: policy
    applies_to: OrderManagement
    trigger: "Placing an order"
    logic: "Each line stores the item's station at that moment (Grill when none) and one OrderLineOption per chosen choice, holding its label and price change. Later edits or removals never alter them. Orders from before v2 have no station on their lines and count as Grill."
    violation: "Not applicable."
    source: "FR8.3, FR8.4, FR13.1"
  - id: BR3.4
    statement: "A line whose item, option or special is no longer offered is dropped, not failed."
    category: policy
    applies_to: OrderManagement
    trigger: "Placing an order"
    logic: "IF an item is sold out THEN the line is dropped with SOLD_OUT_AT_SUBMIT (v1). IF an option choice id named on the line exists nowhere (it was removed, or never existed) THEN the whole line is dropped with OPTION_UNAVAILABLE, including when that leaves a required group empty, because options belong to the line as a whole. IF the special on the line has ended, run out, or does not match the line's item THEN the line is dropped with SPECIAL_SOLD_OUT. IF every line is dropped THEN the order is refused with EMPTY_ORDER. The order of checks is the one in BR3.1."
    violation: "400 EMPTY_ORDER when nothing is left."
    source: "FR8.6, FR11.4"
  - id: BR3.5
    statement: "The estimate shown at placement is stored on the order."
    category: policy
    applies_to: OrderManagement
    trigger: "Placing an order"
    logic: "The API layer asks WaitEstimation for the estimate (BR4.1) just before placing and the order stores it as estimate_minutes. The stored value is the one 'Running late' compares against (BR4.2)."
    violation: "Not applicable."
    source: "FR9.1, FR9.3"
  - id: BR3.6
    statement: "The time an order became Completed is recorded."
    category: policy
    applies_to: OrderManagement
    trigger: "An order's status becomes Completed"
    logic: "Set completed_at to the current time as ISO 8601 UTC text. It stays empty for other statuses, and for orders completed before v2 (those are left out of averages and estimates)."
    violation: "Not applicable."
    source: "FR5.3, FR9.1"
  - id: BR3.7
    statement: "A repeated placement key returns the same order and drops nothing."
    category: constraint
    applies_to: OrderManagement
    trigger: "Placing an order with a placement key already used in this visit"
    logic: "Answer 200 with the original order and an empty dropped_lines list; publish nothing; reduce no special stock."
    violation: "Not applicable."
    source: "FR8.2, FR11.4"
  - id: BR3.8
    statement: "Order status rules stay as v1; one function makes every status change."
    category: constraint
    applies_to: OrderManagement
    trigger: "Any status change"
    logic: "Pending goes to Preparing or Cancelled (staff or station) or Cancelled (diner); Preparing goes to Completed or Cancelled (staff or station); Completed and Cancelled are final. U5 provides one function, transitionOrder(order, to, actor), where actor is staff, diner or station. It applies the rule, sets completed_at (BR3.6) and returns the new status; every route and U7's station logic call it, and publishing the event is done by the caller. The station actor may only move Pending to Preparing and Preparing to Completed, never cancel. A station-done on a Pending order first moves it to Preparing through this function, then, when every station with lines is done, to Completed. (Settles the station-done transition point.)"
    violation: "422 ILLEGAL_TRANSITION."
    source: "FR13.3, FR13.5"
  - id: BR3.9
    statement: "Cancelled orders stay off the bill, sales and averages."
    category: constraint
    applies_to: OrderManagement
    trigger: "Building a bill, a total or an average"
    logic: "Orders with status Cancelled are left out of the bill, of totals, of best sellers and of every average, as in v1."
    violation: "Not applicable."
    source: "FR5.4"
  - id: BR3.10
    statement: "Placing an order is all or nothing."
    category: constraint
    applies_to: OrderManagement
    trigger: "Placing an order"
    logic: "The visit, the order, its lines, their options and any special stock reduction happen in one database transaction. IF the order ends with no lines THEN everything, including the stock reduction, is rolled back."
    violation: "Nothing is written."
    source: "NFR4, FR11.4"
  - id: BR4.1
    statement: "The estimate is today's average time to Completed plus an allowance for each open order."
    category: calculation
    applies_to: WaitEstimation
    trigger: "Asking for an estimate, and placing an order"
    logic: "average = the mean, in minutes, of completed_at minus placed_at over today's orders that are Completed (day = server local midnight to midnight; both timestamp formats read; Cancelled orders and orders with no completed_at are left out). IF there is no such order THEN average = 15 and the basis is 'default', otherwise 'today'. open = the number of orders now Pending or Preparing. estimate_minutes = round(average + 2 x open), and at least 1. The allowance of 2 minutes per open order is a starting value kept in one place. (Settles the formula.)"
    violation: "Not applicable."
    source: "FR9.1, FR9.4"
  - id: BR4.2
    statement: "An open order is late when it has waited longer than the estimate it was given."
    category: policy
    applies_to: WaitEstimation
    trigger: "Showing an open order"
    logic: "elapsed = whole minutes since placed_at. IF elapsed is more than the order's stored estimate_minutes THEN show 'Running late', never a zero or negative time. OTHERWISE show the remaining time, estimate minus elapsed, at least 1 minute. An order with no stored estimate (placed before v2) shows no time."
    violation: "Not applicable."
    source: "FR9.3"
  - id: BR4.3
    statement: "The estimate route needs a table that exists and returns the number, its basis and the open orders."
    category: validation
    applies_to: ApiRoutes
    trigger: "GET estimate"
    logic: "The table must exist (else 404 UNKNOWN_TABLE) but does not change the value, which is the same for every table. The answer holds estimate_minutes, basis (today or default) and open_orders. Screens read it again when an order is placed or changes status; there is no event of its own."
    violation: "404 UNKNOWN_TABLE."
    source: "FR9.2, FR9.5"
  - id: BR5.1
    statement: "A Chef's special needs a valid item, price, stock and run time, and replaces any live special."
    category: validation
    applies_to: ChefSpecials
    trigger: "Launching a special"
    logic: "The item must exist, not be hidden and be available. The special price is a whole number of cents from 1 up. The stock is a whole number from 1 to 999. The run time is a whole number of minutes from 1 to 720, and the end time is that long from now. Launching ends any special that is still live in the same transaction, so at most one is live. Staff can also end the live special at once."
    violation: "400 INVALID_REQUEST with details.field."
    source: "FR11.1, FR11.5"
  - id: BR5.2
    statement: "A special is live while it is not ended, its time has not passed and stock is left."
    category: constraint
    applies_to: ChefSpecials
    trigger: "Reading the current special"
    logic: "live = ended_at is empty AND ends_at is later than now AND stock_left is above 0. Otherwise there is no current special."
    violation: "Not applicable."
    source: "FR11.3"
  - id: BR5.3
    statement: "Special stock is reduced by one guarded step inside the order's transaction."
    category: constraint
    applies_to: ChefSpecials
    trigger: "Placing an order with a special line"
    logic: "The reduction runs last, after every line has passed the checks in BR3.1 (so stock is never used for a line that is dropped or an order that is refused). For a special line of quantity q, reduce stock_left by q only if the special is live and stock_left is at least q, in one statement; if no row changed then that line is dropped with SPECIAL_SOLD_OUT and the rest of the order is placed. An order with several special lines adds their quantities. Two diners ordering the last one: one statement succeeds, the other changes nothing. A rolled-back order restores nothing because nothing was kept (BR3.10). Cancelling an order does not return stock (accepted: the special is limited and time-boxed)."
    violation: "SPECIAL_SOLD_OUT dropped line."
    source: "FR11.4, NFR4"
  - id: BR5.4
    statement: "The special line is priced by the server from the special, not by the client."
    category: validation
    applies_to: ChefSpecials
    trigger: "Placing an order with special_id"
    logic: "The server looks up the special named by special_id; it must be live and for the same item as the line, else the line is dropped (BR3.4). The special price replaces the item price for that line; chosen options still add their changes."
    violation: "SPECIAL_SOLD_OUT dropped line."
    source: "FR11.2, FR11.4"
  - id: BR5.5
    statement: "A special change, a sell-out and an expiry are published live."
    category: policy
    applies_to: ChefSpecials
    trigger: "Launch, stock change, end, or the end time passing"
    logic: "Publish SPECIAL_CHANGED to staff and every table with the special, or null once it is gone. The server checks every 5 seconds whether the live special has expired and publishes the null then, so open Menus remove it within about 5 seconds of its end time and at once on a sell-out."
    violation: "Not applicable."
    source: "FR11.3"
  - id: BR6.1
    statement: "A table has at most one open request of each kind, and only while it has an open visit."
    category: constraint
    applies_to: ServiceCalls
    trigger: "A diner presses Call the waiter or Ask for the bill"
    logic: "kind is waiter or bill. IF the table has no open visit THEN refuse with 409 NO_OPEN_VISIT. IF an open request of that kind exists THEN answer 200 with it and create nothing. OTHERWISE create it, answer 201 and publish SERVICE_CALL_OPENED to staff and that table. Two presses at the same moment: the database allows only one open request per visit and kind, so the second one meets that rule and is answered 200 with the existing request, never as an error."
    violation: "400 INVALID_KIND, 404 UNKNOWN_TABLE or 409 NO_OPEN_VISIT."
    source: "FR17.1, FR17.4"
  - id: BR6.2
    statement: "Staff respond to clear a request."
    category: policy
    applies_to: ServiceCalls
    trigger: "Staff press Respond"
    logic: "Set responded_at, publish SERVICE_CALL_RESPONDED to staff and that table, answer 200. The diner can then raise a new request of that kind."
    violation: "404 UNKNOWN_CALL for an id that does not exist; a second respond answers 200 unchanged."
    source: "FR17.3"
  - id: BR6.3
    statement: "Closing a table clears its open requests."
    category: policy
    applies_to: ServiceCalls
    trigger: "Close table"
    logic: "In the same step that closes the visit, every open request of that visit is marked responded. No per-request event is published; the TABLE_CLOSED event already tells every screen to reset. (Settles how closing clears calls.)"
    violation: "Not applicable."
    source: "FR17.5"
  - id: BR7.1
    statement: "A rating is for a dish in the table's last closed visit."
    category: validation
    applies_to: DishRatings
    trigger: "A diner posts ratings"
    logic: "Checks run in this order: (1) the visit_id must be the table's most recent closed visit, else 409 VISIT_NOT_CLOSED; (2) every thumb is up or down, else 400 INVALID_RATING; (3) every item_id is on a non-cancelled order of that visit, else 400 ITEM_NOT_IN_VISIT; (4) no rating being changed is locked, else 409 RATING_LOCKED (BR7.2). Nothing is saved unless all checks pass."
    violation: "The error codes above; nothing is saved."
    source: "FR18.1, FR18.2"
  - id: BR7.2
    statement: "One rating per dish per visit; it can change until the diner presses Done."
    category: constraint
    applies_to: DishRatings
    trigger: "A diner posts ratings"
    logic: "A later post for the same dish replaces the thumb. A post with done set to true saves the ratings and locks the ratings of that visit that exist; after that a post that would change a locked rating is refused with 409 RATING_LOCKED. The lock covers only ratings that exist: a dish that was never rated stays rateable, and a Done pressed with no ratings locks nothing. (Settles the lock.)"
    violation: "409 RATING_LOCKED."
    source: "FR18.2"
  - id: BR8.1
    statement: "An open diner page tells the server it is still there about once a minute."
    category: policy
    applies_to: ApiRoutes
    trigger: "A diner page is open"
    logic: "Each diner page makes a random page id (8 to 64 letters, digits or hyphens). It opens the table's live stream with that id in an optional page query parameter, and calls POST presence for the table with the same page id once when it opens and about every 60 seconds after. A stream opened without a page id (an older client) is given an id by the server for as long as that connection lasts. The server records the time of the last sign of life for each page id and table. The heartbeat route is open to everyone, so it is bounded: a page id that does not match the allowed form is refused with 400 INVALID_REQUEST, and the number of remembered pages is capped (BR8.2). The diner page's side is U5's: the page id, the page parameter on the stream and the 60-second heartbeat live inside the table stream hook that U5 owns (useTableSSE), so every diner page that uses the hook is counted without U6 doing anything. A test checks that a page using the hook shows as present. (Settles Q1.)"
    violation: "404 UNKNOWN_TABLE for a table that does not exist; 400 INVALID_REQUEST for a bad page id."
    source: "FR12.1, Functional Design Q1"
  - id: BR8.2
    statement: "A page counts as present for 5 minutes after its last sign of life."
    category: calculation
    applies_to: LiveEvents
    trigger: "Reading a table's presence"
    logic: "A page is present if its connection (matched by page id) is open and its last sign of life, a heartbeat or the connection opening, was less than 5 minutes ago. U5 owns this 5-minute rule: getPresence(table) returns how many pages are present and the time of the latest sign of life, and U7's floor state only reads it. A page whose connection closes is removed at once, by its page id. A sweep every 30 seconds drops pages whose last sign of life is older than 10 minutes and recounts every table. The memory is capped at 500 pages per table and 5,000 in all; when full, the page with the oldest sign of life is dropped first. The counts are in memory and a restart resets them."
    violation: "Not applicable."
    source: "FR12.1"
  - id: BR8.3
    statement: "A change in the number of present pages is published to staff, at most once a second per table."
    category: policy
    applies_to: LiveEvents
    trigger: "A page connects, disconnects, or the sweep finds a count has changed because a page went quiet"
    logic: "Publish TABLE_PRESENCE_CHANGED to staff with the table, the count and the latest sign of life. Changes within one second for a table are merged into one event. The sweep (BR8.2) recounts every table and publishes for each table whose count changed, so a page that goes quiet is reported within about 30 seconds even when nothing connects or disconnects."
    violation: "Not applicable."
    source: "FR12.2"
  - id: BR9.1
    statement: "An event is published only after the write it reports has succeeded."
    category: policy
    applies_to: ApiRoutes
    trigger: "Any change that has a live event"
    logic: "Write first, then publish; a failed write publishes nothing. Events carry what screens need to patch their state; screens still reload after a reconnect."
    violation: "Not applicable."
    source: "NFR7, NFR1"
  - id: BR9.2
    statement: "Every event name is registered once in the browser's event lists."
    category: constraint
    applies_to: LiveEvents
    trigger: "Adding any event"
    logic: "The two client hooks (the table stream and the staff stream) register every name in the contract (ORDER_PLACED, ORDER_STATUS_CHANGED, TABLE_CLOSED, MENU_AVAILABILITY_CHANGED, MENU_CHANGED, SPECIAL_CHANGED, SERVICE_CALL_OPENED, SERVICE_CALL_RESPONDED, STATION_DONE, TABLE_PRESENCE_CHANGED), because a browser ignores any event type that is not listed. U6 and U7 never edit these lists. A menu change is published through one function, publishMenuChange, that U7's routes and every Unit's tests call."
    violation: "Not applicable."
    source: "FR19.4, FR6.3"
  - id: BR9.3
    statement: "An alert fires once per event and never for events that happened before the page loaded."
    category: policy
    applies_to: Notifications
    trigger: "A live event that raises an alert arrives"
    logic: "Each event has an id; an alert fires only if that id has not fired before on this page and the event is newer than the page load. After a reconnect that replays old events, or a page reload, no old alert shows. Dismissing a banner does not bring it back."
    violation: "Not applicable."
    source: "FR4.3, NFR7"
  - id: BR9.4
    statement: "Sound and vibration wait for the first tap and obey the mute switch."
    category: policy
    applies_to: Notifications
    trigger: "An alert fires"
    logic: "The banner always shows. A short sound plays only if the person has already tapped something on the page and sound is not muted. A short vibration happens only where the device supports it. The mute switch is saved in the browser."
    violation: "Not applicable."
    source: "FR4.4"
  - id: BR10.1
    statement: "All colour, type, spacing, radius and shadow values come from one set of design tokens."
    category: constraint
    applies_to: DesignSystem
    trigger: "Styling any screen"
    logic: "The tokens are named as in the mockups' design-system file (surfaces, borders, text, accent, statuses, timers, type scale, spacing scale, radius, shadows, motion). The dark theme holds v1's values. v1's token names remain as aliases until no component uses them. No component sets a colour value that a token already covers."
    violation: "A unit test that scans styles fails on a literal colour that a token covers."
    source: "FR1.1, FR1.2"
  - id: BR10.2
    statement: "The theme follows the device unless the person chose, and the choice is remembered."
    category: policy
    applies_to: ClientPreferences
    trigger: "Opening any screen, or changing the theme"
    logic: "No saved choice means follow the device's light or dark setting. Choosing Light or Dark sets the theme attribute on the page root and saves the choice in the browser under table-order.theme; choosing Follow device removes it. Sound (table-order.sound) and allergies (table-order.allergies, a list of allergen keys) are saved the same way. Blocked browser storage falls back to the defaults with no error."
    violation: "Not applicable."
    source: "FR2.1, FR2.3, FR4.4, FR10.1"
  - id: BR10.3
    statement: "All five v1 screens take the new look in both themes."
    category: policy
    applies_to: DinerApp
    trigger: "Building U5"
    logic: "The Menu, Cart, My orders, Kitchen Board and Table Bill and Close table screens are restyled with the design system and match their new mockups (diner-menu, diner-cart, diner-orders, staff-board, staff-bill) apart from the parts U6 and U7 own. Their words that v1's tests check do not change."
    violation: "The U5 mockup-match test fails."
    source: "FR1.2, FR1.4"
  - id: BR10.4
    statement: "What v1 got right stays on every screen."
    category: constraint
    applies_to: DesignSystem
    trigger: "Restyling"
    logic: "The bottom tab bar with the Cart count, View cart and Place order above it, sticky category pills with the current one filled, the + Add pill with a 44 px touch area, frosted bars, rounded cards with soft shadows, tabular prices, and reduced-motion and keyboard access are kept."
    violation: "v1's tests for them fail."
    source: "FR1.3, NFR3"
  - id: BR10.5
    statement: "Text is readable in both themes."
    category: constraint
    applies_to: DesignSystem
    trigger: "Defining the tokens"
    logic: "Body text has a contrast ratio of at least 4.5 to 1 against its background in both themes, and no status is shown by colour alone."
    violation: "The token contrast test fails."
    source: "FR2.4, NFR3"
  - id: BR10.6
    statement: "All motion stops when the device asks for reduced motion."
    category: constraint
    applies_to: DesignSystem
    trigger: "Reduced motion is set"
    logic: "Animations, transitions and smooth scrolling are off; state still changes."
    violation: "The motion test fails."
    source: "NFR3"
  - id: BR11.1
    statement: "The database upgrade only adds, and can run twice."
    category: constraint
    applies_to: TableSessions
    trigger: "Every server start"
    logic: "New tables are created only if missing and new columns are added only if missing, each with a safe default or allowing empty. Existing rows are never changed or removed. Running the step again changes nothing. A database file made by v1 starts with all its data."
    violation: "Start-up stops with a message naming the step that failed; no data is lost."
    source: "FR19.2, NFR4"
  - id: BR11.2
    statement: "v1's sample data still loads with the same counts."
    category: constraint
    applies_to: MenuCatalog
    trigger: "First start on an empty database"
    logic: "10 tables, 4 categories and 12 items, as v1's data test expects."
    violation: "v1's data test fails."
    source: "FR19.3"
  - id: BR11.3
    statement: "v1 tests that call staff actions sign in first, and each is listed."
    category: policy
    applies_to: ApiRoutes
    trigger: "Updating v1's tests for the staff guard"
    logic: "Each v1 test that calls a staff action without a session is changed to sign in with a test PIN set in the test setup, and is named in the Unit's code-summary under 'v1 tests changed' with its reason. No guard-off switch exists in the app. The Playwright browsers for v1's mockup-match specs are set to the dark scheme so those specs compare against v1's dark look."
    violation: "An unlisted change to a v1 test is a finding at the Unit's review."
    source: "FR19.1, FR3.6, NFR6"
  - id: BR11.4
    statement: "New routes are mounted before the page catch-all, and pages are served with a root setting."
    category: constraint
    applies_to: ApiRoutes
    trigger: "Mounting routes"
    logic: "Every new API and stream route is mounted before the catch-all that serves the page, and the page is served by naming the file and its folder (a root setting), never by an absolute path, so it works from a hidden folder such as a worktree."
    violation: "A new route answers with the page instead of its own answer."
    source: "FR19.5"
  - id: BR11.5
    statement: "Every port and the database file come from environment settings."
    category: constraint
    applies_to: ApiRoutes
    trigger: "Starting the server or the tests"
    logic: "PORT (default 3000), E2E_PORT (default 3100, with plus 100 and plus 200 for specs that need their own server) and DB_FILE. No port or file name is written in code."
    violation: "Parallel Bolts would collide."
    source: "NFR8"
  - id: BR11.6
    statement: "Both timestamp formats v1 stores are read correctly."
    category: constraint
    applies_to: TableSessions
    trigger: "Reading any stored time"
    logic: "A time written as the database's date-time text (UTC, no zone marker) and a time written as ISO 8601 text are both read as UTC instants. Times v2 writes are ISO 8601 UTC text. Day boundaries are the server's local midnight."
    violation: "Not applicable."
    source: "FR5.5, FR9.1"
  - id: BR11.7
    statement: "U5 has a mockup-match spec for every screen it builds, and lists the parts other Units own."
    category: policy
    applies_to: DesignSystem
    trigger: "Building U5"
    logic: "e2e/u5-foundation/mockup-match.spec.ts compares design-system, staff-pin and the U5 parts of diner-menu, diner-cart, diner-orders, staff-board and staff-bill in both themes, saves the screenshot pairs in test-results/mockup-match/u5-foundation/, and lists the parts U6 and U7 own."
    violation: "The spec fails."
    source: "FR1.4, NFR6"
  - id: BR12.1
    statement: "Stations are Grill, Cold, Bar and Desserts, and each order line carries one."
    category: constraint
    applies_to: OrderManagement
    trigger: "Placing an order"
    logic: "The station on each line is one of the four, from BR2.2 and frozen by BR3.3."
    violation: "Not applicable."
    source: "FR13.1"
  - id: BR12.2
    statement: "A station's done mark exists at most once per order and station."
    category: constraint
    applies_to: KitchenStations
    trigger: "A station is marked done"
    logic: "U5 creates the done-mark table with one row per order and station. Marking a station done a second time changes nothing: it does not run the completion check again and publishes no event. U7 owns the logic that uses it."
    violation: "Not applicable."
    source: "FR13.3"
  - id: BR13.1
    statement: "Every API answer comes back within 300 ms on a developer laptop with the seed data."
    category: constraint
    applies_to: ApiRoutes
    trigger: "Any request"
    logic: "A timing test places and reads orders against the seed data and fails if an answer takes longer than 300 ms."
    violation: "The timing test fails."
    source: "NFR1"
  - id: BR13.2
    statement: "A live change reaches every open screen within 2 seconds."
    category: constraint
    applies_to: LiveEvents
    trigger: "Any live event"
    logic: "A browser test checks that an event published after a write shows on an open screen within 2 seconds, as v1's timing test does."
    violation: "The timing test fails."
    source: "NFR1"
  - id: BR14.1
    statement: "Routes that U7 owns exist as guarded stubs, so U6 and U7 never edit each other's files."
    category: policy
    applies_to: ApiRoutes
    trigger: "Mounting routes"
    logic: "U5 creates each U7 route module (stations, menu management, floor, sales, QR) as a stub, listed in one registry that U5 fills in completely. The staff guard runs before the stub, so a request without a session is answered 401 first and a signed-in request is answered 501 NOT_BUILT. U7 replaces a stub's body and never edits the registry."
    violation: "Not applicable."
    source: "FR19.5, NFR6"
  - id: BR14.2
    statement: "U5 creates one registry and one placeholder per staff page and one folder per diner feature."
    category: policy
    applies_to: StaffApp
    trigger: "Building the shell"
    logic: "The staff shell has one registry listing every staff page with its route, navigation label and placeholder page; U7 replaces its pages' files and never edits the registry. The diner shell has one mount point per U6 feature area. The client hooks for live events register every event name once (BR9.2)."
    violation: "Not applicable."
    source: "FR3.1, FR19.4"
  - id: BR14.3
    statement: "U5 provides the test helpers that let U6 and U7 be tested with only v1 and U5."
    category: policy
    applies_to: ApiRoutes
    trigger: "Building U5's tests"
    logic: "Helpers sign in as staff with the test PIN, place an order with options, move an order to Preparing or Completed, launch and end a special, open and respond to a service call, close a table and rate dishes, change a menu item, option or hidden flag directly and call publishMenuChange, and set a table's presence to a number of pages. The lockout reset (BR1.4) is one of them. None is reachable from a route."
    violation: "Not applicable."
    source: "NFR6, FR19.1"
  - id: BR14.4
    statement: "The diner and staff read routes the contract lists for U5 exist."
    category: policy
    applies_to: ApiRoutes
    trigger: "Building U5"
    logic: "U5 provides GET a table's calls (open and answered requests of the current visit), POST staff logout (204, clears the cookie, ends the session and its streams), GET staff session, the heartbeat route, and the extended answers: GET orders and the bill return per-line station and options and per-order estimate_minutes and completed_at, as contract 1 says."
    violation: "Not applicable."
    source: "FR17.1, FR3.5, FR8.3"
```

## Rules Summary (derived)

| Group | Rules | What they decide |
|---|---|---|
| BR1 Staff access | BR1.1 to BR1.9 | PIN source, session cookie, 12-hour idle end, address lockout, the guard on every staff route, the actor rule, return to the PIN screen, staff streams end with their session |
| BR2 Menu | BR2.1 to BR2.7 | Hidden items, stations, allergens, option groups, stable ids, seed, staff read |
| BR3 Orders | BR3.1 to BR3.10 | Option checks, frozen price, station and options, dropped lines, estimate stored, Completed time, replay, status rules, cancelled orders, all-or-nothing |
| BR4 Estimate | BR4.1 to BR4.3 | The formula, "Running late", the route |
| BR5 Specials | BR5.1 to BR5.5 | Launch, live, guarded stock, special pricing, live events and expiry |
| BR6 Calls | BR6.1 to BR6.3 | One open request per kind, respond, clear at close |
| BR7 Ratings | BR7.1 to BR7.2 | Which dishes, one per dish and the Done lock |
| BR8 Presence | BR8.1 to BR8.3 | Heartbeat, 5-minute window, the event |
| BR9 Live events and alerts | BR9.1 to BR9.4 | Publish after write, registered names, once-only alerts, sound and vibration |
| BR10 Look and theme | BR10.1 to BR10.6 | Tokens, theme choice, the five v1 screens, what stays, contrast, motion |
| BR11 Keeping v1 safe | BR11.1 to BR11.7 | Additive upgrade, seed, v1 tests, route order, environment settings, timestamps, mockup match |
| BR12 Stations | BR12.1 to BR12.2 | Station list on lines, done marks |
| BR13 Speed | BR13.1 to BR13.2 | 300 ms and 2 seconds |
| BR14 Seams and helpers | BR14.1 to BR14.4 | Guarded stubs, registries, test helpers, and the read routes the contract lists for U5 |

## Assumptions & Open Questions

- The allowance of 2 minutes per open order (BR4.1) and the 12-hour idle end (BR1.3, your answer) are starting values kept in one place so they are easy to change.
- Cancelling a special's order does not return its stock (BR5.3); this is accepted because the special is limited and time-boxed. Tell me if you want stock returned.
- Any caller can still cancel any Pending order (BR1.6), as in v1; this exposure is recorded as accepted, not fixed.
