# Personas — Table Order Web App

**Based on:** `requirements.md` from `inception/requirements-analysis/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

---

## P1 — Diner

**Role:** Seated customer ordering from their own device at a specific table. [Q2 of intent-capture]

**Context:** Opens the customer view at `/table/:id` without any login. Uses the app on a phone during one visit. [desc]

**Goals:**
- See the menu and order what they want without waiting for staff attention.
- Track the status of what they ordered.
- Change their mind before the kitchen starts preparing an order.

**Pain points:**
- Not knowing if the order was received.
- No way to see what's coming next.

**Needs from the app:**
- A clear menu grouped by category, with images, descriptions and prices.
- A cart that keeps what they added even if the page reloads.
- A live view of order status.
- Ability to cancel while still Pending.

---

## P2 — Staff

**Role:** Floor or kitchen staff member serving multiple tables, using one shared staff view. [Q2 of intent-capture]

**Context:** Opens `/staff` on a shared device (tablet or laptop) at the restaurant; no login during the workshop. [Q3 of requirements-analysis]

**Goals:**
- See every table's open orders at a glance.
- Move orders through the kitchen (Pending → Preparing → Completed).
- Mark items as sold out when they run out.
- Open a table's bill and close the table when the diners leave.

**Pain points:**
- Losing track of which orders are new or in progress.
- Taking paper orders to the kitchen.

**Needs from the app:**
- A live board that highlights new orders within 2 seconds.
- One-click status transitions.
- A toggle for sold-out items.
- An itemised bill and a Close table action that resets the table for the next diner.

---

## Assumptions & Open Questions

- Two personas are enough: one diner and one staff member cover every user action in the brief and in `requirements.md`. Floor and kitchen staff share the same view, so they share one persona. [assumption]
