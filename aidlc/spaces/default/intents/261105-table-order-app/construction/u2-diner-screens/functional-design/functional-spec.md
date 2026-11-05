# Functional Specification — U2 `u2-diner-screens`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Unit summary

U2 builds the diner's three screens — **Menu**, **Cart**, and **My orders** — mounted inside the tab shell U1 delivered at `/table/:id`. It owns `DinerApp` (all screens) and extends the `Menu` and `Ordering` reader paths. No server code changes required; U2 consumes the contracts U1 froze.

---

## Screen D1 — Menu

**Stories:** US1.1, US1.2  
**Requirements:** FR1.1, FR1.2, FR1.3

### Layout and structure

- Route `/table/:id` renders the MenuScreen by default (tab index 0).
- A **sticky category pill bar** sits just below the app top strip and blurs over the dark background as the user scrolls.
- Each item is a **card** with: emoji image (left), name (bold), description (muted), price (right-aligned). The **+ Add** pill is at the far right of the price row — 32 px visual height, 44 px touch target.
- Items are grouped in document order matching seed category order: Starters, Mains, Desserts, Drinks.

### Category pill behavior

- Tapping a pill smooth-scrolls (`behavior: 'smooth'`) to the first item in that category.
- A scroll observer (`IntersectionObserver`) watches the first item of each category; the pill becomes filled when its category is on screen (last category to enter the intersection wins).

### Item availability

- Items with `available: false` show a muted overlay over the card. The `+ Add` pill reads **Sold out** in `--text-disabled` color and is `disabled` / `aria-disabled`.
- Availability updates arrive via `MENU_AVAILABILITY_CHANGED` SSE events and are applied without a page reload.

### Adding to cart

- Tapping `+ Add` on a not-sold-out item: if the item is not in the cart, adds it at quantity 1; if already in the cart, increases quantity by 1 (max 20).
- After adding, the Cart tab badge increments by 1 with a 150 ms count-up animation (skipped under `prefers-reduced-motion`).
- If the item is already at quantity 20, the pill is disabled and reads **Max**.

### Empty and error states

| State | Display |
|---|---|
| Loading | Three shimmer placeholder cards |
| Empty DB | "The menu is not ready yet. Ask staff for help." |
| Fetch error | "We cannot reach the menu right now." + **Retry** button |

---

## Screen D2 — Cart

**Stories:** US2.1, US2.2, US2.3, US2.4, US2.5  
**Requirements:** FR1.3, FR1.4, FR1.5, FR1.6, FR1.7

### Cart storage

- Cart state is stored in `localStorage` keyed by `table_id`. It persists across page refreshes and tab closes on the same device during the same visit.
- Structure: `{ items: [{ menu_item_id, quantity }] }`. Prices are looked up from the live menu at render time (never stored).

### Cart line rendering

- Each line: emoji, name, quantity selector (`−  [N]  +`), price-per-item (muted), subtotal (right-aligned).
- `−` decrements by 1; at quantity 1 the button becomes **Remove**.
- `+` increments by 1 up to 20; at 20 the `+` button is disabled.
- Quantity input accepts direct keyboard entry in range 1–20; out-of-range values are clamped on blur.
- Tapping **Remove** (or setting quantity to 0) removes the line with a 150 ms fade; total recalculates immediately.
- **Clear all** button (top right, destructive) opens a confirmation modal: "Clear your cart?" / **Clear** / Cancel.

### Totals

- Cart totals are computed client-side: `quantity × price_cents` per line; combined total is the sum. All amounts are formatted as `$X.XX`.
- The **sticky cart summary bar** above the tab bar shows: "View cart (N items · $X.XX)" and **Place order** — visible only when the cart has ≥ 1 item.

### Placing an order

- **Place order** button (and the sticky summary button) POST to `POST /api/tables/:id/orders` with `{ placement_key: <uuid4>, lines: [...] }`.
- `placement_key` is generated once per Place tap, stored in `sessionStorage` to survive an in-flight network retry, cleared after success or hard failure.
- On success (`201` or `200`): clear the cart, show a toast "Order #N placed" for 3 seconds, switch the active tab to My orders.
- On partial success (some `dropped_lines`): clear the cart, show a banner naming each dropped item ("Chocolate cake sold out and was removed; the rest of your order went through."), switch to My orders.
- On error: show inline banner "We could not place your order. Please try again." Keep the cart intact.
- **Place order** is `disabled` when the cart is empty.

