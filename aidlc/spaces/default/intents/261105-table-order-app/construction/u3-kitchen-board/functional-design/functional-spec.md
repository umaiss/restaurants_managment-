# Functional Specification — U3 `u3-kitchen-board`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Unit summary

U3 builds the **Kitchen Board** and the **Menu Availability side panel** inside the StaffApp shell U1 delivered at `/staff`. It owns `KitchenBoardScreen` and `MenuAvailabilityPanel` and extends `Ordering` (forward transitions + cancel) and `Menu` (availability toggle). No new server routes are required; U3 consumes the contracts U1 froze.

---

## Screen S1 — Kitchen Board

**Stories:** US5.1, US5.2, US5.3, US6.1, US6.2  
**Requirements:** FR2.1, FR2.2, FR2.3, FR2.4, FR2.5, FR2.6, NFR1, NFR5

### Layout and structure

- Route `/staff` renders the KitchenBoardScreen inside the StaffView shell U1 delivered.
- The board header shows "Kitchen Board", a "Updated live" indicator (pulses green while SSE is connected), and a **[ Menu availability ]** button on the right.
- Below the header, a **responsive grid** of TableCards — one per table that has at least one open order (Pending or Preparing). Tables with only Completed or Cancelled orders, or no orders, show no card.
- Cards are ordered by table number ascending.
- Each card has a header showing "Table N →" (the chevron + heading links to `/staff/tables/:id`; announces "Open bill for Table N" to screen readers).
- Within a card, orders are listed newest-first by `placed_at`.

### New-order highlight (Q1 answer: Answer A)

**Every Pending order is highlighted as "★ New" until it moves to Preparing or is cancelled.**

- The highlight is a ring + soft glow applied to the order row when `status === 'Pending'`.
- The highlight persists across page refreshes and is visible on every simultaneously open staff screen, because it is derived from the server-side `status` field, not from client-side session state.
- When a Pending order moves to Preparing (via `ORDER_STATUS_CHANGED` SSE event or the `[Start preparing]` action), the highlight disappears immediately with a 150 ms ease-out transition.
- Both order #14 and order #15 in the board mockup are highlighted because both are Pending.

### Order row rendering

Each order row within a TableCard shows:

| Element | Content |
|---|---|
| Status pill | Icon + label (see NFR5 table below) |
| "★ New" ring | Present when `status === 'Pending'` |
| Order number | "#N" |
| Placed time | Formatted `h:mma` |
| Line items | Emoji, name, × quantity |
| Action buttons | See transitions table below |

**Status icons (NFR5 — word + icon always, never colour alone):**

| Status | Icon | Label |
|---|---|---|
| Pending | ⏳ | Pending |
| Preparing | 🔥 | Preparing |
| Completed | ✓ | Completed |
| Cancelled | ✗ | Cancelled |

**Action buttons per status:**

| Status | Primary action | Secondary action |
|---|---|---|
| Pending | **Start preparing** | **Cancel** |
| Preparing | **Mark completed** | **Cancel** |
| Completed | *(none)* | *(none)* |
| Cancelled | *(none)* | *(none)* |

### Status transitions

- **Start preparing**: POSTs `{ to: "Preparing", by: "staff" }` to `POST /api/orders/:order_number/transition`.
- **Mark completed**: POSTs `{ to: "Completed", by: "staff" }`.
- **Cancel**: opens a confirmation modal "Cancel order #N?" / **Yes, cancel** / Close, then POSTs `{ to: "Cancelled", by: "staff" }`.
- On `ORDER_STATUS_CHANGED` SSE event: update the matching row in place (150 ms ease-out); if the last open order on a table moves to Completed or Cancelled, the TableCard fades out (150 ms) and is removed from the grid.
- Illegal transitions return `422 ILLEGAL_TRANSITION`; show an inline error on that order row: "This change is no longer possible. Reload to see the latest state."

### Live updates

- Subscribes to `GET /sse/staff` on mount.
- On `ORDER_PLACED` event: add a new order row to the correct TableCard (or create a new card for the table if it has no existing card). The order arrives highlighted as "★ New" (Pending). Full order payload in the event — no follow-up fetch needed.
- On `ORDER_STATUS_CHANGED` event: update the matching order row; remove the card when all orders on the table are Completed/Cancelled.
- On `MENU_AVAILABILITY_CHANGED` event: update the menu availability panel if it is open; no effect on the board itself.
- On `TABLE_CLOSED` event: remove the matching table card.
- Reconnect uses the same exponential backoff as U2 (`useStaffSSE` hook). If disconnected more than 3 seconds: show "Reconnecting… Updates will resume shortly." banner in the board header.

