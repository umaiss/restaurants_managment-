# Accessibility Checklist — Manager TV Wall

Target: WCAG 2.1 AA (requirements.md NFR7), for the screens in `mockups.md`. Covers the stories in `inception/user-stories/stories.md`. Contrast ratios are worked out from the token values in `design-system-mapping.md`.

## Perceivable

- [x] **Text contrast, dark:** main text #F2F4F7 on rows #1A1E28 is about 15:1; labels #B0B8C4 on #1A1E28 about 8.6:1; "Takings hidden" #8A94A3 on #1A1E28 about 5.4:1 (all at least 4.5:1, and all text is large).
- [x] **Text contrast, light:** #101828 on #F1F3F6 about 16:1; #475467 on #F1F3F6 about 7:1; #5F6B7C on #F1F3F6 about 5:1.
- [x] **Status words:** "Slow" #FDB022 and "Late" #F97066 on their tinted pills are above 3:1 at 32 px bold, which counts as large text. In light, #B54708 and #B42318 are above 4.5:1.
- [x] **Not by colour alone:** every Slow or Late row carries the word as well as the coloured bar. The oldest-wait tile says "Late" or "Slow" in its label. "Live" and "Reconnecting…" are words.
- [x] **Text size:** nothing on the TV is below 32 px. The headline figures are 72 to 80 px (NFR1).
- [x] **Reading at a distance:** tabular numbers, bold figures, no thin weights for figures.
- [x] **No flashing:** nothing blinks; changes fade once over 220 ms.

## Operable

- [x] **No input needed on the TV:** the screen works without any interaction (FR1.3), so it sets no keyboard traps or time limits.
- [x] **Navigation link and switch reachable by keyboard:** Tab to reach, Enter to follow the link, Space or Enter to toggle the switch.
- [x] **Focus visible:** 3 px accent outline on the switch; the link keeps the existing focus style.
- [x] **Touch targets:** the link row and the switch row are each at least 44 px tall (project screen rules).
- [x] **Reduced motion:** with `prefers-reduced-motion: reduce`, the row and tile fades and the switch knob slide do not run.

## Understandable

- [x] Page language declared (`lang="en"`).
- [x] Plain labels: "Open orders", "Oldest wait", "Today's takings", "On open tables", "Busiest table", "Top dish", "Takings hidden", "No open orders".
- [x] Errors in words: "Can't reach the restaurant server. Trying again…", "Reconnecting… last update HH:MM".

## Robust

- [x] Native elements: an `ol` for the orders, an `h1` for the list title, an `aside` for the figures, and a `button role="switch"` with `aria-checked`.
- [x] The header status is a `role="status"` region, so "Reconnecting…" and "Live" are announced. The order list is not a live region, to avoid constant announcements.
- [x] The switch is labelled by its visible text with `aria-labelledby`.

## Tests to add (NFR7, NFR9)

- An automated contrast check of the TV wall in dark and in light.
- A reduced-motion check that no transition runs on the TV wall.
- A keyboard check that the "TV wall" link and the switch can be reached and used.
