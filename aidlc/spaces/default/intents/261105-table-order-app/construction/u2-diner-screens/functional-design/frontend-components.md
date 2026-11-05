# Frontend Components — U2 `u2-diner-screens`

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Component tree

```
TableView (src/client/views/TableView.tsx — U1 shell, extended here)
├── TopStrip                        — table number + online indicator
├── CategoryPillBar                 — sticky scroll-spy pill row
│   └── CategoryPill (×4)
├── [tab content]
│   ├── MenuScreen                  — tab 0 (default)
│   │   ├── MenuItemCard (×12)
│   │   │   └── AddPill
│   │   └── MenuEmptyState / MenuErrorState
│   ├── CartScreen                  — tab 1
│   │   ├── CartLineItem (×N)
│   │   │   └── QuantitySelector
│   │   ├── CartTotal
│   │   ├── CartEmptyState
│   │   └── PlaceOrderButton
│   └── MyOrdersScreen              — tab 2
│       ├── OrderCard (×N)
│       │   ├── StatusPill
│       │   └── CancelOrderButton
│       ├── MyOrdersEmptyState
│       └── ReconnectBanner
├── StickyCartSummary               — above tab bar when cart non-empty
├── TabBar (U1 shell, badge wired here)
├── ConfirmModal (shared, portal)
├── Toast (shared, portal)
└── TableClosedTakeover             — full-screen SSE-triggered overlay
```

---

## Component specifications

### `TopStrip`

| Prop | Type | Notes |
|---|---|---|
| `tableId` | `number` | Displays as "TABLE #N" |
| `connected` | `boolean` | Shows "◉ online" / "◯ offline" |

### `CategoryPillBar`

| Prop | Type | Notes |
|---|---|---|
| `categories` | `Category[]` | From menu fetch |
| `activeCategoryId` | `string` | Scroll-spy derived |
| `onPillClick` | `(id: string) => void` | Triggers smooth-scroll |

Wraps pills in a sticky `<nav>` with `backdropFilter: blur(12px)`. Scroll-spy uses `IntersectionObserver` on the first item of each category section.

### `MenuItemCard`

| Prop | Type | Notes |
|---|---|---|
| `item` | `MenuItem` | Full item shape |
| `quantityInCart` | `number` | 0 = not in cart |
| `onAdd` | `() => void` | Calls cart store action |

Renders the emoji, name, description, price. Passes `available` to `AddPill`.

### `AddPill`

| Prop | Type | Notes |
|---|---|---|
| `available` | `boolean` | Sold-out state from menu |
| `atMax` | `boolean` | `quantityInCart >= 20` |
| `onClick` | `() => void` | — |

- `available === false`: renders "Sold out", `disabled`, `aria-disabled="true"`
- `atMax === true`: renders "Max", `disabled`
- Otherwise: renders "+ Add"

### `CartScreen`

Reads cart from `CartStore` (see below). No props needed beyond route context.

### `CartLineItem`

| Prop | Type | Notes |
|---|---|---|
| `item` | `MenuItem` | For name and emoji |
| `quantity` | `number` | Current quantity |
| `onChange` | `(qty: number) => void` | 0 means remove |

### `QuantitySelector`

| Prop | Type | Notes |
|---|---|---|
| `value` | `number` | 1–20 |
| `onChange` | `(next: number) => void` | — |

Renders `−  [N]  +`; at value 1 the `−` renders as "Remove"; at value 20 `+` is disabled.

### `PlaceOrderButton`

| Prop | Type | Notes |
|---|---|---|
| `tableId` | `number` | For POST URL |
| `lines` | `CartLine[]` | Sent to server |
| `onSuccess` | `(orderNum: number, droppedLines: DroppedLine[]) => void` | — |

Generates a fresh `placement_key` (UUID v4) the first time the user taps Place order (not on mount), stores it in `sessionStorage['placement_key']` for the duration of that submit attempt so retries send the same key, and clears it (generating a new key on the next tap) after success or hard failure.

### `StickyCartSummary`

| Prop | Type | Notes |
|---|---|---|
| `itemCount` | `number` | Badge count |
| `totalCents` | `number` | Formatted `$X.XX` |
| `onPlaceOrder` | `() => void` | Calls the shared place-order handler owned by `CartScreen` |
| `onViewCart` | `() => void` | Switches to Cart tab |

