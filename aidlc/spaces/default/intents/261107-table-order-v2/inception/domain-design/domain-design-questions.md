# Domain Design Questions

These questions come from the requirements, the stories and the code knowledge base of v1 (`aidlc/spaces/default/codekb/table-order/`). The component boundaries themselves follow v1's layers (menu, orders, tables, billing, live events, API routes), with a new building block for each new concern. Anything I settled myself is recorded as an ADR in `decisions.md` with its alternatives, so you can overturn it at the gate.

## Q1. [Architect] When is a dish's kitchen station fixed for an order?

Staff can change an item's station in Menu management while orders are open. This decides whether an order already placed keeps the station it had, which also decides how the per-station boards and "Completed when every station is done" work.

A. Fix it on each order line when the order is placed, like the price, so an order never changes station after it is placed (Recommended)
B. Look it up live from the menu, so a station change moves open orders to the new station
C. Not yet defined
X. Other (please specify)

[Answer]: A. Fix it on each order line when the order is placed

## Q2. [Architect] How does the floor map know a table is "Browsing"?

"Browsing" means a diner has the table's page open but has not ordered. v1 does not track who has a page open, so something has to.

A. Count the diner pages with an open live connection for that table; a table is Browsing while at least one is open and it has no order. A page that has gone quiet for 5 minutes stops counting (Recommended)
B. Drop the Browsing state, so a table with a diner page open and no order shows as Empty
C. Not yet defined
X. Other (please specify)

[Answer]: A. Count open live connections, with a 5-minute quiet limit
