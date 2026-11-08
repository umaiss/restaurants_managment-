# Unit of Work Story Map: Table Order v2

One row per story in `inception/user-stories/stories.md`. Each row names the Units that implement part of it. Every Unit named on a row traces all of that row's acceptance criteria in its Functional Design, so a Unit is named only when it implements part of the story.

| Story | Unit | Directory |
|---|---|---|
| US1.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US2.1 | U5; U6 | u5-foundation; u6-diner-features |
| US3.1 | U5 | u5-foundation |
| US4.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US5.1 | U5; U7 | u5-foundation; u7-staff-kitchen-features |
| US6.1 | U5; U7 | u5-foundation; u7-staff-kitchen-features |
| US7.1 | U7 | u7-staff-kitchen-features |
| US8.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US9.1 | U5; U6 | u5-foundation; u6-diner-features |
| US10.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US11.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US12.1 | U7 | u7-staff-kitchen-features |
| US13.1 | U5; U7 | u5-foundation; u7-staff-kitchen-features |
| US14.1 | U6 | u6-diner-features |
| US15.1 | U7 | u7-staff-kitchen-features |
| US16.1 | U6 | u6-diner-features |
| US17.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US18.1 | U5; U6; U7 | u5-foundation; u6-diner-features; u7-staff-kitchen-features |
| US19.1 | U5; U7 | u5-foundation; u7-staff-kitchen-features |

## Stories That Span Several Units

These stories have a part in more than one Unit. The part each Unit implements:

| Story | U5 implements | U6 implements | U7 implements |
|---|---|---|---|
| US1.1 | The design system and the new look on all five v1 screens (AC1.1.1 to AC1.1.4 for those screens) | AC1.1.1 and AC1.1.4 for its new screens | AC1.1.1 and AC1.1.4 for its new screens |
| US2.1 | The themes, the switch and the saved choice (AC2.1.1, AC2.1.2, AC2.1.4) | The theme control in the Settings sheet (AC2.1.3) | |
| US4.1 | The shared alert logic and no repeats (AC4.1.3, AC4.1.4) | The diner ready banner (AC4.1.1) | The staff new-order alert (AC4.1.2) |
| US5.1 | The Completed time recorded on each order (AC5.1.3, in part) | | The sales page and its routes (AC5.1.1 to AC5.1.5) |
| US6.1 | Hidden items and categories in the menu the diner reads (AC6.1.1, AC6.1.2, AC6.1.4 in part) | | Staff add, edit, hide and validation (AC6.1.1 to AC6.1.6) |
| US8.1 | Options, frozen price and options on each line (AC8.1.1, AC8.1.3) | The sheet, cart lines and refresh (AC8.1.1, AC8.1.2, AC8.1.5) | Staff editing options and options on the ticket and bill (AC8.1.4) |
| US9.1 | The estimate and its recording (AC9.1.1, AC9.1.4, AC9.1.5) | The display and "Running late" (AC9.1.2, AC9.1.3) | |
| US10.1 | Allergen data and seed (AC10.1.2) | The chips, marks and warning (AC10.1.1, AC10.1.3 to AC10.1.5) | Staff editing allergens |
| US11.1 | The special, stock and events (AC11.1.1, AC11.1.3 to AC11.1.5) | The Menu card and countdown (AC11.1.2) | The launch and end page (AC11.1.1, AC11.1.5) |
| US13.1 | The station frozen on lines and the done-mark table (AC13.1.1) | | The boards, done actions and completion (AC13.1.2 to AC13.1.5) |
| US17.1 | Open, respond and clear engine and events (AC17.1.4, AC17.1.5) | The diner card (AC17.1.1, AC17.1.3 in part) | The pulse and Respond (AC17.1.2, AC17.1.3) |
| US18.1 | The rating engine and events (AC18.1.2, in part) | The thumbs (AC18.1.1, AC18.1.2) | The best and worst summary (AC18.1.3, AC18.1.4) |
| US19.1 | v1's tests, the safe database upgrade, the seed, events registered and the page route (AC19.1.1 to AC19.1.5) | | New staff pages load from any folder (AC19.1.5) |

## Implementation Order Within Each Unit

This is the order of work inside a Unit, not the order of Units (Delivery Planning decides that).

- **U5:** (1) the safe database upgrade and the seed options; (2) the Staff PIN and the guard; (3) the design system and the theme switch; (4) the new look on the five v1 screens; (5) the order, menu and estimate changes; (6) the Chef's special, calls and ratings engines; (7) the new live events and the shared alert logic; (8) the staff shell with its placeholder pages and the seams for U6 and U7.
- **U6:** (1) the options sheet and cart lines; (2) Settings with allergies, theme and sound; (3) the estimate and the tracker; (4) the ready banner; (5) "Same again"; (6) the call card; (7) the special card; (8) Rate your meal.
- **U7:** (1) the station boards and completion; (2) ticket timers and the new-order alert; (3) call Respond and the pulse; (4) Menu management; (5) the Chef's special page; (6) the floor map; (7) Past visits and sales with ratings; (8) QR codes; (9) option lines on the bill.

## Coverage Verification

- All 19 stories (US1.1 to US19.1) are assigned to at least one Unit.
- U5 has rows for 14 stories, U6 for 11 and U7 for 14, so every Unit has rows.
- No story is assigned to a Unit that implements no part of it.

## Assumptions & Open Questions

- The parts listed per Unit for a spanning story are the proposed split; Functional Design for each Unit confirms the criteria it traces.