Visible when `itemCount > 0`. Sticks above the tab bar. The actual POST logic (with `tableId` and `lines`) is owned by `CartScreen` (or a shared `usePlaceOrder` hook lifted there); both `StickyCartSummary.onPlaceOrder` and `PlaceOrderButton.onClick` call the same handler so the two buttons stay in sync without duplicating the POST code.

### `MyOrdersScreen`

Subscribes to SSE on mount (via shared `useTableSSE` hook). Fetches initial order list from `GET /api/tables/:id/orders?visit=current`.

### `OrderCard`

| Prop | Type | Notes |
|---|---|---|
| `order` | `Order` | Full order shape |
| `onCancel` | `(orderNumber: number) => void` | Only for Pending |

### `StatusPill`

| Prop | Type | Notes |
|---|---|---|
| `status` | `OrderStatus` | Enum |

Renders icon + label. `role="status"` with `aria-live="polite"` for live transitions.

### `CancelOrderButton`

| Prop | Type | Notes |
|---|---|---|
| `orderNumber` | `number` | — |
| `onCancel` | `() => void` | — |

Shown only when `status === 'Pending'`. Opens `ConfirmModal` before calling `onCancel`.

### `ReconnectBanner`

| Prop | Type | Notes |
|---|---|---|
| `visible` | `boolean` | Shown after 3s disconnect |

Inline banner at top of MyOrdersScreen.

### `ConfirmModal` (shared portal)

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | — |
| `body` | `string` | — |
| `confirmLabel` | `string` | — |
| `destructive` | `boolean` (optional, default `false`) | `true` → `role="alertdialog"`; `false` → `role="dialog"` |
| `onConfirm` | `() => void` | — |
| `onClose` | `() => void` | — |

Traps focus; `Escape` closes. Destructive confirmations (Cancel order, Clear cart) pass `destructive={true}` to get `role="alertdialog"`; non-destructive confirmations use the default `role="dialog"`.

### `Toast` (shared portal)

| Prop | Type | Notes |
|---|---|---|
| `message` | `string` | — |
| `durationMs` | `number` | Default 3000 |

Auto-dismisses after `durationMs`. Announced via `aria-live="assertive"`.

### `TableClosedTakeover`

| Prop | Type | Notes |
|---|---|---|
| `visible` | `boolean` | Triggered by SSE event |

Full-screen overlay, `z-index` above all, suppresses tab bar. `role="alertdialog"`, `aria-label="Table closed"`. Shows ✓, "This table was closed", "Thanks for visiting!". Clears cart from `CartStore` on mount.

---

## State management

### `CartStore` (custom hook + `localStorage`)

```ts
interface CartStore {
  items: { menu_item_id: string; quantity: number }[];
  addItem: (id: string) => void;
  setQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  totalCents: (menu: MenuItem[]) => number;
  itemCount: () => number;
}
```

- Backed by `localStorage` key `cart:table:<tableId>`.
- Syncs across tabs on the same device via the `storage` event.

### `useTableSSE(tableId)` (custom hook)

Wraps `EventSource` for `/sse/tables/:id`. Returns `{ lastEvent: { type: string; data: unknown } | null, connected: boolean }`. Consumers switch on `lastEvent.type` to route each event (`'ORDER_PLACED'`, `'ORDER_STATUS_CHANGED'`, `'TABLE_CLOSED'`). Handles reconnect with exponential backoff and fires `Last-Event-ID` on reconnect. Sets `connected: false` and triggers `ReconnectBanner` after 3 seconds of no connection.

---

## File layout

```
src/client/
  views/
    TableView.tsx               (U1 shell — extended)
  screens/
    MenuScreen.tsx
    CartScreen.tsx
    MyOrdersScreen.tsx
  components/
    TopStrip.tsx
    CategoryPillBar.tsx
    CategoryPill.tsx
    MenuItemCard.tsx
    AddPill.tsx
    CartLineItem.tsx
    QuantitySelector.tsx
    PlaceOrderButton.tsx
    StickyCartSummary.tsx
    OrderCard.tsx
    StatusPill.tsx
    CancelOrderButton.tsx
    ReconnectBanner.tsx
    ConfirmModal.tsx
    Toast.tsx
    TableClosedTakeover.tsx
    EmptyState.tsx              (generic, reused across screens)
    ShimmerCard.tsx             (generic loading placeholder)
  hooks/
    useCartStore.ts
    useTableSSE.ts
    useMenu.ts
    useOrders.ts
  types/
    menu.ts                     (MenuItem, Category)
    order.ts                    (Order, OrderLine, OrderStatus, DroppedLine)
```