### Empty and loading states

| State | Display |
|---|---|
| Loading | Three shimmer table cards |
| No open orders | ⚪ icon + "No open orders right now. Orders will appear here within 2 seconds of placement." |
| Reconnecting | Inline banner in header |

---

## Screen S1a — Menu Availability Side Panel

**Stories:** US6.3  
**Requirements:** FR2.7

### Layout

- Opens from the **[ Menu availability ]** button in the Kitchen Board header.
- Renders as a **right-side panel** (slide-in from the right, 320 px wide) — not a new route, not a modal overlay of the board, but a panel alongside it. On narrow viewports (< 768 px) it becomes a bottom sheet.
- A **[ Done ]** button at the bottom closes the panel; `Escape` also closes it and returns focus to the trigger.

### Content

- Lists all 12 seed items in seed order (Starters, Mains, Desserts, Drinks).
- Each row: emoji, item name, a **toggle switch** labelled "Sold out" (checked = sold out).
- Initial state loaded by `useMenuAvailability`, which performs its own `GET /api/menu` on mount independently of the board's per-table order fetches.
- On toggle: POSTs `{ available: false }` or `{ available: true }` to `POST /api/menu/items/:id/availability`.
  - Before toggling to Sold out: opens a confirmation modal "Mark [item name] as Sold out? Diners will not be able to add it." / **Mark sold out** / Cancel.
  - Toggling back to available: no confirmation needed; posts immediately.
- On SSE `MENU_AVAILABILITY_CHANGED`: updates the matching row's switch state live (panel need not be re-opened).
- On POST error: reverts the switch to its previous state and shows an inline error on that row.

### Keyboard and accessibility

- Panel is `role="dialog"` with `aria-label="Menu availability"`.
- Focus is trapped within the panel while open.
- Each switch is `role="switch"` with `aria-checked` reflecting the current state.
- `Escape` closes the panel.

---

## Keyboard and accessibility (NFR6)

- Tab order on the board: board header → "Menu availability" button → TableCards (top-left to bottom-right) → within each card: table link → order rows → action buttons.
- Action buttons are reached by Tab within a card.
- `Enter` / `Space` triggers action buttons and the "Menu availability" button.
- All modals trap focus; `Escape` closes and returns focus to the trigger.
- Visible 2 px accent focus ring on every interactive element.
- TableCard links have `aria-label="Open bill for Table N"`.

---

## Motion rules

- Order row transitions (status change, card removal): `ease-out 150 ms`.
- "★ New" highlight appearance: fade-in `150 ms`.
- Side panel slide-in: `200 ms ease-out`.
- When `prefers-reduced-motion: reduce`: all transitions `0 ms` (instant).

---

## API calls made by U3

| Action | Endpoint | Method |
|---|---|---|
| Load orders (initial board) | `/api/tables/:id/orders?visit=current` (called per table for all 10 seed tables on mount) | GET |
| Load menu (for availability panel) | `/api/menu` | GET |
| Start preparing | `/api/orders/:order_number/transition` | POST (`by: "staff"`) |
| Mark completed | `/api/orders/:order_number/transition` | POST (`by: "staff"`) |
| Cancel order | `/api/orders/:order_number/transition` | POST (`by: "staff"`) |
| Toggle availability | `/api/menu/items/:id/availability` | POST |
| Subscribe live | `/sse/staff` | SSE (EventSource) |

**Initial board population strategy:** On mount, load all open orders by calling `GET /api/tables/:id/orders?visit=current` for each of the 10 seed tables (or one aggregation query). The SSE stream is then the sole source of truth for subsequent updates.

---

## Assumptions & Open Questions

No open questions. The Q1 answer (Answer A) settles the highlight rule: every Pending order is highlighted as "★ New" until it moves to Preparing or is cancelled. The side panel (S1a) design was settled at Q3 of Refined Mockups. All other screen states, transition rules, and SSE event handling are settled by upstream Requirements Analysis, User Stories, Refined Mockups, and Contract Design.
