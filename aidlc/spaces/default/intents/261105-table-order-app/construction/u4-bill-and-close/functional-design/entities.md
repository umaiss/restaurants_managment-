# Entities — U4 `u4-bill-and-close`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Owned entities

U4 owns `Billing` and `CloseAction` per the domain design. It reads `Order`, `OrderLine`, and `Visit` from `Ordering` and `Tables` via in-process calls; it never writes to those components.

---

### Bill

Computed view — not persisted. Built on demand from live order data.

| Field | Type | Notes |
|---|---|---|
| `table_id` | `number` | From the URL |
| `orders` | `BillOrder[]` | Non-cancelled orders only, in placement order |
| `combined_total_cents` | `number` | Sum of all `orders[].subtotal_cents` |
| `close_available` | `boolean` | True only when every order is Completed/Cancelled AND ≥1 order exists |
| `blocking_orders` | `number[]` | Order numbers that keep `close_available` false |

### BillOrder

One order on the bill.

| Field | Type | Notes |
|---|---|---|
| `order_number` | `number` | — |
| `status` | `OrderStatus` | Completed or Pending/Preparing (Cancelled orders are excluded from the list entirely) |
| `placed_at` | `ISO8601 string` | — |
| `lines` | `BillLine[]` | — |
| `subtotal_cents` | `number` | Sum of `lines[].subtotal_cents` |

### BillLine

One item on a bill order.

| Field | Type | Notes |
|---|---|---|
| `menu_item_id` | `string` | — |
| `name` | `string` | Item name at time of order |
| `quantity` | `number` | — |
| `price_cents_each` | `number` | — |
| `subtotal_cents` | `number` | `quantity × price_cents_each` |

### CloseAction

Not a persistent entity — the action itself. Encapsulates the close guard.

| Field | Type | Notes |
|---|---|---|
| `table_id` | `number` | — |
| `archived_visit_id` | `string` (UUID v4) | Returned on success |

---

## Entities owned by other components (read-only by U4)

| Entity | Owner | How U4 reads it |
|---|---|---|
| `Order` | Ordering | In-process `getOrdersForVisit(tableId, visitId)` (contract-summary.md name) |
| `OrderLine` | Ordering | Included in Order read |
| `Visit` | Tables | In-process `getCurrentVisit(tableId)` / `closeVisit(tableId)` — `getCurrentVisit` is not in the shared contracts; local addendum below [assumption] |

### Local contract addendum — `Tables.getCurrentVisit`

Not named in `contract-summary.md`; documented here as the assumed in-process boundary for `billingRepo.ts`:

| Item | Value |
|---|---|
| Signature | `getCurrentVisit(tableId: number): Visit \| null` |
| Return (open) | `{ visitId: string, tableId: number, openedAt: string }` |
| Return (none) | `null` — table has no active visit (zero orders) |
| Error | Throws `UNKNOWN_TABLE` when `tableId` does not exist |

`billingRepo.buildBill()` calls this first; a `null` return produces a bill with `orders: []`, `combined_total_cents: 0`, `close_available: false`, `blocking_orders: []`.