### Empty state

"Your cart is empty. Browse the menu to get started." with a **Back to menu** link that switches to the Menu tab.

---

## Screen D3 — My orders

**Stories:** US3.1, US3.2, US4.1  
**Requirements:** FR1.8, FR1.9, FR3.6, FR4.1, FR4.2, NFR5

### Order list

- On mount, fetches `GET /api/tables/:id/orders?visit=current` to populate the initial list.
- Orders are sorted newest-first by `placed_at`.
- Each order card shows: order number (`#N`), placed time (formatted `h:mma`), status pill, line items with emoji, name, quantity (`× N`), and subtotal.
- Status pills use both a word and an icon (NFR5):

| Status | Icon | Label |
|---|---|---|
| Pending | ⏳ | Pending |
| Preparing | 🔥 | Preparing |
| Completed | ✓ | Completed |
| Cancelled | ✗ | Cancelled |

### Live status updates

- Subscribes to `GET /sse/tables/:id` on mount.
- On `ORDER_PLACED` event: prepend the new order card to the list (no reload needed; full payload is in the event).
- On `ORDER_STATUS_CHANGED` event: find the matching card by `order_number` and update its status pill with a soft 150 ms pulse animation.
- On `TABLE_CLOSED` event: trigger the TableClosedTakeover (see below).

### Reconnect behavior

- Uses the browser `EventSource` API; on disconnect, reconnects with backoff: 1 s, 2 s, 5 s, 10 s, 15 s, 15 s, … sends `Last-Event-ID` header on reconnect.
- If reconnect takes more than 3 seconds, shows a "Reconnecting… Updates will resume shortly." banner.
- On reconnect, missed events replay from the ring buffer and statuses update accordingly.

### Cancel order

- Pending orders show a **Cancel order** button.
- Tapping it opens a confirmation modal: "Cancel order #N?" / **Yes, cancel** / Close.
- Confirming sends `POST /api/orders/:order_number/transition` with `{ to: "Cancelled", by: "diner" }`.
- On success, the status pill updates to Cancelled within 2 seconds on every connected view.
- Preparing and later orders have no Cancel action visible.

### Empty and loading states

| State | Display |
|---|---|
| Loading | Two shimmer order cards |
| No orders | "You have not placed any orders yet." |
| Reconnecting | Inline banner at top |

### Table-closed takeover (US4.1)

- Triggered by a `TABLE_CLOSED` SSE event whose `table_id` matches the current route.
- Renders a full-screen overlay (z-index above everything, suppresses the tab bar): large ✓ icon, "This table was closed", "Thanks for visiting!"
- Clears `localStorage` cart for this table.
- A device that was offline and reconnects receives the missed `TABLE_CLOSED` via SSE replay and shows the same takeover before allowing any interaction.
- Animation: 300 ms ease-out fade-in.

---

## Keyboard and accessibility (NFR6)

- Tab order: top strip → category pills (← → arrow key) → item cards (↑ ↓ arrow key within category, Tab between categories) → sticky cart summary → bottom tab bar.
- `Enter` or `Space` activates `+ Add`, **Place order**, tabs, and pills.
- All modals trap focus; `Escape` closes and returns focus to the trigger.
- Every interactive element has a visible 2 px accent focus ring.
- The Cart tab badge is announced as "Cart, N items" to screen readers.
- Status pills include a `role="status"` and `aria-live="polite"` on updates.
- The table-closed takeover includes `role="alertdialog"` and `aria-label="Table closed"`.

---

## Motion rules

- All transitions: `ease-out 150 ms` by default.
- Table-closed takeover fade: `300 ms`.
- When `prefers-reduced-motion: reduce`: all transitions set to `0 ms` (no animation, instant render).

---

## API calls made by U2

| Action | Endpoint | Method |
|---|---|---|
| Load menu | `/api/menu` | GET |
| Load orders | `/api/tables/:id/orders?visit=current` | GET |
| Place order | `/api/tables/:id/orders` | POST |
| Cancel order | `/api/orders/:order_number/transition` | POST (`by: "diner"`) |
| Subscribe live | `/sse/tables/:id` | SSE (EventSource) |

---

## Assumptions & Open Questions

None. Every screen state, cart storage, live update behaviour, refusals, and card layout are settled by upstream answers (Requirements Analysis, User Stories, Refined Mockups, and Contract Design).
