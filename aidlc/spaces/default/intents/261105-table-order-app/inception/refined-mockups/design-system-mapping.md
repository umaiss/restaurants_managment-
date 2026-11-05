# Design System Mapping — Table Order Web App

**Based on:** `stories.md` from `inception/user-stories/`, `requirements.md` from `inception/requirements-analysis/`, team Screen design rules from `aidlc/spaces/default/memory/project.md`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Theme

**Dark**, per Q1: a dark background on every screen, like a kitchen display, with bright status colors. [Q1]

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0F1216` | Page background on every screen |
| `--bg-raised` | `#171B22` | Cards, bottom tab bar, bill panels |
| `--bg-overlay` | `#1F2630` | Sticky bars (category pills, bottom tab bar) with 90% opacity + backdrop blur |
| `--border` | `#2A313C` | Card borders, divider lines |
| `--text-primary` | `#F1F3F6` | Headings, item names, prices |
| `--text-secondary` | `#A6AEB8` | Descriptions, metadata |
| `--text-disabled` | `#4E5560` | Disabled controls |
| `--accent` | `#FFB04A` | Primary action color (buttons, `+ Add` pill, active tab) |
| `--accent-fg` | `#0F1216` | Foreground on accent surfaces |
| `--status-pending` | `#FFC75A` | Status: Pending (amber) |
| `--status-preparing` | `#4CB3FF` | Status: Preparing (blue) |
| `--status-completed` | `#5DD48E` | Status: Completed (green) |
| `--status-cancelled` | `#8A94A2` | Status: Cancelled (grey) |
| `--highlight-new` | `#FFD98A` | "★ New" order glow (used as 2px ring + soft glow) |
| `--danger` | `#FF6B6B` | Sold-out banner, destructive confirmations |

All color pairs meet WCAG 2.1 AA contrast (minimum 4.5:1 for body text, 3:1 for large text and UI chrome). [desc], [NFR6]

## Typography

| Role | Family | Size | Weight |
|---|---|---|---|
| Display / H1 | System sans (SF Pro, Segoe UI, Inter) | 24px | 600 |
| H2 | System sans | 20px | 600 |
| Body | System sans | 16px | 400 |
| Price | Tabular numerals | 16px | 600 |
| Caption | System sans | 13px | 400 |

## Spacing scale (8-pt grid)

`4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.

## Radii

- `--r-s` 6px for pills and badges.
- `--r-m` 12px for cards.
- `--r-l` 20px for sheets and modals.

## Shadows

- `--shadow-card`: `0 1px 2px rgba(0,0,0,0.4), 0 6px 20px rgba(0,0,0,0.25)` — gives dark cards soft lift against the background.
- Motion respects `prefers-reduced-motion`: all transitions collapse to 0ms when set. [desc]

## Breakpoints

- Diner: 360px (minimum), fluid up to 768px.
- Staff: 1024px (minimum), fluid up to 1920px.

## Status pills

Every status pill shows a text label + icon alongside the color, never color alone. [NFR5]

| Status | Icon | Label | Background | Foreground |
|---|---|---|---|---|
| Pending | ⏳ | "Pending" | `--status-pending` at 20% opacity | `--status-pending` |
| Preparing | 🔥 | "Preparing" | `--status-preparing` at 20% opacity | `--status-preparing` |
| Completed | ✓ | "Completed" | `--status-completed` at 20% opacity | `--status-completed` |
| Cancelled | ✕ | "Cancelled" | `--status-cancelled` at 20% opacity | `--status-cancelled` |
| ★ New | ★ | "New" | `--highlight-new` at 25% opacity | `--highlight-new` |

## Buttons

| Variant | Bg | Fg | Used for |
|---|---|---|---|
| Primary | `--accent` | `--accent-fg` | Place order, Start preparing, Mark completed, Close table, Confirm sold-out |
| Secondary | transparent + `--border` | `--text-primary` | Cancel order, Edit cart |
| Danger | `--danger` | `#0F1216` | Confirm cancel in a destructive modal |
| Disabled | `--border` | `--text-disabled` | Place order (empty cart), Close table (orders open) |

**Touch targets:** every interactive control is at least 44×44 CSS pixels; a small `+ Add` pill looks about 32px tall but keeps a 44px touch area via padding.

## Assumptions

- Item images are emoji tiles rendered at 32×32 within an 8-pt safe area. [assumption]
- Icons always sit next to words — never as the only cue. [assumption]
- Order numbers are shown as "#15". [assumption]
