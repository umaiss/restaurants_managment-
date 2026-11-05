# Business Rules — U4 `u4-bill-and-close`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

---

## BR1 — Bill composition

**BR1.1** The bill lists only Completed and open (Pending/Preparing) orders; Cancelled orders are excluded from `orders[]`, from every subtotal, and from `combined_total_cents`. [FR3.2]

**BR1.2** `combined_total_cents` is the arithmetic sum of every included order's `subtotal_cents`. It is computed at read time, never stored. [FR3.1]

**BR1.3** Each order's `subtotal_cents` is the sum of its lines' `subtotal_cents` (`quantity × price_cents_each` per line). [FR3.1]

**BR1.4** Price data for the bill comes from the stored `price_cents_each` on each `OrderLine` (the price at order time), never from the current `MenuItem` price. This keeps the bill stable if prices change mid-visit. [assumption]

---

## BR2 — Close guard

**BR2.1** `close_available` is `true` only when **all** of the following hold: (a) the table has at least one order in this visit, and (b) every order in the visit is either `Completed` or `Cancelled`. [FR3.3], [FR3.4]

**BR2.2** `blocking_orders` lists the `order_number` of every order whose status is `Pending` or `Preparing`. When `close_available` is `true`, `blocking_orders` is an empty array. [FR3.3]

**BR2.3** A `POST /api/tables/:id/close` request when `close_available` is `false` is refused with error code `CLOSE_BLOCKED` (details include `blocking_orders`) or `TABLE_EMPTY` when there are zero orders. [FR3.3], [FR3.4]

**BR2.4** A `POST /api/tables/:id/close` request on an already-closed table is refused with `TABLE_ALREADY_CLOSED`. [assumption]

---

## BR3 — Close action effects

**BR3.1** On a successful close: `Tables.closeVisit(tableId)` archives the visit (marks it as closed, records `closed_at`). [FR3.5]

**BR3.2** The `TABLE_CLOSED` event is published to the `staff` channel and the `table:<tableId>` channel with payload `{ table_id, archived_visit_id }`. Every open diner view for the table must reset within 2 seconds. [FR3.6]

**BR3.3** After close, the Kitchen Board no longer shows the table (no open orders). [FR3.5]

---

## BR4 — Read consistency

**BR4.1** The bill is computed from live data at the time of the `GET /api/tables/:id/bill` call. No caching; a status change between requests is reflected on the next read. [assumption]

**BR4.2** `Billing` reads `Ordering` in-process (not via HTTP). `Billing` never writes to `Ordering`. [contract-summary.md]
