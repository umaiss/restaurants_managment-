# Requirements Analysis Questions

These questions come from the v2 brief's open questions (items 3 and 5), the scope you approved (`ideation/scope-definition/scope-document.md`) and what the code scan found in v1 (`aidlc/spaces/default/codekb/table-order/`). Everything else I needed to decide is listed as an assumption in the requirements document, with the recommended choice, so you can accept the list in one reply.

## Q1. [Product owner] Which staff screens and actions should the Staff PIN protect?

v1 opens every staff screen to anyone with the address, and the server trusts whatever a request says about who it is. The PIN has to be checked on the server, not only on the screen. This answer decides which routes ask for it.

A. Every staff screen and action: the Kitchen Board, the table bill and Close table, the menu availability panel, and all the new staff pages (Menu management, Chef's special drop, Past visits and sales, Live floor map, QR codes) (Recommended)
B. Only the new staff pages and Close table; the Kitchen Board and menu availability stay open as in v1
C. Only the new staff pages (Menu management, Chef's special drop, Past visits and sales, QR codes); everything v1 has stays open
D. Not yet defined
X. Other (please specify)

[Answer]: A. Every staff screen and action

## Q2. [Product owner] How should the estimated wait show to the diner (in the cart before ordering and on the order tracker)?

The brief leaves this open. It decides what the estimate has to be accurate to and what the tests check.

A. As minutes, for example "About 12 min" (Recommended)
B. As a plain word: "About right" or "Running late"
C. Both: minutes, plus "Running late" when the order has taken longer than its estimate
D. Not yet defined
X. Other (please specify)

[Answer]: C. Both: minutes, plus "Running late"

## Q3. [Product owner] What scale should "Rate your meal" use for each dish?

Staff see today's best- and worst-rated dishes, so the scale decides how they are ranked.

A. Thumbs up or thumbs down: one tap per dish (Recommended)
B. 1 to 5 stars: one tap per dish
C. Not yet defined
X. Other (please specify)

[Answer]: A. Thumbs up or thumbs down

## Q4. [Product owner] Dark mode follows the device setting. v1 is dark only, so a diner or staff member whose device is set to light would now see a light version of the app. Is that what you want?

This changes how v1 looks by default for people with a light device. The manual toggle overrides the device in every option.

A. Yes: follow the device, v1's current dark look becomes the dark theme, and a new light theme is added (Recommended)
B. Keep v1's dark look by default; the light theme only appears when someone switches it on with the toggle
C. Not yet defined
X. Other (please specify)

[Answer]: A. Yes: follow the device
