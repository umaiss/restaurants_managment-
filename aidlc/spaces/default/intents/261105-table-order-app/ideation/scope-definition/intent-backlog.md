# Intent Backlog — Table Order Web App

## Overview

The backlog is organised as four proto-Units, following the project's mandated build order: a walking skeleton first, then the diner screens and kitchen board in parallel, then the bill and close. Each proto-Unit is a vertical slice that can be built, tested and signed off independently after the skeleton is in place. [Q1], [desc]

All items are Must Have. No items are marked Should Have or Could Have. [Q2]

## Proto-Units

### U1 — Walking Skeleton

**Priority:** Must Have [Q1]
**Builds:** The shared foundation every other Unit depends on — the app shell, navigation, data model, order API, and live event stream.
**Success gate:** `npm install && npm start` starts the app at http://localhost:3000; the customer view loads at `/table/5`; the staff view loads at `/staff`; Server-Sent Events deliver a test event within 2 seconds. [desc]

Capabilities:
- One-command startup (`npm install && npm start`) [desc]
- App shell with routing to customer view (`/table/:id`) and staff view (`/staff`) [desc]
- SQLite database with seed data: 10 tables, 4 categories, 12 menu items [desc]
- Order API (create order, update status) [Q1]
- Live event stream (Server-Sent Events) delivering updates within 2 seconds [desc]

### U2 — Diner Screens

**Priority:** Must Have [Q1]
**Depends on:** U1 — Walking Skeleton
**Builds:** Menu, Cart and My Orders screens for the customer view.

Capabilities:
- Menu screen: browse by category with images, name, description and price [Q1]
- Cart screen: add/remove items, change quantity, live total, cart survives page refresh [Q1], [Q2]
- Place order and receive an order number [Q1]
- My Orders screen: live status view (Pending, Preparing, Completed, Cancelled) [Q1]

### U3 — Kitchen Board

**Priority:** Must Have [Q1]
**Depends on:** U1 — Walking Skeleton
**Builds:** The live staff kitchen board.

Capabilities:
- Grid of table cards; new order appears within 2 seconds, highlighted [Q1], [Q2]
- Status change controls: Pending → Preparing → Completed [Q1]
- Status changes reflected in diner's My Orders view within 2 seconds [desc]

### U4 — Bill and Close Table

**Priority:** Must Have [Q1]
**Depends on:** U1 — Walking Skeleton (build-order dependency on U2 and U3 for the parallel construction wave)
**Builds:** The table bill screen and close-table action for staff.

Capabilities:
- Staff open an itemised bill for a table: orders with items, quantities, prices and subtotals, plus a combined total [Q1]
- Close table: archives the visit and resets the table for the next diner [Q1]
- Customer view resets on close [desc]

## Build Order

| Order | Unit | Note |
|---|---|---|
| 1 | U1 Walking Skeleton | Built first, on its own; signed off before anything else starts |
| 2 | U2 Diner Screens | Built in parallel with U3 after the skeleton is signed off |
| 2 | U3 Kitchen Board | Built in parallel with U2 after the skeleton is signed off |
| 3 | U4 Bill and Close | Built on its own after U2 and U3 are merged and signed off |

## Assumptions & Open Questions

- The value stream map follows one table visit, from the diner sitting down to the table being reset. [assumption]
- If the session runs short, the team decides what to cut at the next approval point. Nothing is marked droppable in advance. [assumption]
- The brief's five open questions (order cancellation, closing with pending orders, staff access, sold-out items, bill format) stay open until Requirements Analysis. [assumption]
