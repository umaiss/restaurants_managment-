# User Stories — Table Order Web App

**Based on:** `requirements.md` from `inception/requirements-analysis/` and `personas.md` from this stage.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Priority

All stories are **Must Have** (MoSCoW). The scope document and intent backlog mark every feature Must Have. [Q1 of scope-definition], [Q2 of scope-definition]

## How stories are grouped

Stories are grouped **by journey within each feature**. The build slices (Units) come at Units Generation. [assumption]

---

## Journey J1 — Diner: open the table and browse the menu

### US1.1 — Open the customer view
**As a** diner,
**I want** to open the customer view by visiting `/table/:id`,
**so that** I can start ordering at my table without any login. [FR1.1], [NFR6]

**Acceptance criteria:**
- **Given** the app is running and table `5` is seeded,
  **When** I open `/table/5` in a browser,
  **Then** the Menu screen loads within 2 seconds.
- **Given** I open `/table/:id` for a seeded table,
  **When** the page loads,
  **Then** I see no login prompt.
- **Given** I open `/table/:id`,
  **When** the page loads,
  **Then** the bottom tab bar is visible with Menu selected, Cart and My orders tabs.
- **Given** I am on `/table/:id` with no mouse or touch,
  **When** I use only the keyboard (Tab, Shift+Tab, Enter, Space, arrow keys),
  **Then** I can reach and operate every interactive control on every diner screen (Menu, Cart, My orders).

### US1.2 — Browse menu items by category
**As a** diner,
**I want** to see the menu grouped by category with images, names, descriptions and prices,
**so that** I can decide what to order. [FR1.2]

**Acceptance criteria:**
- **Given** the menu is open,
  **When** the Menu screen loads,
  **Then** I see 12 items in 4 categories (Starters, Mains, Desserts, Drinks).
- **Given** I am on the Menu screen,
  **When** I tap a category pill,
  **Then** the list scrolls smoothly to the first item in that category.
- **Given** I am scrolling the menu,
  **When** a category's items are on screen,
  **Then** that category's pill is highlighted.
- **Given** an item is shown,
  **When** I look at its card,
  **Then** I see its image, name, description and price.

---

## Journey J2 — Diner: build a cart and place an order

### US2.1 — Add an item to the cart
**As a** diner,
**I want** to add a menu item to my cart with a single tap,
**so that** I can build my order quickly. [FR1.3]

**Acceptance criteria:**
- **Given** I see an item on the Menu,
  **When** I tap its "+ Add" pill,
  **Then** the item is added to my cart at quantity 1.
- **Given** an item is in my cart,
  **When** I tap "+ Add" again,
  **Then** its quantity increases by 1, up to a maximum of 20.
- **Given** an item is in my cart,
  **When** it is added,
  **Then** the Cart tab badge updates to show the new item count.

### US2.2 — Change cart quantities and remove items
**As a** diner,
**I want** to change quantities and remove items from my cart,
**so that** I can correct mistakes before placing the order. [FR1.4]

**Acceptance criteria:**
- **Given** an item is in my cart at quantity N,
  **When** I change the quantity to a value between 1 and 20,
  **Then** the line updates and the total recalculates.
- **Given** an item is in my cart,
  **When** I change its quantity to 0 or tap Remove,
  **Then** the line is removed and the total recalculates.
- **Given** my cart has items,
  **When** I look at the cart summary,
  **Then** I see every line with its quantity, price, subtotal and the combined total.

### US2.3 — Cart survives a page refresh
**As a** diner,
**I want** my cart to survive a page refresh,
**so that** I don't lose what I was adding if the page reloads. [FR1.5]

**Acceptance criteria:**
- **Given** my cart has items,
  **When** I refresh the page,
  **Then** every line in the cart is still there with the same quantities.
- **Given** I close and reopen the browser tab on the same device during the same visit,
  **When** the page loads,
  **Then** my cart is still there.

### US2.4 — Place an order
**As a** diner,
**I want** to place my order from the cart,
**so that** the kitchen receives what I want. [FR1.6]

**Acceptance criteria:**
- **Given** my cart has at least one item,
  **When** I tap "Place order",
  **Then** the server records a new order with a unique order number and the cart is cleared.
- **Given** the order was placed,
  **When** the confirmation shows,
  **Then** I see the order number and a link to "My orders".
- **Given** my cart is empty,
  **When** I look at the cart screen,
  **Then** "Place order" is disabled.

