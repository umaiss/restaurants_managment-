# Frontend Components — U3 `u3-kitchen-board`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Component tree

```
StaffView (src/client/views/StaffView.tsx — U1 shell, extended here)
├── BoardHeader
│   ├── LiveIndicator          — pulses green while SSE connected
│   └── MenuAvailabilityButton — opens the side panel
├── KitchenBoardScreen
│   ├── TableCard (×N, one per table with open orders)
│   │   ├── TableCardHeader    — "Table N →" link to /staff/tables/:id
│   │   └── OrderRow (×N, newest first)
│   │       ├── StatusPill
│   │       ├── NewHighlight   — ring + glow, Pending only
│   │       └── ActionButtons
│   │           ├── PrimaryActionButton  (Start preparing / Mark completed)
│   │           └── CancelButton
│   ├── BoardEmptyState
│   ├── BoardShimmer           — 3 shimmer cards while loading
│   └── ReconnectBanner
├── MenuAvailabilityPanel      — right-side panel (portal)
│   ├── AvailabilityRow (×12)
│   │   └── SoldOutSwitch
│   └── DoneButton
└── ConfirmModal               — shared portal (reused from U2)
```

---

## Component specifications

### `BoardHeader`

| Prop | Type | Notes |
|---|---|---|
| `connected` | `boolean` | Drives `LiveIndicator` |
| `onMenuAvailabilityClick` | `() => void` | Opens side panel |

### `LiveIndicator`

| Prop | Type | Notes |
|---|---|---|
| `connected` | `boolean` | Green pulsing dot when `true`; grey when `false` |

Renders "Updated live" text + dot. Dot pulses with a 2s `animation` (suppressed by `prefers-reduced-motion`).

### `MenuAvailabilityButton`

Standard button that calls `onMenuAvailabilityClick`. `aria-expanded` reflects panel open state. `aria-controls="menu-availability-panel"`.

### `KitchenBoardScreen`

Owns the board state: map of `tableId → Order[]`. Subscribes to `useStaffSSE`. Renders `TableCard` for each table that has at least one open (Pending or Preparing) order.

### `TableCard`

| Prop | Type | Notes |
|---|---|---|
| `tableId` | `number` | Used for header link |
| `orders` | `Order[]` | Newest-first sorted |
| `onTransition` | `(orderNumber, to) => void` | Bubbles up to screen |

Renders `TableCardHeader` and `OrderRow` per order. When all orders are Completed/Cancelled, the card fades out (150 ms) before removal.

### `TableCardHeader`

| Prop | Type | Notes |
|---|---|---|
| `tableId` | `number` | — |

Renders `<a href="/staff/tables/:id">Table N →</a>` with `aria-label="Open bill for Table N"`. Hover background uses `--bg-overlay`. Visible focus ring.

### `OrderRow`

| Prop | Type | Notes |
|---|---|---|
| `order` | `Order` | Full order shape |
| `onTransition` | `(to: OrderStatus) => void` | — |

Renders `NewHighlight` (ring + glow) when `status === 'Pending'`. Renders `StatusPill`, order number, placed time, line items (emoji, name, × qty), and `ActionButtons`. Status change transitions animate 150 ms ease-out.

### `NewHighlight`

| Prop | Type | Notes |
|---|---|---|
| `active` | `boolean` | `true` when status is Pending |

Renders "★ New" label and applies CSS ring + soft box-shadow glow to the parent `OrderRow`. The highlight clears with 150 ms ease-out when `active` becomes `false`.

### `StatusPill`

| Prop | Type | Notes |
|---|---|---|
| `status` | `OrderStatus` | — |

Renders icon + label. Same component as U2's `StatusPill` (shared). `role="status"` with `aria-live="polite"`.

### `ActionButtons`

| Prop | Type | Notes |
|---|---|---|
| `status` | `OrderStatus` | Determines which buttons render |
| `orderNumber` | `number` | Passed to cancel modal |
| `onPrimary` | `() => void` | Start preparing / Mark completed |
| `onCancel` | `() => void` | Opens cancel confirmation |

