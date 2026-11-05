# Requirements — Table Order Web App

**Based on:** `intent-statement.md`, `scope-document.md` and `intent-backlog.md` from `ideation/intent-capture/` and `ideation/scope-definition/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

---

## Actors

| ID | Actor | Description |
|---|---|---|
| A1 | Diner | A seated customer using the customer view at `/table/:id` on their own device. [Q1 of intent-capture] |
| A2 | Staff | A floor or kitchen staff member sharing the staff view at `/staff`. [Q2 of intent-capture] |

---

## Functional Requirements

### F1 — Order from the table (diner)

| ID | Requirement | Pass/Fail Criterion | Source |
|---|---|---|---|
| FR1.1 | The diner can open the customer view at `/table/:id` without login. | Opening `/table/:id` for any seeded table loads the Menu screen within 2 seconds. | [desc] |
| FR1.2 | The Menu screen lists all 12 seed items grouped under their 4 categories, each with image, name, description and price. | All 12 items visible with every field rendered. | [desc], [Q1 of scope-definition] |
| FR1.3 | The diner can add an item to the cart in any quantity from 1 to 20. | "+ Add" places the item at quantity 1; the cart line accepts quantities 1–20 and refuses 0 and 21. | [assumption] |
| FR1.4 | The diner can remove an item from the cart and change its quantity. | Changing to 0 removes the line; changing to 1–20 updates the live total. | [desc] |
| FR1.5 | The cart survives a page refresh on the same device. | Refreshing `/table/:id` restores the same cart contents. | [desc] |
| FR1.6 | The diner can place an order from a non-empty cart, receiving an order number. | POST succeeds; a unique order number is shown; the cart is cleared. | [desc] |
| FR1.7 | If a cart item was marked Sold out before the order is placed, placing the order removes that item from the cart and tells the diner which item sold out, keeping the rest of the cart. | A sold-out line is dropped on submission; a message names the item; remaining lines persist. | [Q4] |
| FR1.8 | A diner can cancel an order while its status is Pending; once it moves to Preparing it can no longer be cancelled. | The cancel action succeeds on Pending and is refused on Preparing or later. | [Q1] |
| FR1.9 | The cart is per device; "My orders" shows every order placed at this table during the current visit. | Multiple devices at the same table each keep their own cart; "My orders" on any of those devices lists every order placed at the table during the current visit. | [assumption] |

### F2 — Live kitchen board (staff)

| ID | Requirement | Pass/Fail Criterion | Source |
|---|---|---|---|
| FR2.1 | The staff view opens at `/staff` with no login or PIN. | Navigating to `/staff` loads the Kitchen Board directly. | [Q3] |
| FR2.2 | The Kitchen Board shows a card per table with its open orders and status. | For each table with open orders, a card appears listing the orders. | [desc] |
| FR2.3 | A newly placed order appears on the Kitchen Board within 2 seconds of placement and is highlighted as new. | Placing an order triggers the card update within 2 seconds and the order is visibly highlighted. | [desc] |
| FR2.4 | A new order stays highlighted until a staff member moves it to Preparing. | The highlight clears only on the Pending → Preparing transition. | [assumption] |
| FR2.5 | Staff can move an order status forward: Pending → Preparing → Completed. | Each transition succeeds; backward transitions are refused. | [desc], [assumption] |
| FR2.6 | Staff can cancel an order from the Kitchen Board at any status before Completed. | Cancel succeeds on Pending and Preparing; refused on Completed. | [desc] |
| FR2.7 | Staff can mark a menu item as sold out, and clear it, from the staff view. | Toggling sold-out succeeds; the state persists and reaches diner views within 2 seconds. | [Q4] |

### F3 — Bill and close (staff)

| ID | Requirement | Pass/Fail Criterion | Source |
|---|---|---|---|
| FR3.1 | Staff can open an itemised bill for a table at `/staff/tables/:id`. | The bill lists each order with its number, items, quantities, prices and subtotal, plus a combined total for the table. | [Q5] |
| FR3.2 | Cancelled orders do not appear on the bill. | A cancelled order is excluded from both the item lines and the combined total. | [Q1] |
| FR3.3 | "Close table" is available only when every order at the table is Completed or Cancelled. | The action is disabled if any order is Pending or Preparing; the bill screen lists which orders are still open. | [Q2] |
| FR3.4 | "Close table" is unavailable when the table has no orders. | A table with zero orders cannot be closed. | [assumption] |
| FR3.5 | Closing a table archives the visit and resets the table for the next diner. | After closing, the staff view no longer shows the table as having open orders; the archive record is written. | [desc] |
| FR3.6 | Closing a table resets every open customer view for that table within 2 seconds: cart empty, "My orders" empty, and a message saying the table was closed. A device that was offline does the same when it reconnects. | Every open `/table/:id` session for that table receives the reset within 2 seconds; a reconnecting device applies the reset on its first event. | [R-01] |

### F4 — Live updates (shared)

| ID | Requirement | Pass/Fail Criterion | Source |
|---|---|---|---|
| FR4.1 | Server-Sent Events deliver status changes and sold-out changes to connected clients within 2 seconds. | An update event reaches the client within 2 seconds of the change. | [desc], [assumption] |
| FR4.2 | A client that drops its connection reconnects automatically and catches up on missed events. | Reconnection succeeds within 5 seconds; missed events replay in order. | [desc], [assumption] |

### F5 — Seed data & startup (shared)

| ID | Requirement | Pass/Fail Criterion | Source |
|---|---|---|---|
| FR5.1 | `npm install && npm start` starts the app at `http://localhost:3000`. | Exit code 0; both views load. | [desc] |
| FR5.2 | The database seeds 10 tables, 4 categories and 12 menu items on first start. | On an empty database, startup creates the seed rows; counts match. | [desc] |

