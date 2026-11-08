# Refined Mockups: Table Order v2

High-fidelity, standalone HTML mockups of every new or changed screen, built on one small design system. Open `mockups/index.html` to see them all; each page also opens on its own and has a Follow device / Light / Dark switch in its toolbar. They are built from the stories (`inception/user-stories/stories.md`) and the requirements (`inception/requirements-analysis/requirements.md`), with your four design answers: evolve v1's look (Q1), a side navigation for staff (Q2), the call buttons on My orders (Q3), and a Settings sheet for allergies, theme and sound (Q4). v1's own mockups are untouched.

The rough-mockups stage is not part of this plan, so there were no wireframes or user-flow files to start from. The screens were designed directly from the stories and requirements.

## Screens

| # | Screen | File | Stories | What is new or changed |
|---|---|---|---|---|
| 0 | Index | `mockups/index.html` | all | Links every mockup |
| 1 | Design system | `mockups/design-system.html` | US1.1, US2.1 | New: colours in two themes, type scale, spacing, radius, shadows, components |
| 2 | Diner Menu | `mockups/diner-menu.html` | US1.1, US8.1, US10.1, US11.1 | New look; Settings icon; live Chef's special; allergy marks and "Allergens not set"; "Make it yours" badge |
| 3 | Make it yours sheet | `mockups/diner-item-options.html` | US8.1 | New: choose one, choose any, leave out, with a live line price |
| 4 | Diner Cart | `mockups/diner-cart.html` | US8.1, US9.1, US10.1 | New look; options on each line; estimated wait; allergy warning before ordering |
| 5 | Diner My orders | `mockups/diner-orders.html` | US4.1, US9.1, US14.1, US16.1, US17.1 | New look; ready banner; order tracker and estimate; "Same again"; Call the waiter / Ask for the bill card |
| 6 | Diner Settings sheet | `mockups/diner-settings.html` | US2.1, US4.1, US10.1 | New: allergies, theme and sound |
| 7 | Table closed and Rate your meal | `mockups/diner-closed-rate.html` | US18.1 | v1's closed message in the new look, plus thumbs up or down per dish |
| 8 | Staff PIN | `mockups/staff-pin.html` | US3.1 | New: PIN entry, wrong PIN, locked |
| 9 | Kitchen Board, All stations | `mockups/staff-board.html` | US1.1, US4.1, US8.1, US13.1, US15.1, US17.1 | New look and side navigation; new-order alert and mute; station tabs; ticket timers; options on tickets; calls pulse |
| 10 | Kitchen Board, Grill station | `mockups/staff-station.html` | US13.1 | New: one station's lines and "Grill done" |
| 11 | Table Bill and Close table | `mockups/staff-bill.html` | US1.1, US8.1 | New look and side navigation; options on lines |
| 12 | Floor map | `mockups/staff-floor.html` | US12.1, US17.1 | New: every table by state |
| 13 | Menu management | `mockups/staff-menu.html` | US6.1, US8.1, US10.1, US13.1 | New: items, categories, options, allergens, stations |
| 14 | Chef's special | `mockups/staff-special.html` | US11.1 | New: launch, live special, end early |
| 15 | Past visits and sales | `mockups/staff-sales.html` | US5.1, US18.1 | New: by day, totals, best sellers, average time, ratings |
| 16 | QR codes | `mockups/staff-qr.html` | US7.1 | New: printable code for every table |

## Words the Built Screens Must Show (mockup-match)

The mockup-match tests check that each built screen shows the headings, labels, buttons, messages and status words of its mockup. These are the fixed words:

- **Diner:** tabs "Menu", "Cart", "My orders"; header "Table <n>" and "Updated live"; "View cart", "Place order"; "+ Add"; "Sold out"; "Chef's special", "Ends in <mm:ss>", "<n> left"; "⚠ Contains <allergen>", "Allergens not set"; "Make it yours"; sheet "Required", "Add to cart"; cart "Your cart", "Clear cart", "Estimated wait: about <n> min", "Estimate, based on today's orders and how busy the kitchen is right now."; warning "This order may not be safe for you", "Place order anyway", "Back to cart"; orders "Order #<n>", "Pending", "Preparing", "Completed", "Cancelled", "Running late", "About <n> min left", "Same again", "Cancel order", "Need something?", "Call the waiter", "Ask for the bill", "Help is on the way."; ready banner "Order #<n> is ready"; Settings "Settings", "My allergies", "Theme", "Follow device", "Light", "Dark", "Sound alerts", "On", "Muted"; closed "Table closed", "Thank you for dining with us.", "Rate your meal", "Done".
- **Staff:** "Staff PIN", "Open", "That PIN is not right", "Too many tries"; nav "Kitchen Board", "Floor map", "Menu management", "Chef's special", "Past visits and sales", "QR codes", "Sign out"; board "Kitchen Board", "Updated live", "Menu availability", "Sound on", "Muted", "All stations", "Grill", "Cold", "Bar", "Desserts", "Start preparing", "Complete", "Cancel", "Respond", "New order #<n> from Table <n>", "Slow", "Late", "Asking for the bill", "Calling the waiter", "Ready to close", "Grill done"; bill "Table <n> — Bill", "← Board", "Combined total", "Close table"; floor "Empty", "Browsing", "Waiting", "Eating", "Needs the bill"; menu management "Add item", "Add category", "Hide item", "Hide category", "Save", "Add option group", "Allergens it contains"; special "Launch special", "End special now", "Live now"; sales "Total sales", "Average time to Completed", "Best sellers", "Best rated today", "Worst rated today", "No completed orders"; QR "Print".

Parts that a later Unit owns are left out of a Unit's comparison and listed there; which Unit owns which screen is decided in Units Generation.

## Changes to v1 Shown in These Mockups

Every change here is on the "Changes to v1" list in the scope document. v1's own mockups are not edited.

- All five v1 screens take the new look and both themes (scope answer Q2): Menu, Cart, My orders, Kitchen Board, Table Bill and Close table.
- The Kitchen Board gains the side navigation and the All stations / station tabs, and keeps v1's cards and buttons (scope answer Q3).
- The Staff screens gain the PIN screen in front of them and the side navigation.
- v1's wording is kept where v1 had it, so v1's tests keep passing: tab labels, "Kitchen Board", "Menu availability", "Updated live", "Table <n> — Bill", "← Board", "Close table", "Combined total", "Sold out", "Order #<n> placed", "Your cart is empty", "No orders yet".

## Assumptions & Open Questions

I chose the recommended answer for each of these. Accept them in one reply at the approval, or tell me which to turn into a question.

- The new look is v1's look evolved: the amber accent and v1's dark palette are kept as the dark theme, and a warm light theme is added (design answer Q1).
- Staff move between pages with a side navigation at 1024 px and wider, and a top bar with a menu button below that (design answer Q2).
- The diner reaches Settings from a gear icon in the header, and the call buttons are a card at the top of My orders (design answers Q3, Q4).
- The ready banner, new-order alert, call labels and timers use words as well as colour (accessibility).
- The tracker shows three steps. Station progress is shown on the station board, not on the diner's tracker.
- The QR code art in the mockup is illustrative; the built page makes real codes.
- The new-order alert on the Kitchen Board is a banner that stays until dismissed or until the order is started.
- Empty, loading and error views for the new staff pages follow the same pattern as v1's (a plain sentence saying what happened and what to do next); they are described in `interaction-spec.md` rather than drawn.
