# Scope Document: Table Order v2

This scope builds on the intent statement (`ideation/intent-capture/intent-statement.md`) and the answers in `scope-definition-questions.md`. Where a line comes from an answer, it names the question (Q1 to Q3 here; the Intent Capture picks are marked IC-Q1 to IC-Q3).

## In Scope

All 17 features picked in Intent Capture, plus the new look for every screen (the small design system built once and used everywhere).

| Group | Features | Source |
|---|---|---|
| List A: left out of v1 | Staff PIN, Notifications, Past visits and sales, Menu management, QR codes | IC-Q1 |
| List B: most apps don't have these | Make it yours, Honest wait time, Allergy shield, Chef's special drop, Live floor map, Kitchen stations | IC-Q2 |
| List C: X-factors | Animated order tracker, Kitchen ticket timers, Dark mode, "Same again", Call the waiter / Ask for the bill, Rate your meal | IC-Q3 |
| A more professional look | A small design system used by every new screen and by every v1 screen | Q2 |

## Priority (Must / Should / Could)

You chose to keep all 17 and rank them, so the Could items are the first to slip if time runs out (Q1). The ranking below is my proposal and is listed under Assumptions & Open Questions for you to accept or change. The Must items are the brief's minimum of 2 features from each list, picked for low risk and for building cleanly on v1.

| Rank | Features |
|---|---|
| Must (6, plus the new look on every screen) | Staff PIN, Notifications, Make it yours, Honest wait time, Animated order tracker, Kitchen ticket timers |
| Should (6) | Past visits and sales, Menu management, Allergy shield, Kitchen stations, Dark mode, Call the waiter / Ask for the bill |
| Could (5) | QR codes, Chef's special drop, Live floor map, "Same again", Rate your meal |

## Changes to v1

v1 stays exactly as signed off except for the changes in this table. Anything not listed is left alone. Only the first two rows were picked directly in a Scope Definition question; the rest follow from the features you picked and are listed here so you can see them.

| v1 screen or behaviour | What changes | Why | Chosen in |
|---|---|---|---|
| All v1 screens: Menu, Cart, My orders, the kitchen board, the bill and Close table screen | They take the new look (colours, type, spacing, rounded corners, shadows), so Dark mode covers the whole app | You chose the new look for every v1 screen | Q2 |
| Kitchen board | It stays as an "All stations" view and gains one board per station; an order is Completed only when every station has finished its part | Kitchen stations | Q3 |
| Staff view (kitchen board, bill and Close table) | It asks for a PIN before opening; v1 opens it with no protection | Staff PIN | Follows from IC-Q1 |
| Menu | Item cards gain choices that change the price, marks for dishes that are unsafe for a diner's allergies, and a live Chef's special; items staff edit or hide change on open menus | Make it yours, Allergy shield, Chef's special drop, Menu management | Follows from IC-Q1 and IC-Q2 |
| Cart | Shows each chosen option and its price, warns before an unsafe order is placed, and shows the estimated wait | Make it yours, Allergy shield, Honest wait time | Follows from IC-Q2 |
| My orders | Shows an animated tracker and estimated wait, a "Same again" button, and a rating after the table is closed | Animated order tracker, Honest wait time, "Same again", Rate your meal | Follows from IC-Q2 and IC-Q3 |
| Kitchen ticket | Shows the chosen options, turns amber then red as the order ages, and the table's card pulses when a diner calls the waiter or asks for the bill | Make it yours, Kitchen ticket timers, Call the waiter / Ask for the bill | Follows from IC-Q2 and IC-Q3 |
| Order and table data | New tables and new fields are added with safe defaults; v1 data is kept and v1's sample data still loads | Every picked feature that stores something new | Follows from IC-Q1 to IC-Q3 |

## Out of Scope

Payments, native mobile apps, cloud deployment, diner accounts, email or SMS, and anything that needs a paid external service. These come from the v2 brief and were accepted as assumptions in Intent Capture. Multi-language, Shared table cart, Manager TV wall and any X-factor of your own were not picked, so they are not in this version (nothing else is excluded by omission).

## Value Stream Map

| Step | Who | What happens | Features that touch it |
|---|---|---|---|
| 1. Arrive | Diner | Scans the table's code and opens the menu | QR codes, Dark mode, new look |
| 2. Choose | Diner | Browses the menu, sets allergies, picks options | Allergy shield, Make it yours, Chef's special drop, Menu management |
| 3. Order | Diner | Reviews the cart and places the order, seeing the estimated wait | Honest wait time, Allergy shield |
| 4. Prepare | Kitchen | Works from the board for each station; tickets age amber then red | Kitchen stations, Kitchen ticket timers, Notifications (staff alert) |
| 5. Wait and eat | Diner | Watches the tracker, is told when the order is ready, can reorder | Animated order tracker, Notifications, "Same again", Call the waiter / Ask for the bill |
| 6. Pay and close | Staff | Bills the table and closes it after the PIN | Staff PIN, Live floor map |
| 7. Review | Staff and diner | Staff see past visits and sales; the diner rates the dishes | Past visits and sales, Rate your meal |

## Timeline Check

The hand-in is due Tuesday 10 November 2026, end of day, and today is Saturday 7 November 2026. Seventeen features plus a new look on every screen is a large amount of work for that time, so the Must items come first and the Could items are expected to be the first to slip. This is an assumption to confirm, not a measured estimate.

## Assumptions & Open Questions

I chose the recommended answer for each of these. Accept them in one reply at the approval, or tell me which to turn into a question.

- The Must / Should / Could ranking above is my proposal, not your choice. Tell me which features to move.
- The rows of "Changes to v1" that follow from the features you picked (Staff view, Menu, Cart, My orders, Kitchen ticket, Order and table data) are approved with the features. Tell me if you want any of them left out.
- Which staff screens the PIN covers (the kitchen board, bill and Close table, and the new staff pages) is for Requirements Analysis; the brief leaves it open.
- Whether the wait estimate and the order tracker show minutes or "about right / running late" is for Requirements Analysis; the brief leaves it open.
- The Could items are the first to slip if time runs out; nothing is dropped now (Q1).
