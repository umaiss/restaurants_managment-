# Interaction Specification — Table Order Web App

**Based on:** `mockups.md` from this stage, `stories.md` from `inception/user-stories/`, `requirements.md` from `inception/requirements-analysis/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Navigation and routing

| URL | Screen | Audience | Guard |
|---|---|---|---|
| `/table/:id` | D1 Menu (default), D2 Cart, D3 My orders via bottom tab | Diner | None (seeded table required) |
| `/staff` | S1 Kitchen Board | Staff | None [Q3] |
| `/staff/tables/:id` | S2 Table Bill | Staff | None |

- The three diner screens share one route and switch via the bottom tab bar; tab switches do not change the URL path but do update the `?tab=` query for refresh persistence.
- The staff view opens directly with no login or PIN. [Q3]

## Primary interactions

### P1 — Add to cart (D1)
- Tap **+ Add** on an item → animates the badge on the Cart tab by +1, item appears in the cart at quantity 1.
- If already in cart, repeated taps increase the quantity up to 20. [FR1.3]
- Sold-out items show a muted overlay; the pill reads **Sold out** and is non-interactive.

### P2 — Change cart line (D2)
- Tap `−` → decreases quantity by 1; at 1, becomes **Remove** on next tap.
- Tap `+` → increases quantity by 1 up to 20.
- Tap **Remove** → removes the line with a 150ms fade; the total recalculates.
- Tap **Clear all** → confirmation modal "Clear your cart?"; **Clear** removes every line.

### P3 — Place order (D2)
- Tap **Place order** on a non-empty cart → POSTs; on success, a toast "Order #N placed" lifts for 3 seconds and the cart clears; focus moves to **My orders**. [FR1.6]
- Sold-out guard: if any cart line is Sold out at submit time, that line is dropped and a banner names the dropped items. [FR1.7]
- Disabled when the cart is empty.

### P4 — Cancel order (D3)
- Only Pending orders show **Cancel order**. Tap → confirmation modal "Cancel order #N?"; **Yes, cancel** sends the transition. [FR1.8]
- After confirmation, the order pill switches to **Cancelled** within 2 seconds for every connected view. [FR4.1]

### P5 — Status transitions (S1)
- **Start preparing** is primary on Pending cards; **Mark completed** is primary on Preparing cards. Each updates every open screen within 2 seconds. [FR2.5], [NFR1]
- The **★ New** ring and glow on a Pending order disappear when it moves to Preparing (not just on this board — persists on every screen). [FR2.4]
- **Cancel** is secondary, available until Completed; after cancel, the card fades for 150 ms then disappears from the board. [FR2.6]

### P6 — Sold-out toggle (S1a)
- Open from **Menu availability** in the Kitchen Board header; opens a right-side panel (not a sixth screen). [Q3]
- Toggle switches propagate within 2 seconds to every open diner menu; an item currently in a cart is kept and dropped at placement time (see P3). [FR2.7], [FR1.7]

### P7 — Open the bill (S2)
- Click a table card header on the Kitchen Board → navigates to `/staff/tables/:id`.
- The bill shows every Completed and Pending/Preparing order, grouped by order number. [FR3.1]

### P8 — Close table (S2)
- **Close table** is disabled with a tooltip while any order is Pending or Preparing; the disabled label lists which orders are still open. [FR3.3]
- Also disabled when the table has no orders. [FR3.4]
- When enabled, a confirmation modal "Close Table N?" names the combined total. Confirm → within 2 seconds, every open `/table/:id` session for that table shows the takeover state and resets; the table is removed from the Kitchen Board; a reconnecting device applies the reset on first event. [FR3.5], [FR3.6]

## Live update behavior (shared)

- Server-Sent Events connection is opened on every page load.
- On disconnect, the client reconnects with exponential backoff (1s, 2s, 5s, 10s, 15s, 15s, …) and replays missed events on reconnect. [FR4.2]
- A small "reconnecting…" banner appears if a reconnect takes more than 3 seconds.

## Motion rules

- All transitions ease-out, 150 ms default, 300 ms for the full-screen table-closed takeover.
- All motion stops when the device asks for reduced motion (`prefers-reduced-motion: reduce`). [desc]

## Focus and keyboard

- Visible 2-px accent focus ring on every interactive control (buttons, pills, tabs, switches, inputs).
- Tab order follows visual flow: header → category pills → item cards → sticky cart summary → bottom tab bar. [NFR6]
- Arrow keys navigate between category pills and between items within a category; `Enter`/`Space` triggers **+ Add**.
- `Escape` closes modals and side panels and returns focus to the trigger.

## Modals and confirmations

| Destructive action | Confirmation text | Primary label |
|---|---|---|
| Cancel order (diner) | Cancel order #N? | Yes, cancel |
| Cancel order (staff) | Cancel order #N? | Yes, cancel |
| Clear cart | Clear your cart? | Clear |
| Close table | Close Table N? Combined total: $X.XX | Close table |
| Toggle Sold out on | Mark [item] as Sold out? Diners will not be able to add it. | Mark sold out |

## Error messages

Every error is surfaced inline, never silent. [phase: construction]

| Context | Message |
|---|---|
| Menu fails to load | We cannot reach the menu right now. [Retry] |
| Place order fails | We could not place your order. Please try again. |
| Cancel refused (not Pending) | This order can no longer be cancelled. |
| Live stream dropped | Reconnecting… Updates will resume shortly. |
| Close refused (orders open) | Close table is not available until every order is completed or cancelled. |
| Close refused (no orders) | This table has no orders to close. |
