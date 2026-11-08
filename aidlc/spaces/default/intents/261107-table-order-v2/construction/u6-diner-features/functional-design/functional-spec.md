# Functional Specification: u6-diner-features

The behaviour of everything new the diner sees and does, in the order things happen. U6 is a screen-only Unit, so this file is the source of truth for the interaction workflows, the screen states and the screen rules (D1 to D12). `rules.md` restates the rules as BR1.1 to BR10.1 for traceability; each names its D or W id here. The data and the server rules are U5's (`construction/u5-foundation/functional-design/`, rule ids such as BR3.1 point there) and the routes and events are in `inception/contract-design/contract-summary.md`. The screens match the mockups you approved (`inception/refined-mockups/mockups/`: `diner-menu`, `diner-cart`, `diner-orders`, `diner-item-options`, `diner-settings`, `diner-closed-rate`). It follows your answer to Q1 in `functional-design-questions.md`: the thumbs screen reads the dishes of the closed visit from the server.

The requirements it answers are in `inception/requirements-analysis/requirements.md` (FR1, FR2, FR4, FR8, FR9, FR10, FR11, FR14, FR16, FR17, FR18 and NFR1, NFR3, NFR7).

U6 implements, in whole or in part, these stories (from `inception/units-generation/unit-of-work-story-map.md`): US1.1 (its new screens), US2.1 (the theme control in Settings), US4.1 (the diner ready banner), US8.1 (the options sheet, cart lines and refresh), US9.1 (the estimate and "Running late"), US10.1 (allergy chips, marks and warning), US11.1 (the Menu's special card), US14.1 (the order tracker), US16.1 ("Same again"), US17.1 (the call card) and US18.1 (the thumbs).

## What U6 Changes

- **Diner files only.** U6 edits `src/client/diner/features/*` (its folders), the three diner screens (`MenuScreen`, `CartScreen`, `MyOrdersScreen`), `TableView`, `useCart` and the diner components they use. No staff file, no server file except the one route option below, and no U5 file outside the diner side. U7 edits only staff files, so the two Units never touch the same lines.
- **The mount points are kept, and used where a feature is its own block** (the special card, the estimate, the call card, the tracker, the ready banner, the Settings button, the thumbs). Where a feature has to change an existing control (the "+ Add" button, the cart lines, the Place order step, an item card's marks) the screen file calls into U6's feature folder instead of rendering inline. This is recorded here because contract 7 describes the mount points only; the screens are diner-only files, so no other Unit is affected.
- **One additive server change (your Q1 answer).** `GET /api/tables/{id}/orders` gains the value `visit=last_closed`, which returns the same body as `visit=current` for the table's most recently closed visit (orders with their lines, options, `estimate_minutes` and `completed_at`; an empty list when the table has never been closed). `visit=current` and v1's behaviour do not change. The route stays open to every diner, as v1's is. This is U6's one edit to a U5 file, listed in U6's `code-summary.md`, with its test. The Unit definition says U6 never edits a U5 file outside its seams; this is a chosen exception (your Q1 answer), and U7 does not edit `orders.ts`, which U7's Functional Design confirms, so the parallel merge has nothing to resolve there.

## Workflows

### W1. Choose options and add to the cart (US8.1; BR2.4, BR3.1, BR3.2)

1. On the Menu, an item that has option groups shows a "Make it yours" badge; "+ Add" on it opens the options sheet. An item with no options adds straight to the cart as in v1.
2. The sheet shows the item name and its groups in order: choose one (radio, "Required" when it is), choose any and leave out (checkboxes). Each choice shows its price change ("+$3.00", "+$0.00", "−$1.00").
3. The line price shown at the bottom is the item price (the special price on a Chef's special) plus the chosen changes, and updates with every choice. It never shows below zero.
4. "Add to cart" is disabled until every required choose-one group has a choice, and the first missing group is named ("Choose a size"). Two choices in a choose-one group cannot be made.
5. Pressing it adds a cart line (W2). The same item with the same chosen choices adds to that line's quantity (up to 20); a different set of choices is a separate line.
6. Escape, the close button, or tapping outside closes the sheet and adds nothing. Focus stays inside the sheet while it is open and returns to the "+ Add" button when it closes.

### W2. The Cart: lines, refresh, estimate, allergy warning, placing (US8.1, US9.1, US10.1; BR3.4, BR4.1)

1. Each line shows its quantity and name, its chosen options under the name, and its line total (price each including options times quantity). Quantity changes as in v1, from 1 to 20 per line; a Chef's special line is also limited to the special's stock left.
2. When the Cart opens, and when a live menu or special event arrives, the cart is checked against the current menu (D3). Anything that changed is brought in line and one notice names it, as v1 does for prices.
3. The estimate banner shows "Estimated wait: about <n> min" labelled "Estimate" (W4).
4. On "Place order", if any line holds an item that contains an allergen the diner set, the allergy warning opens first (W3). "Place order anyway" continues; "Back to cart" closes it. Without the warning step the order cannot be placed.
5. The order is sent with every line's item, quantity, chosen option ids and special id. "Place order" is disabled from the tap until the answer comes back, so a double tap sends one order (the placement key protects a retry). The server answers 201 (or 200 for a repeated key) with the lines, `dropped_lines` and `estimate_minutes`.
6. Each dropped line is named in a notice with its reason ("sold out", "the Chef's special ran out", "an option is no longer offered"); the rest of the order is placed, as for v1's sold-out lines. When every line was dropped, the server answers 400 `EMPTY_ORDER` and gives no `dropped_lines`: the cart stays, the cart refresh (step 2) runs at once so the lines that are no longer available are named by the reason the refresh finds (sold out, special ended, option removed), and the notice says nothing could be ordered. This is the case two diners meet when they both order the last special.
7. After a placed order the cart empties as in v1 and My orders opens showing the new order with its estimate.
8. If the server answers 400 `INVALID_OPTIONS`, the cart is refreshed (step 2), the notice says an option needed attention, and nothing is lost.

### W3. Menu marks: allergens and the Chef's special (US10.1, US11.1; BR2.3, BR5.2)

1. An item whose allergen list contains an allergen the diner set shows "⚠ Contains <allergen>" and a red border; "+ Add" still works. An item with an allergen list that holds none of theirs shows no mark. An item with no allergen information shows "Allergens not set" and is never marked safe.
2. The Menu and the warning both say the marks are guidance and that serious allergies should be told to the staff.
3. The allergy warning names every cart line that contains a set allergen, with the allergen, so the diner knows what to remove.
4. While a Chef's special is live, a card above the category pills shows its name, special price, "<n> left" and "Ends in mm:ss". "+ Add" on it adds a special line (through the options sheet when the item has options). When the stock reaches 0 or the time runs out, the card is removed live. A countdown that reaches zero removes the card at once without waiting for the server.

### W4. Wait time and the order tracker (US9.1, US14.1; BR4.1 to BR4.3)

1. The Cart reads `GET /api/estimate?table=<id>` when it opens and again when an `ORDER_PLACED` or `ORDER_STATUS_CHANGED` event arrives, so a change shows within 2 seconds. When the basis is "default" (no order completed today) the banner says "Estimate" with the starting value and never "0 min".
2. Each open order on My orders shows a three-step bar: Pending, Preparing, Completed, with the current step highlighted. A step change animates; under reduced motion it changes with no movement.
3. Beside the bar the order shows "About <n> min left" from its stored estimate (the estimate minus whole minutes elapsed, at least 1), or "Running late" once it has waited longer than that estimate, never a zero or negative time. This is U5's shared decision function. An order placed before v2 has no estimate and shows no time. The remaining time is recalculated every 30 seconds.
4. A Cancelled order shows "Cancelled" and no bar. A Completed order shows the bar at its last step and no time.

### W5. The ready banner (US4.1; BR9.3, BR9.4)

1. The diner page uses U5's alert logic on its table events, and gives it each event with no time of its own, so no device clock is ever compared with the server's: an event that the live stream delivers is new unless its id was seen before, which is how a replay after a reconnect, or a duplicate, is kept from showing twice. A reload opens a fresh stream with no replay and loads the orders from the server without raising any alert. When an order for this table becomes Completed (an `ORDER_STATUS_CHANGED` event), a banner "Your order #<n> is ready" slides in within 2 seconds, the phone vibrates where it can, and a short sound plays only if the person has tapped the page and sound is not muted.
2. The banner can be dismissed and stays dismissed. It has a "Mute" action beside it that turns sound off for good in that browser.
3. It never shows again for an event that already happened: not after a reconnect that replays old events, and not after a reload.

### W6. The Settings sheet (US2.1, US4.1, US10.1)

1. A gear button in the page header opens the Settings sheet from the bottom. It holds "My allergies" (nine chips: gluten, dairy, eggs, peanuts, tree nuts, fish, shellfish, soy, sesame, multi-select), "Theme" (Follow device, Light, Dark) and "Sound alerts" (On, Muted).
2. Each control saves at once in the browser using U5's hooks, so it is still set after a reload; "Follow device" removes the saved theme. Blocked browser storage falls back to the defaults with no error.
3. The sheet closes with Escape or its close button, traps focus while open, and the menu behind it updates its allergy marks as soon as a chip changes.

### W7. The call card (US17.1; BR6.1 to BR6.3)

1. On My orders, a "Need something?" card has two independent buttons, "Call the waiter" and "Ask for the bill". It shows only while the table has an open visit (at least one order); with no orders the card is hidden.
2. The page reads the table's calls when it opens and again on `SERVICE_CALL_OPENED` and `SERVICE_CALL_RESPONDED` events. A button with an open request shows "Request sent" and is disabled; pressing is idempotent on the server too, so a double tap creates one request.
3. When staff respond, the line "Help is on the way." shows for that button, and the button is available again for a new request.
4. When the table is closed the card is gone and any open request has been cleared by the server.
5. A failed press (network error) shows "Could not send. Try again." and changes nothing; an answer of `409 NO_OPEN_VISIT` hides the card.

### W8. "Same again" (US16.1)

1. Each past (Completed) order on My orders has a "Same again" button.
2. For each line, the item is looked up on the current menu. An order's lines keep only each option's label and price change, not its group or id, so each option is matched by its label among the item's current choices. A line is skipped, and listed in a notice, when the item is sold out, hidden or gone, when any option it had finds no choice with that label, when a label matches choices in two different groups of the item (it cannot be told which was meant), when two matched choices fall in one choose-one group, or when a now-required group is left with no choice. Matched options are re-selected.
3. Lines are added at today's prices (including today's option changes); quantity never goes above 20 per line, and a line that would have gone above is capped at 20 and named in the notice.
4. A Chef's special line from the past order is added as an ordinary item at its current menu price, and the notice says the special price does not apply.
5. "Same again" is disabled from the tap until it has finished, so a double tap adds the items once. When the tap finishes the Cart tab opens with one notice saying what was added and what was skipped. An order whose items were all skipped adds nothing and says why.

### W9. Rate your meal (US18.1; BR7.1, BR7.2)

1. When the table is closed, the full-screen "Table closed" message shows as in v1, with the dishes of the visit below it: each dish once, with a thumbs up and a thumbs down. The dishes are read with `GET /api/tables/{id}/orders?visit=last_closed` and the visit id from the table status (`last_closed_visit_id`). Cancelled orders' dishes are left out.
2. Tapping a thumb saves that dish's rating at once (`POST /api/tables/{id}/ratings`); tapping the other thumb changes it. One rating per dish per visit.
3. "Done" sends the ratings with `done: true`, which locks them, and shows a thank-you line. After Done the thumbs are disabled; a refused change (409 `RATING_LOCKED`) shows "Your ratings are saved."
4. When a new visit opens at the table the thumbs are gone. A diner who reloads while the closed message is showing sees the same dishes again with no thumb chosen, because the server offers no route to read ratings back; the earlier ratings are kept by the server and a tap changes them until Done. This is accepted.
5. A rating that cannot be saved (network, 409 `VISIT_NOT_CLOSED`) shows "Could not save. Try again." and the thumb returns to its earlier state.

### W10. New screens keep the design system (US1.1)

Every new element (options sheet, settings sheet, banners, cards, thumbs) uses U5's design tokens and shared components with no literal colour a token covers, keeps 44 px touch areas, visible focus and keyboard use, shows status in words as well as colour, and stops all motion under reduced motion. U6 adds `e2e/u6-diner-features/mockup-match.spec.ts`, which compares each built screen with its mockup and lists the parts U5 or U7 own.

## Screen Rules

| ID | Rule | Source |
|---|---|---|
| D1 | A cart line is identified by its `lineId`: the item id, then `#` and its sorted choice ids joined by `+` when it has choices, then `@` and the special id when it is a special line. So a plain item's `lineId` is just its item id, which is also how v1 identified a line: a cart saved by v1 still loads, each line keeps working, and a fresh add of the same plain item joins that line instead of making a second one. Two different sets of choices are two lines; the same set adds to one line (up to 20). | AC8.1.2 |
| D2 | A line's price each is the base price (item, or special price) plus the chosen changes, at least 0, stored on the line in whole cents together with the chosen choices' labels. The server recomputes it; the screen's price is only a preview and is corrected by the cart refresh. | AC8.1.1, BR3.2 |
| D3 | Cart refresh. For each line, against the current menu: item gone, hidden or sold out: line removed and named. A chosen choice no longer exists: line removed and named. A now-required group has no choice: line removed and named. Prices changed: line repriced and one notice. A special line whose special has ended or run out: the line falls back to the regular price (without the special) and is named; when a regular line with the same item and choices already exists the two merge (quantities added, at most 20). A special line whose quantity is above the stock left is capped at the stock left and named, because the server drops a whole special line when the stock is short. The refresh runs when the Cart opens and on `MENU_CHANGED`, `MENU_AVAILABILITY_CHANGED` and `SPECIAL_CHANGED` events. | AC8.1.5, AC11.1.3 |
| D4 | The screen checks required groups and the one-choice rule before it sends, so the server's `INVALID_OPTIONS` is not expected; if it comes, W2 step 8 applies. | AC8.1.2, BR3.1 |
| D5 | An allergen mark is shown only for an allergen the diner set. An item with no allergen information (null) is labelled "Allergens not set" and is not treated as unsafe or safe. An empty list means none. | AC10.1.2, BR2.3 |
| D6 | The allergy warning blocks Place order until "Place order anyway" is pressed; it is asked every time the cart holds a marked item. Marks are guidance, and the screen says so. | AC10.1.4, AC10.1.5 |
| D7 | The estimate is always labelled "Estimate". The starting value (basis "default") is shown as the estimate, never as "0 min". | AC9.1.4 |
| D8 | An open order's wait is shown by U5's shared `waitDisplay`: minutes left, "Running late", or nothing. Never a zero or negative time. | AC9.1.3, BR4.2 |
| D9 | A banner, sound or vibration fires once per event id and only for events newer than the page load, through U5's alert logic. Sound waits for the first tap and obeys the mute. | AC4.1.1 to AC4.1.4, BR9.3, BR9.4 |
| D10 | A call button is idempotent; the card shows only with an open visit; "Help is on the way." shows after staff respond. | AC17.1.1, AC17.1.3, AC17.1.4 |
| D11 | A rating is one thumb per dish per closed visit; it can change until Done; after Done it is locked. | AC18.1.1, AC18.1.2, BR7.2 |
| D12 | The new screens are built from the design system and compared with their mockups. | AC1.1.1, AC1.1.4 |

## State Machines

### Cart line

| State | Meaning | Moves to |
|---|---|---|
| In cart | chosen options and quantity 1 to 20 | In cart (quantity or refresh), Removed (quantity 0, remove, refresh drops it), Placed (order sent) |
| Removed | gone from the cart, named in a notice when a refresh removed it | none |
| Placed | sent in an order | none (the cart empties) |

### Call button (one per kind)

| State | Meaning | Moves to |
|---|---|---|
| Ready | no open request of this kind | Sent (pressed) |
| Sent | an open request exists ("Request sent") | Answered (staff respond) or Gone (table closed) |
| Answered | "Help is on the way." | Ready (shown again for a new request) |

### Chef's special card

| State | Meaning | Moves to |
|---|---|---|
| Shown | a live special with stock left and time left | Hidden (stock 0, time up, ended, replaced by another special which is Shown) |
| Hidden | no card | Shown (a special is launched) |

### Rating (per dish)

| State | Meaning | Moves to |
|---|---|---|
| Unrated | no thumb | Rated (a thumb tapped) |
| Rated | a thumb, can change | Rated (other thumb), Locked (Done) |
| Locked | final | none |

### Ready banner

| State | Meaning | Moves to |
|---|---|---|
| Hidden | nothing to show | Shown (a new Completed event for this table) |
| Shown | the banner with its Mute action | Hidden (dismissed) |

## Business Scenarios

- **Happy path:** Dina opens the Menu on her phone with "dairy" set in Settings; Margherita Pizza shows "⚠ Contains dairy". She adds a Classic Burger through the sheet (Large, Extra cheese, no onions), sees the line price and the estimate in the Cart, presses Place order, and My orders shows the tracker with "About 14 min left". When the kitchen completes it, a banner and a buzz tell her. She presses "Ask for the bill", staff respond and she sees "Help is on the way.". After Close table she taps thumbs and Done.
- **Unhappy path:** The Chef's special runs out while its line is in the cart: the cart reprices it with a notice. A required option group is added to a Burger already in the cart: the line is removed and named. Two diners order the last special: one is told it is gone in a notice and the rest of the order is placed.
- **Concurrency and replay:** The live stream drops and replays old events: no banner or sound repeats. A double tap on "Call the waiter" makes one request.

## Assumptions & Open Questions

- The Chef's special line in "Same again" is added as an ordinary item at its menu price, with a notice; the alternative is to skip it.
- A special line whose special ended falls back to the regular price with a notice rather than being removed; the alternative is to remove it.
- The ready banner stays until dismissed (no timer) and has its own "Mute" action beside the Settings sound control.
- A reload while the closed message is showing shows the thumbs unrated, because the server has no route to read back a diner's earlier ratings; this is accepted for a diner who reloads the page.
- The countdown uses the device's clock against the special's server end time; a device with a wrong clock may show a short or long countdown, and the live `SPECIAL_CHANGED` event still removes the card at the right moment.
- U6 changes the diner screen files directly, as described under "What U6 Changes", because contract 7's mount points are separate blocks and cannot change an existing control. This is the one place U6 differs from the contract's wording.
