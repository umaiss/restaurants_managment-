# Functional Specification — U4 `u4-bill-and-close`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Unit summary

U4 builds the **Billing** server component (full), the **Table Bill screen** at `/staff/tables/:id`, and the **Close table** action. It extends `Tables` with the close operation. No other Unit's code changes — U4 builds on top of U1's frozen contracts and adds two new server endpoints plus one new staff screen.

---

## Server — Billing component

U4 owns `GET /api/tables/:id/bill` and `POST /api/tables/:id/close`.

### `GET /api/tables/:id/bill`

Builds the itemised bill for the table's current visit. Calls `getOrdersForVisit(tableId, visitId)` from `Ordering` in-process (no HTTP round trip).

**Response 200** (see `contract-summary.md` for the full shape):
```json
{
  "table_id": 5,
  "orders": [
    {
      "order_number": 15,
      "status": "Completed",
      "placed_at": "2026-11-05T19:04:00Z",
      "lines": [
        { "menu_item_id": "i-04", "name": "Classic burger", "quantity": 2, "price_cents_each": 1050, "subtotal_cents": 2100 }
      ],
      "subtotal_cents": 2400
    }
  ],
  "combined_total_cents": 3500,
  "close_available": true,
  "blocking_orders": []
}
```

**Rules applied (see `rules.md`):**
- Cancelled orders are excluded from `orders[]` and from all totals (BR1.1).
- `combined_total_cents` is computed from included orders only (BR1.2).
- Prices come from stored `OrderLine.price_cents_each`, not the current menu (BR1.4).
- `close_available` is `true` only when all orders are Completed/Cancelled AND ≥1 order exists (BR2.1).
- `blocking_orders` lists the order numbers still Pending or Preparing (BR2.2).

**Error codes:** `UNKNOWN_TABLE` (404).

### `POST /api/tables/:id/close`

Closes the table.

**Request body:** `{}` (empty)

**Success response 200:**
```json
{ "closed": true, "archived_visit_id": "7a7b-...-fe" }
```

**Rules applied:**
- Refused with `CLOSE_BLOCKED` (422) when any order is Pending or Preparing; `details.blocking_orders` lists them (BR2.3).
- Refused with `TABLE_EMPTY` (422) when the table has zero orders (BR2.3).
- Refused with `TABLE_ALREADY_CLOSED` (409) when the table is already closed (BR2.4).
- On success: `Tables.closeVisit(tableId)` archives the visit (BR3.1), then publishes `TABLE_CLOSED` to both `staff` and `table:<tableId>` SSE channels (BR3.2).

---

## Screen S2 — Table Bill

**Stories:** US7.1, US7.2  
**Requirements:** FR3.1, FR3.2, FR3.3, FR3.4, FR3.5, FR3.6  
**Route:** `/staff/tables/:id`

### Layout and structure

- Reached by clicking a table card header on the Kitchen Board ("Table N →" link).
- Header: "Table N — Bill" on the left; **[ ← Board ]** link on the right, navigating back to `/staff`.
- Lists each order in placement order: order number (`#N`), status pill (icon + word, NFR5), placed time, then each line item (emoji, name, `× quantity`, price each, subtotal).
- After all orders: a divider row and **Combined total** (formatted `$X.XX`).
- Below the total: **[ Close table ]** button (accent color when enabled) and an open-orders note.
- Cancelled orders are never shown (BR1.1).

### Close table button state

| State | Appearance | Explanation below button |
|---|---|---|
| Enabled | Accent, clickable | "One or more orders still open: — none —" (or hidden) |
| Disabled — open orders | Greyed, `disabled` | "One or more orders still open: #N, #M" |
| Disabled — no orders | Greyed, `disabled` | "This table has no orders to close." |

### Close table flow

1. When enabled: tap **Close table** → confirmation modal "Close Table N? Combined total: $X.XX" / **Close table** / Cancel.
2. Confirming: POSTs `POST /api/tables/:id/close`.
3. On success: within 2 seconds every open `/table/:id` session for the table shows the TableClosedTakeover. The Kitchen Board removes the table card. The bill screen navigates back to `/staff`.
4. On error `CLOSE_BLOCKED`: show inline banner "Close table is not available until every order is completed or cancelled." and re-enable the button.
5. On error `TABLE_EMPTY`: show inline banner "This table has no orders to close."
6. On error `TABLE_ALREADY_CLOSED` (409): navigate back to `/staff` immediately — the table was already closed by another session, same behaviour as receiving a `TABLE_CLOSED` SSE event.

### Live updates on the bill screen

- Subscribes to `GET /sse/staff` on mount (same channel as the Kitchen Board).
- On `ORDER_STATUS_CHANGED` for this table: re-fetches `GET /api/tables/:id/bill` and re-renders the bill and close guard. The 2-second SSE delivery means `close_available` is fresh within 2 seconds of a staff action.
- On `TABLE_CLOSED` for this table: navigates to `/staff` immediately (the table was closed from another session).

### Loading and error states

| State | Display |
|---|---|
| Loading | Shimmer for 2–3 order rows |
| Fetch error | "We cannot load the bill right now." + **Retry** button |
| Table has no orders | Bill section empty; Close table disabled with "no orders" message |

---

## Keyboard and accessibility (NFR6)

- Tab order: Back link → order rows (read-only, no interactive controls) → Close table button.
- **Close table** button is `disabled` (not `aria-disabled`) when not available, so it is excluded from tab order when disabled.
- The confirmation modal traps focus; `Escape` closes it.
- Visible 2 px accent focus ring on Back link and Close table button.
- Status pills use icon + label (NFR5).

---

## Motion rules

- Bill rows: each card eases in one after another (`380 ms`, staggered `45 ms`) and lifts slightly under the pointer. (Changed on 2026-11-07 at the person's request for a more modern, animated look; it was "no animation".)
- Close confirmation modal: `150 ms ease-out` fade-in.
- When `prefers-reduced-motion: reduce`: modal appears instantly.

---

## API calls made by U4

| Action | Endpoint | Method |
|---|---|---|
| Load bill | `/api/tables/:id/bill` | GET |
| Close table | `/api/tables/:id/close` | POST |
| Subscribe live | `/sse/staff` | SSE (EventSource) |

---

## Frontend component outline

```
TableBillScreen (src/client/screens/TableBillScreen.tsx)
├── BillHeader              — "Table N — Bill" + "← Board" link
├── BillOrderList
│   └── BillOrderCard (×N) — order number, status pill, placed time, line items
│       └── BillLineItem (×M)
├── BillTotal               — combined total
├── CloseTableSection
│   ├── CloseTableButton    — enabled/disabled per bill response
│   └── BlockingOrdersNote
└── ConfirmModal            — src/client/components/ConfirmModal.tsx (walking skeleton shared component, not U2)

src/client/hooks/
  useBill.ts               — fetches GET /api/tables/:id/bill + SSE-triggered re-fetch
src/server/
  routes/billing.ts        — GET /api/tables/:id/bill, POST /api/tables/:id/close
  repositories/billingRepo.ts — buildBill(), closeTable()
```

---

## Assumptions & Open Questions

No open questions. All bill display rules and close guard conditions are settled upstream (Requirements Analysis, User Stories, Refined Mockups, Contract Design).
