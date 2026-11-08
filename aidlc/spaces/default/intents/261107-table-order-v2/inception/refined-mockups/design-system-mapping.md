# Design System Mapping: Table Order v2

The design system is written once in `mockups/design-system.css` and shown in `mockups/design-system.html`. It evolves v1's styling (answer Q1): v1's dark palette is kept as the dark theme, a light theme is added, and type, spacing and shadows become one scale. It is built in the foundation Unit and every screen uses it (FR1.1, FR1.2). This mapping is based on the code knowledge base (`aidlc/spaces/default/codekb/table-order/architecture.md`, "Styling Approach") and the requirements (`inception/requirements-analysis/requirements.md`).

## Tokens

| Group | Tokens (v2 name) | v1 name it replaces or keeps | Dark | Light |
|---|---|---|---|---|
| Surface | `--bg`, `--bg-raised`, `--bg-card`, `--bg-bar` | `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-tab-bar` | `#0F1216`, `#171B22`, `#1F2630`, frosted | `#F6F4EF`, `#FFFFFF`, `#FFFFFF`, frosted |
| Border | `--border`, `--border-strong` | `--border` | `#2A313C`, `#3A4351` | `#E2DDD2`, `#CFC8BA` |
| Text | `--text`, `--text-2`, `--text-muted`, `--text-disabled` | `--text-primary`, `--text-secondary`, `--text-muted` | `#F1F3F6`, `#A6AEB8`, `#8791A0`, `#4E5560` | `#1B1F26`, `#46505E`, `#5F6A78`, `#9AA2AD` |
| Accent | `--accent`, `--accent-hover`, `--accent-fg`, `--accent-text`, `--accent-soft` | `--accent`, `--accent-hover`, `--accent-fg`, `--accent-soft` | amber `#FFB04A` | amber `#F29A1F`, text `#8F5200` |
| Status | `--pending`, `--preparing`, `--completed`, `--cancelled`, each with `-soft`; `--danger` | `--status-*` | v1 values | darker values for contrast on white |
| Timers | `--warn-amber`, `--warn-red` | none (new) | amber, red | darker amber, red |
| Radius | `--radius-sm 6`, `--radius-md 12`, `--radius-lg 16`, `--radius-pill 999` | `--radius-sm`, `--radius-card`, `--radius-pill 20px` | same | same |
| Shadow | `--shadow-sm`, `--shadow-card`, `--shadow-sheet`, `--shadow-bar` | `--shadow-card`, `--shadow-tab-bar` | stronger | softer |
| Type scale | `--text-xs 12` to `--text-3xl 40`, weights 400 to 700 | none (new) | same | same |
| Spacing | `--space-1 4` to `--space-12 48` | none (new) | same | same |
| Motion | `--ease-out`, `--t-fast 120ms`, `--t-normal 220ms` | `--ease-out`, `--transition-*` | same | same |

The v1 tokens stay defined as aliases of the v2 names until every component has moved over, so no v1 screen breaks half way (FR19.1). The dark values equal v1's values, so a v1 screen on a dark device looks the same.

## Light-theme Contrast

Text and accent colours were chosen for at least 4.5 to 1 against their backgrounds in both themes (FR2.4). Amber is not used as text on light surfaces: light uses `--accent-text #8F5200` for amber text, and `--accent` only as a filled background with dark text.

## Components

| Component (class) | Used by | Maps to v1 |
|---|---|---|
| Button `.btn`, `-primary`, `-danger`, `-ghost`, `-sm` | all screens | v1 `btn-primary` and inline button styles |
| Add pill `.add-pill` (32 px, 44 px touch area) | Menu | v1 "+ Add" pill |
| Category pill `.pill` | Menu | v1 category pills |
| Chip `.chip` | Settings, Menu management | new |
| Segmented control `.seg` | theme, sound, station tabs | new |
| Badge `.badge-*` | statuses, allergy marks, calls | v1 status pills |
| Timer `.timer`, `.amber`, `.red` | Kitchen Board, special | new |
| Card `.card`, `.item`, `.ticket`, `.table-card` | all | v1 cards, order cards |
| Banner `.banner-*` | ready, new order, warnings, PIN | v1 banners |
| Sheet `.sheet` and `.scrim` | options, Settings, allergy warning | v1 `ConfirmModal` (kept for confirmations) |
| Tab bar `.tabbar`, `.tab`, `.badge-count`, `.cart-bar` | diner | v1 `DinerTabBar` |
| Side navigation `.sidenav` | staff | new |
| Tracker `.tracker` | My orders | new |
| Form `.field`, `.input`, `.choice` | Menu management, options, special | new |
| Table `table.data`, stat `.stat`, floor tile `.floor .t` | sales, bill, floor map | v1 bill rows |

## Rules the Design System Keeps

- The diner tab bar is fixed at the bottom with the Cart count; "View cart" and "Place order" sit just above it.
- Category pills stay sticky; the current one is filled.
- Touch areas are at least 44 px; focus rings are always visible; all motion stops for reduced motion.
- Bars are frosted (backdrop blur); cards are rounded with soft shadows; prices are aligned with tabular numbers.

## Assumptions & Open Questions

- The v1 token names stay as aliases during the move, and are removed only when no component uses them.
- Components still styled with inline literal colours in v1 (about 143 values) move to the tokens in the foundation Unit for shared components and in each feature Unit for its own screens.
- The foundation Unit decides how the theme is switched in code (a data attribute on the page root, as the mockups do).
