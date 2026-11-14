# Refined Mockups — Manager TV Wall

Designed straight from `inception/user-stories/stories.md` and `inception/requirements-analysis/requirements.md`; this plan has no rough mockups. The mockups are high-fidelity standalone HTML pages in `mockups/`, opened from `mockups/index.html`. They use the app's current look (the Paprika tokens from `src/client/design/tokens.css`, dark by default, with a Light preview in each page's toolbar). TV screens are drawn at exactly 1920 by 1080 CSS pixels, the 43-inch TV they are designed for (requirements Q6). Rendered previews of the four TV screens sit beside the folder as `.shots-tv-wall-*.png`.

## Screens

| Mockup | File | Stories | What it shows |
|---|---|---|---|
| TV wall: busy service, takings shown | `mockups/tv-wall-busy.html` | US1.1, US2.1, US2.2, US3.1, US3.2, US3.3, US5.1, US5.3 | 14 open orders: 8 rows plus "+6 more"; two "Late", two "Slow"; oldest wait 17 min in red; today's takings $1,284.50 and on open tables $412.00; busiest table "Table 5, 6 orders today"; top dish "Classic Burger, 23 portions today"; requests strip "Table 4 — Bill · Table 8 — Waiter · +1 more" |
| TV wall: takings hidden (the default) | `mockups/tv-wall-hidden.html` | US4.1, US2.1, US2.2, US3.2, US3.3 | Both takings figures read "Takings hidden"; 6 open orders, no requests strip |
| TV wall: start of the day | `mockups/tv-wall-empty.html` | US2.1, US2.2, US3.1, US3.2, US3.3 | "No open orders" in the list and in the oldest-wait tile; $0.00 and $0.00; "No orders yet"; "No dishes yet" |
| TV wall: reconnecting | `mockups/tv-wall-reconnecting.html` | US5.1 | Header reads "Reconnecting… last update 20:05" in place of "Live"; the last figures stay on screen |
| Staff navigation: TV wall link and takings switch | `mockups/staff-nav-switch.html` | US1.1, US4.2 | The "📺 TV wall" link under "QR codes" and, directly under it, the "Show takings on TV" switch with "Off" beside it; clicking previews "On" |

Not drawn because it does not change: the staff PIN screen, which the TV wall shows when it is not signed in (US1.2, US5.2).

## Layout (Q1)

```
+--------------------------------------------------------------------------------+
| (o) Table Order · TV wall                                   * Live      19:42  |  88 px header
+--------------------------------------------------+-----------------------------+
| Open orders                              14 open | Oldest wait · Late          |
| +----------------------------------------------+ | 17 min                      |
| | Table 5   #41   3 items          17 min  Late| +-----------------------------+
| | Table 2   #42   2 items          15 min  Late| | Today's takings             |
| | Table 9   #44   5 items          11 min  Slow| | $1,284.50                   |
| | ...  (8 order rows)                          | | On open tables              |
| | +6 more                                      | | $412.00                     |
| +----------------------------------------------+ +-----------------------------+
|                                                  | Busiest table               |
| +----------------------------------------------+ | Table 5 / 6 orders today    |
| | Requests  Table 4 - Bill . Table 8 - Waiter  | +-----------------------------+
| +----------------------------------------------+ | Top dish                    |
|                                                  | Classic Burger / 23 portions|
+--------------------------------------------------+-----------------------------+
   orders column (fills the rest)                      figures column (704 px)
```

<!-- Text fallback: a header with the app name, a Live marker and the clock; below it, the open orders list on the left with the requests strip under it, and on the right a column of four tiles: oldest wait, today's takings with on open tables, busiest table, top dish. -->

## Sizes checked at 1920 by 1080

The four TV mockups were rendered in Chromium at 1920 by 1080:
- No element runs past the screen edge.
- The smallest text on any TV screen is 32 px.
- The headline figures are 80 px: oldest wait, today's takings, busiest table.
- The on-open-tables figure, the top dish and the word figures are 72 px.

So NFR1 and NFR2 hold in the design. With the requests strip showing, exactly 8 order rows fit beside the "+N more" row; without it, 9 orders fit. That meets the "at least 8 rows" rule from the stories.

## What changes in v1 and v2

Only the staff navigation (`mockups/staff-nav-switch.html`). It gains the "TV wall" link and the "Show takings on TV" switch under it (stories Q1). Every other staff and diner screen is unchanged. v1 and v2's own mockups are not edited.

## Assumptions

- The TV wall follows the staff theme setting, dark by default (requirements, Assumptions). Both themes are drawn through the toolbar preview.
- The top dish name is cut with "…" if it is wider than its tile. The longest current menu name, "Chocolate Fondant", fits at 72 px.
