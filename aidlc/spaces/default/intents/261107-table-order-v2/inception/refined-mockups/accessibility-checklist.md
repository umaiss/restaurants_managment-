# Accessibility Checklist: Table Order v2

The target is WCAG 2.1 level AA on every new or changed screen, in both themes (requirements NFR3 and FR2.4). Each item names the mockup it is shown in and how it is checked. Items marked "keep" are things v1 already does that must not regress.

## Perceivable

| # | Check | Where | How it is checked |
|---|---|---|---|
| A1 | Text contrast is at least 4.5 to 1 (large text 3 to 1) in light and dark | every page, both themes | Contrast of each text token against its background, in the design-system test |
| A2 | Status is never shown by colour alone: Pending, Preparing, Completed, Cancelled, "Slow", "Late", Empty, Browsing, Waiting, Eating, Needs the bill, "⚠ Contains dairy" all carry words | diner-menu, diner-orders, staff-board, staff-floor | Mockup-match checks the words; a unit test checks no status badge is colour only |
| A3 | Every image or icon that carries meaning has a text alternative; decorative emoji are `aria-hidden` | all | Query for `aria-label` or `aria-hidden` on emoji and icon buttons |
| A4 | The QR code has a text alternative naming the table, and the table address is printed beside it | staff-qr | Check the `aria-label` and the visible `/table/<n>` text |
| A5 | Layout works at 200% zoom and 320 px width without sideways scrolling of the page | diner pages, staff pages | A browser test at 320 px width and a zoomed run |

## Operable

| # | Check | Where | How it is checked |
|---|---|---|---|
| B1 | Every function works by keyboard, including the PIN keypad (digits type into the field), sheets, segmented controls and the option groups | all | The keyboard-only journey test, extended to the new screens |
| B2 | Touch targets are at least 44 px (the "+ Add" pill looks 32 px with a 44 px touch area) | diner, staff | A browser test measuring the hit area of buttons, pills, chips and tabs |
| B3 | Focus is always visible, and moves into a sheet when it opens, stays inside it, and returns to the control that opened it; Escape closes it | options sheet, Settings, allergy warning | A browser test per sheet |
| B4 | The tab order follows the visual order; the side navigation comes first and can be skipped with a "Skip to content" link | staff pages | Tab through the page in a browser test |
| B5 | No time limit hides information: the ready banner and new-order alert stay until dismissed or handled | diner-orders, staff-board | Check the banner is still there after 30 seconds |
| B6 | All movement stops for `prefers-reduced-motion`: tracker, pulse, countdown tick, theme change, banners | all | A browser test with reduced motion set checks no animation runs (keep and extend v1's motion tests) |
| B7 | The PIN lock tells the person how long to wait | staff-pin | Mockup-match and a unit test |

## Understandable

| # | Check | Where | How it is checked |
|---|---|---|---|
| C1 | Every form field has a visible label; an invalid save names the field, explains the fix and keeps what was typed | staff-menu, staff-special, staff-pin | Browser tests for each invalid case in the stories |
| C2 | Destructive actions confirm and name what is affected: Cancel order, End special now, Hide item, Close table | board, special, menu, bill | Browser tests |
| C3 | Loading, empty and error views are different and each says what happened and what to do next | new staff pages | A unit test per view |
| C4 | The estimate is labelled "Estimate"; "Running late" replaces a time rather than showing a negative one | cart, orders | Unit tests on the estimate and a mockup-match check |
| C5 | The allergy marks say they are guidance, and the warning needs a second confirmation | settings, cart | Mockup-match and a browser test |
| C6 | The page language is set (`lang="en"`) and the order of headings is correct on each screen | all | A unit test per screen |

## Robust

| # | Check | Where | How it is checked |
|---|---|---|---|
| D1 | Controls use real elements (buttons, links, inputs); custom controls carry the right role and state: `role="radio"` and `aria-checked` on choices, `aria-pressed` on chips and segmented buttons, `aria-current` on tabs and navigation | all | A unit test per component |
| D2 | Dynamic messages are announced: `role="status"` for the ready banner, new-order alert and "Help is on the way."; `role="alert"` for errors; `role="alertdialog"` for the allergy warning and "Table closed" | diner, staff | Check the roles in each component test |
| D3 | The tracker is described to a screen reader ("Order progress: Preparing, step 2 of 3") | diner-orders | A unit test on the label |
| D4 | The app works in Chromium, Google Chrome and WebKit; Firefox is not tested | all | The cross-browser run at Build and Test |

## Open Items

- A "Skip to content" link on the staff pages is part of the foundation Unit's shell and is not drawn in the mockups.
- Whether to add a "high contrast" theme is not in scope; contrast is met in both themes.
