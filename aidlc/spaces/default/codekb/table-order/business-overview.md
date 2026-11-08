# Business Overview

## Business Domain

Table Order is a restaurant dine-in ordering app. Diners scan or open a link for their table (`/table/<n>`), browse the menu, build a cart and place orders from their phone. Staff watch a live kitchen board on a larger screen, move orders through the kitchen, take a table's bill and close the table. The seeded restaurant has 10 tables, 4 menu categories and 12 dishes. Version 1 is signed off; Table Order v2 adds features on top of it.

## Business Purpose

- Let a diner order without waiting for a waiter, and see the state of what they ordered.
- Give the kitchen one live list of what to cook and for which table.
- Give staff one place to see a table's combined bill and close the table so the next party starts clean.

## Actors

| Actor | Where they work | What they do |
|---|---|---|
| Diner | `/table/:id` (phone-shaped column, bottom tab bar) | Browse Menu, fill Cart, place an order, watch My orders, cancel an order still Pending |
| Kitchen / floor staff | `/staff` (Kitchen Board) | Mark orders Preparing, Completed or Cancelled; switch menu items sold out or back |
| Staff at the till | `/staff/tables/:id` (Table Bill) | Review the combined bill, press Close table once every order is finished |

No sign-in exists for either role. The diner is identified only by the table number in the URL; staff screens are open to anyone who has the address.

## Key Functionality (v1, as built)

1. **Menu** — categories (Starters, Mains, Desserts, Drinks) with a sticky pill bar that scrolls to a category and highlights the one on screen; item cards with an emoji image, name, description, price and a "+ Add" pill; sold-out items show "Sold out" and cannot be added. Sold-out changes arrive live.
2. **Cart** — per-table cart in the browser (`localStorage`), quantity 1 to 20 per line, prices re-checked against the current menu when the cart opens, items no longer on the menu are removed with a notice. "Place order" asks for confirmation.
3. **Place order** — one order per submit with a placement key (safe to retry: a repeated key returns the same order). Lines sold out at submit time are dropped and listed to the diner ("The rest of your order went through").
4. **My orders** — the current visit's orders with status words and icons (Pending, Preparing, Completed, Cancelled), updating live; a diner may cancel only a Pending order, otherwise a notice explains the kitchen has started it.
5. **Kitchen Board** — one card per table that has any order in its current visit, newest order first, with a "new" glow for fresh Pending orders and buttons Start preparing, Complete and Cancel (with a confirm step). A table stays on the board until it is closed, so staff can still open its bill.
6. **Menu availability** — a side panel on the board to mark any item sold out or available.
7. **Table Bill** — all non-cancelled orders of the current visit, the combined total, and a Close table button that is available only when the visit has orders and none is Pending or Preparing; otherwise a note lists the blocking order numbers.
8. **Close table** — archives the visit (orders stay in the database), removes the table from the board, and shows the diner a full-screen "table closed" message and clears their cart. The next order at that table opens a new visit.
9. **Live updates** — Server-Sent Events keep diners and staff in sync within about 2 seconds; a reconnect banner shows after 3 seconds of disconnection and screens reload their data after reconnecting.

## Business Rules Visible in Code

- Order statuses: Pending, Preparing, Completed, Cancelled. Staff: Pending to Preparing or Cancelled; Preparing to Completed or Cancelled. Diner: Pending to Cancelled only. Completed and Cancelled are final (`LEGAL_TRANSITIONS`, `src/server/repositories/orderRepo.ts`).
- Quantity per line must be a whole number from 1 to 20.
- Money is whole cents; line price is frozen at order time (`order_items.unit_price_cents`).
- Order numbers are global and sequential across all tables.
- A table with no open visit is "closed"; a closed table is not refused an order, the next order opens a new visit.
- Closing needs: table exists, an open visit, at least one order, no Pending or Preparing order. A visit where every order was cancelled can still be closed.
- Cancelled orders are left off the bill.

## What v1 Does Not Do (relevant to v2 scope)

No staff sign-in or PIN, no notifications or waiter call, no past visits or sales reporting (closed visits are kept but never read back except `last_closed_visit_id`), no menu editing (only the sold-out toggle), no QR codes, no item options or notes, no allergen data, no wait-time estimate, no kitchen stations or ticket timers, no floor map, no theme switch (dark theme only), no ratings, no re-order. See `architecture.md` and `code-quality-assessment.md` for what each addition touches.

## Glossary

- **Visit** — one party's stay at a table, from its first order to Close table. Closing archives it; the table starts a fresh visit on the next order.
- **Placement key** — a client-made token per cart, so a retried submit cannot create a duplicate order.
- **Channel** — a live-event stream: `staff` (all tables) or `table:<id>` (one table).
- **Unit / Bolt** — AI-DLC build slices; v1 had U1 to U4 and Bolts 1 to 4.
