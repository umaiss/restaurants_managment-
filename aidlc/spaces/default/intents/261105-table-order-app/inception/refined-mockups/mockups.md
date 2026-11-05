# Refined Mockups — Table Order Web App

**Based on:** `stories.md` from `inception/user-stories/`, `requirements.md` from `inception/requirements-analysis/`, `design-system-mapping.md` from this stage.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Theme and overall style

- **Dark** background on every screen, with bright status colors — chosen at Q1. [Q1]
- Cards are raised dark panels with rounded corners (12 px) and a soft shadow against the darker background.
- Type is crisp and high-contrast; prices use tabular numerals and are right-aligned.
- Sticky bars (category pills, bottom tab bar) use a frosted blur over the dark background.
- Motion is gentle: hover, press and live-update changes animate at 150 ms ease-out, suppressed when `prefers-reduced-motion`. [desc]
- The mockups are never plain wireframes — they show real styling, spacing, shadows and colors. [team: project.md]

## Seed menu (becomes the app's seed data)

| Id | Category | Emoji | Name | Price (USD) |
|---|---|---|---|---|
| i-01 | Starters | 🥗 | House salad | `$4.50` |
| i-02 | Starters | 🥣 | Tomato soup | `$5.50` |
| i-03 | Starters | 🧀 | Cheese board | `$7.50` |
| i-04 | Mains | 🍔 | Classic burger | `$10.50` |
| i-05 | Mains | 🍝 | Spaghetti bolognese | `$12.00` |
| i-06 | Mains | 🍕 | Margherita pizza | `$11.00` |
| i-07 | Mains | 🌮 | Tacos (3) | `$9.50` |
| i-08 | Desserts | 🍰 | Chocolate cake | `$6.00` |
| i-09 | Desserts | 🍨 | Vanilla ice cream | `$4.00` |
| i-10 | Drinks | 🥤 | Soft drink | `$3.00` |
| i-11 | Drinks | 🧃 | Fresh juice | `$4.50` |
| i-12 | Drinks | ☕ | Coffee | `$3.50` |

[Q2], [assumption]

---

## Diner screens (customer view at `/table/:id`)

All diner screens share a fixed bottom tab bar with three tabs: **Menu**, **Cart**, **My orders**. The Cart tab shows the number of items in a small accent badge. The active tab is filled with the accent color. The bar stays at the bottom, always in reach of the thumb. [team: project.md]

Just above the bottom tab bar, when the cart has items, a sticky **View cart (N items · $X.XX)** → **Place order** bar lifts the primary action one tap away.

### Screen D1 — Menu (US1.1, US1.2)

```
┌───────────────────────────────────────────┐
│  TABLE #5                   ◉ online      │ top strip (small, dark)
├───────────────────────────────────────────┤
│  [ Starters ][ Mains ][ Desserts ][ Drinks]│ category pills (sticky, blur)
├───────────────────────────────────────────┤
│  🥗  House salad                   $4.50  │
│      Mixed greens, cherry tomatoes [+ Add]│
│  ─────────────────────────────────────────│
│  🥣  Tomato soup                   $5.50  │
│      Slow-roasted tomatoes         [+ Add]│
│  ─────────────────────────────────────────│
│  🧀  Cheese board                  $7.50  │
│      Three cheeses, crackers       [+ Add]│
│  ...                                      │
├───────────────────────────────────────────┤
│  View cart  (2 items · $8.00)   Place →  │ sticky summary (when cart has items)
├───────────────────────────────────────────┤
│   [ Menu* ]   [ Cart (2) ]   [ My orders ]│ bottom tab bar (Menu active)
└───────────────────────────────────────────┘
```

- Each item card shows its emoji on the left, then name, description and price. The **+ Add** pill sits at the far right of the price row — looks 32 px tall but keeps a 44 px touch area. [team: project.md]
- The category pills bar stays at the top while scrolling. Tapping a pill scrolls smoothly to the first item in that category. The pill of the category currently on screen is filled in. [team: project.md]
- Sold-out items show a muted overlay, the `+ Add` pill becomes **Sold out** in `--text-disabled`, and the item cannot be added.
- **Empty state:** when the menu is loading, three placeholder shimmers for item cards. On empty database, the screen shows "The menu is not ready yet. Ask staff for help."
- **Error state:** if the menu fails to load, "We cannot reach the menu right now" with a **Retry** button.

### Screen D2 — Cart (US2.1, US2.2, US2.3, US2.4, US2.5)