---

## Non-Functional Requirements

| ID | Requirement | Pass/Fail Criterion | Source |
|---|---|---|---|
| NFR1 | New orders appear on the Kitchen Board within 2 seconds of placement. | Measured at the 95th percentile over a 10-order burst. | [desc] |
| NFR2 | Status changes reach the diner's "My orders" view within 2 seconds of the staff change. | Measured at the 95th percentile. | [assumption] |
| NFR3 | The app runs on a local machine only; no cloud dependency. | Running offline (no internet) still works end to end. | [desc] |
| NFR4 | Prices use one currency, with no tax or service charge. | Every price shown in a single currency; no tax/service lines on the bill. | [assumption] |
| NFR5 | Order statuses are shown with words or icons, not colour alone. | Every status is accompanied by a text label or icon. | [assumption] |
| NFR6 | The whole app is usable by keyboard alone. | Every interactive control is reachable and operable with keyboard only. | [desc] |

---

## State Machines

### Order status

```
Pending ──► Preparing ──► Completed
   │             │
   └──► Cancelled◄┘
```

- From Pending: a diner or staff member can cancel; staff can move to Preparing.
- From Preparing: only staff can cancel or complete.
- From Completed or Cancelled: no further transitions. [assumption]

### Menu item availability

```
Available ◄──► Sold out
```

Toggled by staff only; does not affect existing orders. [Q4]

---

## Assumptions & Open Questions

- A status change reaches the diner within 2 seconds. [assumption]
- Each device keeps its own cart, and "My orders" shows the whole table's orders for the visit. [assumption]
- Order numbers are unique across the restaurant. [assumption]
- A cart line holds 1 to 20 of an item. [assumption]
- A new order stays highlighted until it moves to Preparing. [assumption]
- Statuses only move forward, one step at a time. [assumption]
- A sold-out mark is not menu management. [assumption]
- Prices use one currency, with no tax or service charge. [assumption]
- Archived visits are stored but shown nowhere. [assumption]
- "Close table" is unavailable when a table has no orders. [assumption]
- Status is shown with words or icons, never by colour alone. [assumption]
- The corner-case requirements are recommended defaults. [assumption]

## Initial Scope Signal

Workflow-selected scope: `dpl-workshop` [scope]
