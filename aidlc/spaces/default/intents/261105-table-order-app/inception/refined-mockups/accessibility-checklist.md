# Accessibility Checklist (WCAG 2.1 AA) — Table Order Web App

**Based on:** `mockups.md`, `interaction-spec.md`, `design-system-mapping.md` from this stage.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

## Perceivable

| Item | How it is met |
|---|---|
| **1.1.1 Non-text content** | Emoji tiles are decorative; every item name is next to the emoji, so the name is the accessible label. Status icons have a visible text label; the icon is marked `aria-hidden`. |
| **1.3.1 Info and relationships** | Headings use semantic `h1`–`h3`. Order cards use `article`; table cards on the board use `section` with an `aria-labelledby` naming the table. The cart uses a `list` with `listitem` rows. |
| **1.3.4 Orientation** | Both diner and staff screens work in portrait and landscape; no rotation lock. |
| **1.4.3 Contrast (minimum)** | Every text/background pair in the dark palette meets at least 4.5:1 for body and 3:1 for large text and UI chrome. Status pills meet 4.5:1 for their label against the pill background. |
| **1.4.4 Resize text** | Layout survives 200 % text zoom without horizontal scrolling at 360 px (diner) and 1024 px (staff). |
| **1.4.11 Non-text contrast** | Focus rings and interactive borders meet 3:1 against adjacent colors. |
| **1.4.13 Content on hover or focus** | Tooltips (e.g. the Close-table disabled explanation) dismiss on `Escape` and persist until focus moves. |

## Operable

| Item | How it is met |
|---|---|
| **2.1.1 Keyboard** | Every control is reachable and operable with `Tab`, `Shift+Tab`, `Enter`, `Space`, arrow keys and `Escape`. No keyboard trap. [NFR6] |
| **2.1.2 No keyboard trap** | Modals move focus to the first control and return it to the trigger on close. Side panels (Menu availability) behave the same way. |
| **2.4.3 Focus order** | Tab order follows the visual order documented in `interaction-spec.md`. |
| **2.4.6 Headings and labels** | Every screen has a single `h1`; every section has a meaningful heading; every control has a label. |
| **2.4.7 Focus visible** | 2-px accent focus ring on every interactive control (see design-system-mapping). |
| **2.5.3 Label in name** | Button names match the visible label (e.g. the accessible name of **+ Add** is "Add House salad to cart"). |
| **2.5.5 Target size** | Every interactive control has a 44×44 CSS-pixel touch area; small pills use padding to reach it. |

## Understandable

| Item | How it is met |
|---|---|
| **3.1.1 Language of page** | `<html lang="en">`. |
| **3.2.3 Consistent navigation** | The bottom tab bar is present on every diner screen in the same position and order. The Kitchen Board header is present on every staff screen. |
| **3.3.1 Error identification** | Every error is a visible banner or inline message; see Error messages in `interaction-spec.md`. |
| **3.3.3 Error suggestion** | Each error message suggests a next step (Retry, try again, reload, ask staff). |

## Robust

| Item | How it is met |
|---|---|
| **4.1.2 Name, role, value** | Buttons are `<button>`; switches use `role="switch"` with `aria-checked`; tabs use `role="tab"` inside `role="tablist"`. |
| **4.1.3 Status messages** | Live status changes announce via an `aria-live="polite"` region ("Order #15 is preparing"). The "★ New" highlight announces "New order #N for Table N" on arrival. The table-closed takeover announces via `aria-live="assertive"`. |

## Non-color indicators (project rule)

Every status is shown with a word and an icon, never by color alone. [NFR5]

## Keyboard journey checklist (for Build and Test)

Per project rules, Build and Test adds a keyboard-only test of the whole journey, checked here as the mockups' acceptance:

- [ ] Open `/table/5`; browse the menu using arrow keys between pills and items.
- [ ] Add two items with `Enter`/`Space` on **+ Add**.
- [ ] Open the Cart tab with `Tab` + `Enter`; adjust quantity with `+`/`−` buttons.
- [ ] Place the order with `Enter` on **Place order**.
- [ ] Open `/staff`; move focus to the new Pending card; press `Enter` on **Start preparing**.
- [ ] Back on `/table/5`, confirm the status update is announced via the live region.
- [ ] Open the bill at `/staff/tables/5`; mark the order Completed; close the table with `Enter` on **Close table**.
- [ ] Confirm the customer view receives the takeover and announces it.

## Reduced motion

All transitions collapse to 0 ms when `prefers-reduced-motion: reduce` is set. [desc]