```
┌───────────────────────────────────────────┐
│  Your cart                  Clear all    │
├───────────────────────────────────────────┤
│  🍔  Classic burger             $10.50   │
│      −    [  2  ]    +                   │
│                       Subtotal   $21.00  │
│  ─────────────────────────────────────────│
│  🥤  Soft drink                  $3.00   │
│      −    [  1  ]    +                   │
│                       Subtotal    $3.00  │
├───────────────────────────────────────────┤
│  Total                           $24.00  │
├───────────────────────────────────────────┤
│                                           │
│        [  Place order  ]  (accent)        │
│                                           │
├───────────────────────────────────────────┤
│   [ Menu ]   [ Cart* (3) ]   [ My orders ]│
└───────────────────────────────────────────┘
```

- Quantity selector `−  [N]  +`, 1–20. Setting to 0 (or **Remove**) deletes the line; the total recalculates immediately.
- Cart survives a page refresh (stored per device). [FR1.5]
- **Empty state:** "Your cart is empty. Browse the menu to get started." with a **Back to menu** link.
- Placing an order with a sold-out item shows a banner: "Chocolate cake sold out and was removed; the rest of your order went through." [FR1.7]

### Screen D3 — My orders (US3.1, US3.2, US4.1)

```
┌───────────────────────────────────────────┐
│  My orders                                │
├───────────────────────────────────────────┤
│  Order #15        Placed 7:04pm           │
│  🔥 Preparing                             │
│  🍔 Classic burger  × 2        $21.00    │
│  🥤 Soft drink      × 1         $3.00    │
│                      Subtotal  $24.00    │
│  ─────────────────────────────────────────│
│  Order #18        Placed 7:12pm           │
│  ⏳ Pending               [ Cancel order ]│
│  🍕 Margherita pizza × 1       $11.00    │
│                      Subtotal  $11.00    │
├───────────────────────────────────────────┤
│   [ Menu ]   [ Cart ]   [ My orders* ]    │
└───────────────────────────────────────────┘
```

- Live status updates within 2 seconds, animated with a soft pulse. [FR4.1], [NFR2]
- **Cancel order** button is only shown for Pending orders. [FR1.8]
- **Empty state:** "You have not placed any orders yet."

**D3 — Loading state**

```
┌───────────────────────────────────────────┐
│  My orders                                │
├───────────────────────────────────────────┤
│  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  shimmer card
│  ▒▒▒▒▒▒▒▒▒▒                               │
│  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
├───────────────────────────────────────────┤
│   [ Menu ]   [ Cart ]   [ My orders* ]    │
└───────────────────────────────────────────┘
```

**D3 — Table-closed takeover**

```
┌───────────────────────────────────────────┐
│                                           │
│                 ✓                         │  (large icon)
│                                           │
│       This table was closed               │
│       Thanks for visiting!                │
│                                           │
└───────────────────────────────────────────┘
```

Full-screen takeover triggered by FR3.6. Suppresses the bottom tab bar and clears the cart and "My orders". A device that was offline applies the same takeover on reconnect. [R-01]

---

## Staff screens (staff view at `/staff`)

### Screen S1 — Kitchen Board (US5.1, US5.2, US5.3, US6.1, US6.2)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Kitchen Board              Updated live     [ Menu availability ]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────── Table 5 ─────────┐  ┌───────── Table 7 ─────────┐        │
│ │ ★ New   #18  7:12pm        │  │ 🔥 Preparing #14  6:58pm   │        │
│ │ 🍕 Margherita pizza × 1    │  │ 🍔 Classic burger × 2      │        │
│ │                            │  │ 🥤 Soft drink × 1          │        │
│ │ [Start preparing] [Cancel] │  │ [Mark completed] [Cancel]  │        │
│ ├────────────────────────────┤  ├────────────────────────────┤        │
│ │ 🔥 Preparing #15  7:04pm   │  │ ✓ Completed #11 6:40pm     │        │
│ │ 🍔 Classic burger × 2      │  │ 🧀 Cheese board × 1        │        │
│ │ 🥤 Soft drink × 1          │  │                            │        │
│ │ [Mark completed] [Cancel]  │  │                            │        │
│ └────────────────────────────┘  └────────────────────────────┘        │
│                                                                       │
│ ┌───────── Table 3 ─────────┐                                        │
│ │ ⏳ Pending #19 7:13pm       │                                        │
│ │ 🌮 Tacos (3) × 1           │                                        │
│ │ [Start preparing] [Cancel] │                                        │
│ └────────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

