# Intent Capture Questions

## Sources

- [desc] Initial description: "Build Table Order v2 from ideas/table-order-v2/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

These questions come from the v2 brief (`ideas/table-order-v2/IDEA.md`). The brief says every team must pick at least 2 features from List A, at least 2 from List B, and at least 2 X-factors from List C (or invent them), and that fewer things done well beat many things half done. Select all that apply in each question. The recommended picks come first; they are small, add to v1 without changing how it works, and can be built in parallel.

## Q1. [Product owner] Which features from List A (the ones v1 left out) should v2 include? (select all that apply, at least 2)

The picks decide what the foundation Unit (U5) and the two parallel feature Units must build.

A. Staff PIN: the staff view asks for a PIN (v1 opens it with no protection) (Recommended)
B. Notifications: the diner is told when an order is ready (banner, sound or vibration), and staff are alerted to new orders (Recommended)
C. Past visits and sales: closed visits by day, with totals, best-selling items and average time from order to Completed
D. Menu management: staff add, edit and hide items, categories, prices and images, and changes reach open menus live
E. QR codes: a staff page that prints a QR code for every table, linking to `/table/:id`
F. Multi-language: a language switcher on the diner screens, English plus at least one other language (a right-to-left language counts double)
G. Not yet defined
X. Other (please specify)

[Answer]: A, B, C, D, E

## Q2. [Product owner] Which features from List B (the ones most ordering apps don't have) should v2 include? (select all that apply, at least 2)

The picks decide what the foundation Unit (U5) and the two parallel feature Units must build.

A. Make it yours: items have options (spice level, no onions, extra cheese, size) that change the price and show on the kitchen ticket (Recommended)
B. Honest wait time: the diner sees an estimated wait, worked out from how long today's orders have taken and how busy the kitchen is (Recommended)
C. Allergy shield: the diner sets their allergies once, unsafe dishes are marked on the menu, and the cart warns before an unsafe order is placed
D. Chef's special drop: staff launch a limited special with a countdown and a stock count, live on every open menu until it sells out or time runs out
E. Live floor map: staff see every table coloured by what is happening there (empty, browsing, waiting, eating, needs the bill), updated live
F. Kitchen stations: each item belongs to a station (Grill, Cold, Bar, Desserts) with its own board, and an order is Completed when every station has finished
G. Shared table cart: several phones at one table share one live cart, each person sees who added what, and anyone can place the order
H. Not yet defined
X. Other (please specify)

[Answer]: A, B, C, D, E, F

## Q3. [Product owner] Which X-factors from List C should v2 include, or which of your own should it add? (select all that apply, at least 2)

An X-factor is the part of v2 a judge remembers; the picks decide what the demo shows.

A. Animated order tracker: the diner sees Pending, Preparing, Completed as a progress bar with the estimated wait (Recommended)
B. Kitchen ticket timers: tickets turn amber, then red, as an order ages (Recommended)
C. Dark mode that follows the device setting, with a manual toggle
D. "Same again" on My orders: one tap re-adds a previous order's items to the cart
E. Call the waiter / Ask for the bill buttons that make the table's card pulse on the kitchen board and floor map until staff respond
F. Manager TV wall: a big-screen view of live orders, today's takings so far, the busiest table and the top dish
G. Rate your meal: a one-tap rating per dish after the table is closed, shown to staff as today's best- and worst-rated dishes
H. Not yet defined
X. Other (please specify; name any X-factor of your own)

[Answer]: A, B, C, D, E, G

## Assumption Confirmation

These assumptions are in the intent statement and the stakeholder map. Accepting them does not make them facts; they stay marked as assumptions.

- v2 is new work on top of the existing v1 app, and v1's screens, behaviour, tests and data stay as they are unless the team chooses to change them in Scope Definition.
- Out of scope for this first version: payments, native mobile apps, cloud deployment, diner accounts, email or SMS, and anything that needs a paid external service.
- Success also means `npm test && npm run test:e2e` passes (v1's tests included), every new or changed screen has a mockup-match test, and every new screen looks professional on a small design system.
- The work is due Tuesday 10 November 2026, end of day, with a 5-minute demo after the hand-in.
- The team picked 17 features in all (5 + 6 + 6) for a hand-in three days away, while the brief says fewer things done well beat many things half done. Scope Definition should confirm the full list or trim it.
- Open question: which v1 screens or behaviours change, if any (for example a redesigned Menu), is for Scope Definition.
- Open question: whether staff-only actions (Menu management, Chef's special drop, Past visits and sales) sit behind the Staff PIN or open like the v1 staff view is for Requirements Analysis.
- Open question: whether the wait estimate and order tracker show minutes or "about right / running late" is for Requirements Analysis.
- The initiative trigger is not yet known.
- The product owner is the decision-maker for the feature picks, because Q1, Q2 and Q3 were answered for the team.
- Who else decides or influences scope, and any reporting cadence, are not yet known.

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: A. Accept assumptions
