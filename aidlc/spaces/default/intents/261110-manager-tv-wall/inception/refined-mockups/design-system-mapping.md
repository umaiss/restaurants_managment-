# Design System Mapping — Manager TV Wall

The TV wall and the switch use the app's existing Paprika design system (`src/client/design/tokens.css`, `components.css`). No new colour is added. Every colour in the mockups is one of the existing tokens, so the "no colour literal outside tokens.css" test keeps passing. Built from the screens in `mockups.md` for the stories in `inception/user-stories/stories.md`, under the size rules in `inception/requirements-analysis/requirements.md` (NFR1, NFR2, NFR7).

## Tokens used

| Use | Token | Dark | Light |
|---|---|---|---|
| Screen background | `--bg` | #0B0D12 | #F6F7F9 |
| Header background | `--bg-raised` | #12151C | #FFFFFF |
| Rows and tiles | `--bg-card` + `--shadow-card` | #1A1E28 | #F1F3F6 |
| Main text, figures | `--text` | #F2F4F7 | #101828 |
| Labels, table numbers' neighbours | `--text-2` | #B0B8C4 | #475467 |
| "Takings hidden" | `--text-muted` | #8A94A3 | #5F6B7C |
| "Slow" word, bar and pill | `--warn-amber`, `--pending-soft` | #FDB022 | #B54708 |
| "Late" word, bar, pill and oldest-wait outline | `--warn-red`, `--danger-soft` | #F97066 | #B42318 |
| "Live" marker | `--completed` | #47CD89 | #067647 |
| Requests strip | `--accent-soft`, `--accent-text` | #FF8F5C on tint | #B93815 on tint |
| Switch on | `--accent` | #FF7A3D | #CF430E |
| Navigation | `--nav-bg`, `--on-dark` | #0E1117 | #101828 |
| Radius | `--radius-md` rows, `--radius-xl` tiles, `--radius-pill` pills and switch | | |
| Motion | `--t-normal` 220 ms, `--ease-out`; off under reduced motion | | |

## Type for the TV (new sizes, TV page only)

The design system's largest text step is `--text-3xl` (40 px), which is too small for a wall screen read from 4 metres. The TV page adds its own sizes, scoped to the TV wall only:

| Role | Size | Weight |
|---|---|---|
| Headline figures (oldest wait, takings, busiest table) | 80 px | 700 |
| Second-level figures (on open tables, top dish, word figures) | 72 px | 700 |
| Section title "Open orders" | 40 px (`--text-3xl`) | 700 |
| Everything else on the TV | 32 px (`--text-2xl`) | 500 to 700 |

All figures use tabular numbers so they do not jump as they change.

## Components reused

| Need | Existing piece | Change |
|---|---|---|
| Rows and tiles | `.card` look (`--bg-card`, `--shadow-card`, radius) | none |
| Slow and Late pills | Kitchen Board ticket timer colours and words | Larger size on the TV only |
| Money | `components/staff/money.ts` `formatMoney` | none |
| Big-number tiles | `.u7-stat` pattern | TV-sized copy, scoped to the TV page |
| Navigation link | `STAFF_PAGES` registry entry with an icon | one new entry, "📺 TV wall" |
| Switch | `SegmentedControl` and button focus styles | New `TvTakingsSwitch` component in the same style (none exists today) |
| Skeleton while loading | existing skeleton shapes | none |