- Grid of table cards; one card per table with open orders. Each card lists its orders newest first, each with its own status pill and primary action.
- The **table card header** shows **"Table N  →"** with a trailing chevron and acts as a link to `/staff/tables/:id`. It changes on hover (`--bg-overlay`), has a visible focus ring, and announces as "Open bill for Table N" to screen readers. [FR3.1]
- A **★ New** ring + soft glow highlights every Pending order on every open staff screen (per Functional Design U3 Q1 default: every Pending order, not only this session's). [FR2.4]
- Status buttons: `[Start preparing]` on Pending, `[Mark completed]` on Preparing; `[Cancel]` available until Completed. [FR2.5], [FR2.6]
- **Menu availability** button in the header (right) opens a side panel (not a sixth screen) — chosen at Q3. [Q3]

**S1 — Loading state**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Kitchen Board              Updated live     [ Menu availability ]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────── ▒▒▒▒▒▒▒ ─────────┐  ┌───────── ▒▒▒▒▒▒▒ ─────────┐        │
│ │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │        │
│ │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         │  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         │        │
│ └────────────────────────────┘  └────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

Three shimmer cards side-by-side while the board loads.

**S1 — Empty state (no open orders)**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Kitchen Board              Updated live     [ Menu availability ]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                          ⚪                                         │
│                                                                     │
│                   No open orders right now.                         │
│          Orders will appear here within 2 seconds of placement.     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Screen S1a — Menu availability side panel (US6.3)

```
┌──── Menu availability ──────────┐
│  🥗 House salad        [  on  ] │  switches
│  🥣 Tomato soup        [  on  ] │
│  🧀 Cheese board       [ OFF  ] │  (Sold out)
│  🍔 Classic burger     [  on  ] │
│  ...                            │
│                                 │
│                        [ Done ] │
└─────────────────────────────────┘
```

- Opens from the Kitchen Board's **Menu availability** button. [Q3]
- Each row is one of the 12 seed items with a Sold out switch. Toggling propagates to diners within 2 seconds. [FR2.7]

### Screen S2 — Table Bill (at `/staff/tables/:id`) (US7.1, US7.2)

```
┌─────────────────────────────────────────────────────────┐
│  Table 5 — Bill                           [ ← Board ]   │
├─────────────────────────────────────────────────────────┤
│  Order #15        ✓ Completed            Placed 7:04pm  │
│  🍔 Classic burger  × 2             $10.50 each $21.00  │
│  🥤 Soft drink      × 1              $3.00 each   $3.00 │
│                                 Subtotal         $24.00 │
│  ─────────────────────────────────────────────────────  │
│  Order #18        ✓ Completed            Placed 7:12pm  │
│  🍕 Margherita pizza × 1           $11.00 each  $11.00  │
│                                 Subtotal         $11.00 │
├─────────────────────────────────────────────────────────┤
│  Combined total                                 $35.00  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   [  Close table  ]  (accent)                          │
│                                                         │
│   One or more orders still open: — none —              │
└─────────────────────────────────────────────────────────┘
```

- Listed per order (Q5 of Requirements): each order with its number, items, quantities, prices, subtotal, then one combined total for the table. [FR3.1]
- Cancelled orders are not shown. [FR3.2]
- **Close table** is disabled when any order is Pending or Preparing; the panel below lists which orders are still open. Disabled also when the table has no orders. [FR3.3], [FR3.4]
- The bill is its own page at `/staff/tables/:id` (not part of the board). [assumption]

---

## State coverage per screen

| Screen | Loading | Empty | Error | Success |
|---|---|---|---|---|
| D1 Menu | Shimmer | "Menu not ready" | "Cannot reach menu" + retry | Items grouped by category |
| D2 Cart | Not applicable (local) | "Cart empty" + back-to-menu | Placement error banner | Line items, total, place order |
| D3 My orders | Shimmer | "No orders yet" | Live-update disconnect banner | Orders with live status |
| S1 Kitchen Board | Shimmer | "No open orders" | Live-update disconnect banner | Grid of table cards |
| S1a Menu availability | Shimmer | Not applicable | Toggle error banner | Switches per item |
| S2 Table Bill | Shimmer | "Table has no orders" (Close disabled) | Fetch error banner | Orders, totals, Close |

## Breakpoints

- Diner screens: designed at 360 px, fluid up to 768 px.
- Staff screens: designed at 1024 px, fluid up to 1920 px.

## Assumptions

- Item images are emoji tiles. [assumption]
- The bill is its own page at `/staff/tables/:id`. [assumption]
- The mockups' seed menu becomes the app's seed data. [assumption]
- Order numbers are shown as "#15". [assumption]
- Icons always sit next to words. [assumption]
