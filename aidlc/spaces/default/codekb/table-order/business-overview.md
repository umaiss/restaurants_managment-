# Business Overview: table-order

## Purpose

Table Order is a restaurant ordering app that runs as one Node process with one SQLite file on a machine on the restaurant's own network. Diners scan a QR code at their table, browse the menu on their phone and order; the kitchen sees orders live on a board; front-of-house staff manage the menu, tables, specials, bills and sales.

The code is version 2. Version 1 (menu, cart, orders, kitchen board, bill and close table) was built and signed off first; version 2 added 17 features and a new design system ("Paprika") on every screen, without removing anything from v1. The database is upgraded in place and only ever gains tables and columns.

## Users

| User | Where | Access |
|---|---|---|
| Diner | `/table/<number>` on a phone | Open: no sign-in. A table number in the address is the only identity. |
| Kitchen staff | `/staff` (Kitchen Board, station boards) | A 4-digit staff PIN opens a browser session |
| Front-of-house staff / manager | `/staff/*` (floor map, menu, special, sales, QR codes, bills, receipts) | The same staff PIN; there are no roles: every signed-in staff member sees every staff page |

## Key business capabilities

### Diner side
- Browse the menu by category, with sticky category pills and a bottom tab bar (Menu, Cart, My orders)
- Choose options on a dish (choose-one, choose-any, leave-out groups) with a live price
- Allergy profile kept on the device; unsafe dishes are marked and warned about before ordering
- Wait estimate before ordering; a three-step tracker (Pending, Preparing, Completed) with "Running late" when overdue
- Ready banner with buzz and sound (mutable)
- "Same again" re-adds a past order
- "Call the waiter" and "Ask for the bill" (with cash or card and an optional receipt)
- Chef's special card with countdown and stock
- Rate dishes (thumbs up or down, optional comment) after the table is closed; view the receipt
- Light, dark or follow-device theme

### Staff side
- **Kitchen Board**: every open table's orders, live; a tab per station (Grill, Cold, Bar, Desserts) with "<Station> done" marks; an order completes when every station with lines is done; ticket timers (amber "Slow" from 8 minutes, red "Late" from 15); new-order and service-call alerts with sound; tables that pulse while a diner is calling
- **Floor map**: each table as Empty, Browsing, Waiting, Eating or Needs the bill, live
- **Menu management**: add, edit and hide items and categories; options, allergens and stations; changes reach open menus within about 2 seconds
- **Chef's special**: launch one special at a time with price, stock and duration; end it early
- **Past visits and sales**: one card per day with visits, orders, total sales, average time to Completed, average per visit and best sellers; today's best and worst rated dishes; a month filter
- **QR codes**: a printable code per table; add and remove tables (removed tables are archived, their history stays)
- **Table bill and close**: the live bill of a table's current visit; close the table once no order is open; optional receipt page to print
- **Sign-in**: PIN screen with lockout after 5 wrong tries per address for 60 seconds; sessions end after 12 hours without staff action, on sign-out, or when the browser closes

## Business rules that matter most

- **Prices are frozen at placement**: an order line keeps the price (item or special price plus options) it was placed at; bills and sales never use today's menu price
- **Cancelled orders count nowhere**: not on bills, not in sales, not in best sellers
- **Sales are counted when a table is closed**: a sales day is the server-local calendar day of the visit's close time; money on tables still open is not in any sales figure
- **Order status rules**: Pending to Preparing or Cancelled; Preparing to Completed or Cancelled; Completed and Cancelled are final. A diner may only cancel a Pending order. Station marks move an order forward automatically
- **One open service call per kind per visit**; closing a table answers its open calls
- **At most one live Chef's special**; it ends on time, on sell-out, or when its item is hidden or sold out
- **The wait estimate** is today's average minutes to Completed (or 15 when none) plus 2 minutes per open order, at least 1
- **Hiding is not deleting**: items, categories and tables are hidden or archived, never removed, so history stays intact

## Business context for the active work

The current piece of work ("Manager TV wall") adds a staff-only, big-screen view of live orders with their waits, today's takings, the busiest table and the top dish, with a setting to hide takings and a link in the staff navigation. The existing figures closest to it are the Kitchen Board (live orders and timers) and the Past visits and sales page (closed-visit takings and best sellers); neither gives "today so far including open tables" or "busiest table". See `architecture.md` and `api-documentation.md` for what exists.

## Known limits (from the README and the code)

- Item names on old order lines are read from the current menu, so a rename changes how old orders show (prices stay frozen)
- Staff sessions live in server memory: a restart asks every device for the PIN again
- QR codes hold the address the staff page was opened on
- No deployment setup: one machine on the restaurant network, plain HTTP