### US2.5 — Placing an order handles sold-out items
**As a** diner,
**I want** the app to handle sold-out items gracefully when I place an order,
**so that** I am not confused about which items made it to the kitchen. [FR1.7]

**Acceptance criteria:**
- **Given** an item in my cart was marked Sold out by staff,
  **When** I tap "Place order",
  **Then** the sold-out item is removed from the cart and the rest of the cart is placed as one order.
- **Given** the order was placed with a sold-out line dropped,
  **When** the result shows,
  **Then** a message names the sold-out item that was dropped.

---

## Journey J3 — Diner: track and cancel orders

### US3.1 — See live status of my orders
**As a** diner,
**I want** to see my orders with live status updates,
**so that** I know what is being prepared. [FR1.9], [FR4.1], [FR4.2]

**Acceptance criteria:**
- **Given** orders have been placed at my table,
  **When** I open "My orders",
  **Then** I see every order placed at the table during the current visit, with its current status.
- **Given** staff change an order's status on the kitchen board,
  **When** I am on "My orders",
  **Then** the status updates within 2 seconds without me refreshing.
- **Given** an order status changes,
  **When** I look at it,
  **Then** the status is shown with a word or icon, never colour alone.
- **Given** my device's live-event connection drops,
  **When** it is able to reconnect,
  **Then** the connection reopens within 5 seconds and I do not need to refresh.
- **Given** status changes happened while my device was disconnected,
  **When** the live-event connection reopens,
  **Then** every missed change is replayed in order and "My orders" shows the current status.

### US3.2 — Cancel a Pending order
**As a** diner,
**I want** to cancel an order while it is still Pending,
**so that** I can change my mind before the kitchen starts preparing it. [FR1.8]

**Acceptance criteria:**
- **Given** an order of mine is Pending,
  **When** I tap Cancel on that order,
  **Then** the order status moves to Cancelled and the kitchen board reflects the change within 2 seconds.
- **Given** an order of mine is Preparing or later,
  **When** I look at it in "My orders",
  **Then** the Cancel action is not available.
- **Given** an order was cancelled,
  **When** staff look at the bill for the table,
  **Then** the cancelled order does not appear on it.

---

## Journey J4 — Diner: the table is closed around me

### US4.1 — My device resets when staff close the table
**As a** diner,
**I want** my customer view to reset when staff close my table,
**so that** the next diner sees a clean device. [FR3.6]

**Acceptance criteria:**
- **Given** my customer view is open with items in the cart and orders in "My orders",
  **When** staff close the table,
  **Then** within 2 seconds the cart empties, "My orders" clears and a message says "This table was closed".
- **Given** my device was offline when the table was closed,
  **When** it reconnects,
  **Then** the same reset applies before I can place a new order.

---

## Journey J5 — Staff: see the live kitchen board

### US5.1 — Open the staff view
**As a** staff member,
**I want** to open `/staff` and see the kitchen board without any login,
**so that** I can start working immediately at the shared device. [FR2.1]

**Acceptance criteria:**
- **Given** the app is running,
  **When** I open `/staff` in a browser,
  **Then** the Kitchen Board loads within 2 seconds.
- **Given** I open `/staff`,
  **When** the page loads,
  **Then** I see no login prompt or PIN prompt.
- **Given** I open `/staff` on a shared device,
  **When** the board is on screen,
  **Then** no persistent session or cookie identifies me as a specific staff member.

### US5.2 — See every table's open orders on one board
**As a** staff member,
**I want** to see each table as a card with its open orders,
**so that** I can scan the whole restaurant at a glance. [FR2.2]

**Acceptance criteria:**
- **Given** orders exist at multiple tables,
  **When** I look at the Kitchen Board,
  **Then** every table with open orders has its own card listing its orders with items, quantities and status.
- **Given** a table has no open orders,
  **When** I look at the board,
  **Then** no card shows (or an empty state marker shows, per mockup).

### US5.3 — New orders appear highlighted within 2 seconds
**As a** staff member,
**I want** a new order to appear on the board highlighted within 2 seconds of placement,
**so that** I notice work arriving without refreshing. [FR2.3], [FR2.4], [NFR1]

**Acceptance criteria:**
- **Given** the board is open,
  **When** a diner places an order,
  **Then** the order appears on the correct table's card within 2 seconds, highlighted as "★ New".
- **Given** a new order is highlighted,
  **When** I move it to Preparing,
  **Then** the highlight clears.
- **Given** a new order is highlighted and the board is refreshed,
  **When** the refresh completes,
  **Then** the highlight is still shown until the order moves to Preparing.