- Pending: renders `PrimaryActionButton` ("Start preparing") + `CancelButton`.
- Preparing: renders `PrimaryActionButton` ("Mark completed") + `CancelButton`.
- Completed / Cancelled: renders nothing.

### `PrimaryActionButton`

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | "Start preparing" or "Mark completed" |
| `onClick` | `() => void` | Triggers transition POST |
| `loading` | `boolean` | Disables + shows spinner during POST |

### `CancelButton`

| Prop | Type | Notes |
|---|---|---|
| `orderNumber` | `number` | For modal title |
| `onCancel` | `() => void` | — |

Opens `ConfirmModal` ("Cancel order #N?" / "Yes, cancel") before firing `onCancel`.

### `BoardEmptyState`

No props. Renders ⚪ + "No open orders right now. Orders will appear here within 2 seconds of placement."

### `BoardShimmer`

No props. Renders three shimmer TableCard placeholders while the initial fetch is in-flight.

### `ReconnectBanner`

| Prop | Type | Notes |
|---|---|---|
| `visible` | `boolean` | Shown after 3s disconnect |

Same pattern as U2's `ReconnectBanner`. Inline in the board area.

### `MenuAvailabilityPanel`

| Prop | Type | Notes |
|---|---|---|
| `open` | `boolean` | — |
| `onClose` | `() => void` | Triggered by Done + Escape |
| `items` | `MenuItem[]` | 12 items |
| `onToggle` | `(id: string, available: boolean) => void` | — |

Renders as a portal, `role="dialog"`, `aria-label="Menu availability"`, `id="menu-availability-panel"`. Traps focus while open. Slide-in from right (200 ms ease-out).

### `AvailabilityRow`

| Prop | Type | Notes |
|---|---|---|
| `item` | `MenuItem` | — |
| `onToggle` | `(available: boolean) => void` | — |

Renders emoji, name, `SoldOutSwitch`. Toggling to Sold out opens `ConfirmModal` first. Toggling back to available is immediate.

### `SoldOutSwitch`

| Prop | Type | Notes |
|---|---|---|
| `checked` | `boolean` | `true` = sold out |
| `onChange` | `(next: boolean) => void` | — |
| `loading` | `boolean` | Disables during POST |

`role="switch"`, `aria-checked` reflects state. Label: "Sold out".

---

## State management

### `useBoardOrders()` (custom hook)

Manages the board's order map (`Map<tableId, Order[]>`). Initialises from HTTP fetches (all 10 tables). Applies SSE events:

- `ORDER_PLACED` → upsert order into the map (create entry if table not present).
- `ORDER_STATUS_CHANGED` → update `order.status` in place; remove table entry when all orders are Completed/Cancelled.
- `TABLE_CLOSED` → remove the table entry entirely.

### `useStaffSSE()` (custom hook)

Wraps `EventSource` for `/sse/staff`. Identical backoff and reconnect strategy to `useTableSSE` in U2. Returns `{ lastEvent, connected }`.

### `useMenuAvailability()` (custom hook)

Fetches `GET /api/menu` on mount. Updates state on `MENU_AVAILABILITY_CHANGED` SSE events. Exposes `toggle(id, available)` which calls `POST /api/menu/items/:id/availability`.

---

## File layout

```
src/client/
  views/
    StaffView.tsx               (U1 shell — extended)
  screens/
    KitchenBoardScreen.tsx
  components/
    BoardHeader.tsx
    LiveIndicator.tsx
    MenuAvailabilityButton.tsx
    TableCard.tsx
    TableCardHeader.tsx
    OrderRow.tsx
    NewHighlight.tsx
    ActionButtons.tsx
    PrimaryActionButton.tsx
    CancelButton.tsx
    BoardEmptyState.tsx
    BoardShimmer.tsx
    MenuAvailabilityPanel.tsx
    AvailabilityRow.tsx
    SoldOutSwitch.tsx
    StatusPill.tsx              (shared with U2)
    ReconnectBanner.tsx         (shared with U2)
    ConfirmModal.tsx            (shared with U2)
  hooks/
    useBoardOrders.ts
    useStaffSSE.ts
    useMenuAvailability.ts
  types/
    order.ts                    (shared with U2)
    menu.ts                     (shared with U2)
```