---

## Journey J6 — Staff: update order status and sold-out items

### US6.1 — Move an order forward through its statuses
**As a** staff member,
**I want** to move an order from Pending to Preparing to Completed,
**so that** the kitchen tracks its work. [FR2.5]

**Acceptance criteria:**
- **Given** an order is Pending,
  **When** I tap "Start preparing",
  **Then** the order status moves to Preparing on the board and on every diner's "My orders" within 2 seconds.
- **Given** an order is Preparing,
  **When** I tap "Mark completed",
  **Then** the order status moves to Completed and the card updates.
- **Given** an order is Completed,
  **When** I look at it,
  **Then** no further forward transitions are available.

### US6.2 — Cancel an order from the kitchen board
**As a** staff member,
**I want** to cancel an order that hasn't been completed yet,
**so that** I can handle special situations. [FR2.6]

**Acceptance criteria:**
- **Given** an order is Pending or Preparing,
  **When** I tap Cancel,
  **Then** the order status moves to Cancelled and the diner's "My orders" updates within 2 seconds.
- **Given** an order is Completed,
  **When** I look at it,
  **Then** Cancel is not available.

### US6.3 — Mark a menu item as sold out
**As a** staff member,
**I want** to mark a menu item as sold out (and back again) from the Kitchen Board,
**so that** diners can't add it while it's out. [FR2.7]

**Acceptance criteria:**
- **Given** I open "Menu availability" from the Kitchen Board header,
  **When** I toggle an item's "Sold out" switch,
  **Then** every open customer view shows that item as "Sold out" within 2 seconds and cannot add it.
- **Given** an item is marked Sold out,
  **When** I toggle it back,
  **Then** diners can add it again within 2 seconds.

---

## Journey J7 — Staff: open the bill and close the table

### US7.1 — Open the itemised bill for a table
**As a** staff member,
**I want** to open an itemised bill for a table at `/staff/tables/:id`,
**so that** I can total what the diners owe. [FR3.1]

**Acceptance criteria:**
- **Given** a table has at least one Completed order,
  **When** I open the Table Bill screen for that table,
  **Then** I see every order with its number, items, quantities, prices and subtotal, plus one combined total for the table.
- **Given** a table has a Cancelled order,
  **When** I look at the bill,
  **Then** the cancelled order does not appear on it. [FR3.2]

### US7.2 — Close a table when every order is Completed or Cancelled
**As a** staff member,
**I want** to close the table once every order is resolved,
**so that** the table is reset for the next diner. [FR3.3], [FR3.4], [FR3.5]

**Acceptance criteria:**
- **Given** every order at the table is Completed or Cancelled,
  **When** I tap "Close table",
  **Then** the visit is archived and the table resets for the next diner.
- **Given** at least one order at the table is Pending or Preparing,
  **When** I look at the bill screen,
  **Then** "Close table" is disabled and the screen names the orders that are still open.
- **Given** the table has no orders at all,
  **When** I look at the bill screen,
  **Then** "Close table" is disabled.

---

## Journey J8 — Staff: start the app with one command

### US8.1 — Start the whole app with one command
**As a** staff member,
**I want** to start the whole app with `npm install && npm start`,
**so that** I can run the workshop without any setup. [FR5.1], [FR5.2], [NFR3]

**Acceptance criteria:**
- **Given** a fresh clone of the repository,
  **When** I run `npm install && npm start`,
  **Then** both the customer and staff views are reachable at `http://localhost:3000` and the database seeds 10 tables, 4 categories and 12 items on the first start.
- **Given** the server is running on port 3000,
  **When** I open `/table/5` and `/staff` in a browser,
  **Then** both views load.
- **Given** the machine has no internet connection,
  **When** I run the workshop end to end (place an order, update its status, open the bill, close the table),
  **Then** every step succeeds without any external service calls.

---

## MoSCoW Priority Summary

| Priority | Stories |
|---|---|
| Must Have | US1.1 … US8.1 |
| Should Have | *(none)* |
| Could Have | *(none)* |
| Won't Have (this release) | *(see scope-document.md Out of Scope)* |

Every story is Must Have, per the scope document. [Q1 of scope-definition], [Q2 of scope-definition]

---

## Assumptions & Open Questions

- Stories are grouped by journey; the build slices (Units) come at Units Generation. [assumption]
- The one-command start story (US8.1) is written for staff, since staff run the workshop machine. [assumption]
- No questions were asked at this stage. [assumption]
