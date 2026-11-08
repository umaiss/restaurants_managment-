# Business Rules: u6-diner-features

The decision logic of the diner screens, as numbered rules for traceability. U6 is a screen-only Unit, so these are screen rules; the server rules they rely on are U5's (`construction/u5-foundation/functional-design/rules.md`, ids such as BR3.1 there). Each rule names its workflow or screen rule in `functional-spec.md` (`spec_ref`, the D-ids and W-ids there). No code or SQL.

```yaml
rules:
  - id: BR1.1
    statement: "A cart line is identified by its item, its chosen choices and whether it is a special line."
    category: constraint
    applies_to: CartScreen
    trigger: "Adding an item to the cart"
    logic: "A line's lineId is its item id, then '#' and its sorted choice ids joined by '+' when it has choices, then '@' and the special id when it is a special line. IF a line with the same lineId exists THEN add to its quantity (up to 20). OTHERWISE add a new line. A plain item's lineId is its item id, as v1 identified a line, so a cart saved by v1 still loads and a fresh add of the same plain item joins its line."
    violation: "Not applicable."
    source: "AC8.1.2"
    spec_ref: "D1, W1"
  - id: BR1.2
    statement: "The line price shown is the base price plus the chosen changes, never below zero; the server's price is the one charged."
    category: calculation
    applies_to: OptionsSheet
    trigger: "Choosing options, showing a cart line, showing My orders"
    logic: "price each = base price (the item, or the special price on a special line) + the sum of the chosen choices' changes, at least 0. The line total is price each times quantity. The cart refresh corrects any difference from the server's price."
    violation: "Not applicable."
    source: "AC8.1.1, AC8.1.3"
    spec_ref: "D2, W1, W2"
  - id: BR1.3
    statement: "Add to cart waits until every required group has a choice, and the first missing group is named."
    category: validation
    applies_to: OptionsSheet
    trigger: "Choosing options in the sheet"
    logic: "IF a required choose-one group has no choice THEN 'Add to cart' is disabled and 'Choose a <group>' is shown beside the first missing group. A choose-one group holds at most one choice."
    violation: "Add is disabled; nothing is added."
    source: "AC8.1.2"
    spec_ref: "D4, W1"
  - id: BR1.4
    statement: "The cart is brought in line with the menu and the special whenever it opens or they change, and one notice says what changed."
    category: policy
    applies_to: CartScreen
    trigger: "Opening the Cart, and a MENU_CHANGED, MENU_AVAILABILITY_CHANGED or SPECIAL_CHANGED event"
    logic: "For each line against the current menu: IF the item is gone, hidden or sold out, or a chosen choice no longer exists, or a now-required group has no choice THEN remove the line and name it. IF the price changed THEN reprice the line. IF a special line's special ended or ran out THEN the line falls back to the regular price and is named, merging with an existing regular line of the same item and choices (quantities added, at most 20). IF a special line's quantity is above the stock left THEN cap it at the stock left and name it. One notice lists what changed."
    violation: "Not applicable."
    source: "AC8.1.5, AC11.1.3"
    spec_ref: "D3, W2"
  - id: BR1.5
    statement: "The screen checks options before it sends, and handles the server's INVALID_OPTIONS without losing the cart."
    category: validation
    applies_to: CartScreen
    trigger: "Placing an order"
    logic: "Required groups and the one-choice rule are checked on the screen first. The Place order button is disabled from the tap until the answer comes back, so one tap sends one order. IF the server still answers INVALID_OPTIONS THEN refresh the cart (BR1.4), say an option needed attention, and keep every other line."
    violation: "A notice; nothing is lost."
    source: "AC8.1.2"
    spec_ref: "D4, W2"
  - id: BR1.6
    statement: "A line the server dropped is named with its reason and the rest of the order is placed."
    category: policy
    applies_to: CartScreen
    trigger: "An order answered with dropped_lines"
    logic: "Each dropped line is named: SOLD_OUT_AT_SUBMIT as sold out, SPECIAL_SOLD_OUT as 'the Chef's special ran out', OPTION_UNAVAILABLE as 'an option is no longer offered'. IF every line was dropped THEN the server answers 400 EMPTY_ORDER with no dropped lines: the cart stays, the cart refresh (BR1.4) runs at once to name the lines that are no longer available, and the notice says nothing could be ordered."
    violation: "Not applicable."
    source: "AC11.1.4"
    spec_ref: "W2"
  - id: BR2.1
    statement: "An allergen mark shows only for an allergen the diner set, and an item with no allergen information says so."
    category: policy
    applies_to: MenuScreen
    trigger: "Showing an item"
    logic: "IF the item's allergen list contains an allergen the diner set THEN show '⚠ Contains <allergen>' and a red border. IF the list is not set THEN show 'Allergens not set', never a safe mark. An empty list shows no mark."
    violation: "Not applicable."
    source: "AC10.1.2, AC10.1.3"
    spec_ref: "D5, W3"
  - id: BR2.2
    statement: "The allergy warning must be passed before an order with a marked item is placed, and the marks are called guidance."
    category: policy
    applies_to: CartScreen
    trigger: "Pressing Place order with a marked item in the cart"
    logic: "Open the warning naming each marked line and its allergen. 'Place order anyway' continues, 'Back to cart' returns. The Menu and the warning say the marks are guidance and that serious allergies should be told to the staff."
    violation: "The order is not placed."
    source: "AC10.1.4, AC10.1.5"
    spec_ref: "D6, W3"
  - id: BR2.3
    statement: "Allergies are chosen from the fixed list and kept in the browser."
    category: policy
    applies_to: SettingsSheet
    trigger: "Choosing allergy chips"
    logic: "Nine chips (gluten, dairy, eggs, peanuts, tree nuts, fish, shellfish, soy, sesame), multi-select, saved at once with U5's allergy hook; still set after a reload. Blocked storage falls back to none set."
    violation: "Not applicable."
    source: "AC10.1.1"
    spec_ref: "W6"
  - id: BR3.1
    statement: "The estimate is always labelled an estimate and never shows 0 minutes."
    category: policy
    applies_to: EstimateBanner
    trigger: "Showing the estimate"
    logic: "The banner says 'Estimated wait: about <n> min' labelled 'Estimate'. IF the basis is the starting value THEN it still says 'Estimate' with that value."
    violation: "Not applicable."
    source: "AC9.1.4"
    spec_ref: "D7, W4"
  - id: BR3.2
    statement: "The estimate is read when the Cart opens and again after any order event."
    category: policy
    applies_to: EstimateBanner
    trigger: "Opening the Cart, ORDER_PLACED, ORDER_STATUS_CHANGED"
    logic: "Read the estimate route and show the answer; a change reaches the screen within 2 seconds of the event. IF the read fails THEN the banner says 'Estimate unavailable' and the order can still be placed."
    violation: "Not applicable."
    source: "AC9.1.2, AC9.1.5"
    spec_ref: "W4"
  - id: BR3.3
    statement: "An open order's wait shows minutes left or 'Running late', never zero or a negative time."
    category: calculation
    applies_to: OrderTracker
    trigger: "Showing an open order"
    logic: "Use U5's shared wait decision: minutes left (the stored estimate minus whole minutes elapsed, at least 1), 'Running late' once the wait passes the estimate, nothing for an order without an estimate. The text is recalculated every 30 seconds and shown beside the bar."
    violation: "Not applicable."
    source: "AC9.1.3, AC14.1.3"
    spec_ref: "D8, W4"
  - id: BR3.4
    statement: "An open order shows Pending, Preparing and Completed as a bar with the current step highlighted, and a step change animates."
    category: policy
    applies_to: OrderTracker
    trigger: "Showing My orders, an order's status changing"
    logic: "Highlight the current step. A status change moves the highlight with an animation; under reduced motion it changes with no movement."
    violation: "Not applicable."
    source: "AC14.1.1, AC14.1.2"
    spec_ref: "W4"
  - id: BR3.5
    statement: "A Cancelled order shows 'Cancelled' and no bar."
    category: policy
    applies_to: OrderTracker
    trigger: "Showing a Cancelled order"
    logic: "Show the word 'Cancelled' and no progress bar and no time."
    violation: "Not applicable."
    source: "AC14.1.4"
    spec_ref: "W4"
  - id: BR4.1
    statement: "A ready alert fires once per event, never for old events, and sound waits for a tap and the mute."
    category: policy
    applies_to: ReadyBanner
    trigger: "An ORDER_STATUS_CHANGED event to Completed for this table"
    logic: "Through U5's alert logic, given each event with no time of its own so that no device clock is compared with the server's: the banner shows within 2 seconds and the phone vibrates where it can; a short sound plays only after the first tap on the page and when sound is not muted. An event whose id was seen before (a replay after a reconnect, a duplicate) shows nothing, and a reload opens a fresh stream with no replay and raises no alert for orders it loads."
    violation: "Not applicable."
    source: "AC4.1.1, AC4.1.3, AC4.1.4"
    spec_ref: "D9, W5"
  - id: BR4.2
    statement: "The ready banner can be dismissed and has its own Mute action."
    category: policy
    applies_to: ReadyBanner
    trigger: "A shown banner"
    logic: "Dismissing hides it for good. 'Mute' turns sound off in the browser, the same setting as Settings. A mute control is also always in the Settings sheet."
    violation: "Not applicable."
    source: "AC4.1.4"
    spec_ref: "W5, W6"
  - id: BR5.1
    statement: "A call button makes one request per kind and the card shows only while the table has an open visit."
    category: constraint
    applies_to: HelpCard
    trigger: "Pressing Call the waiter or Ask for the bill"
    logic: "The card shows only when the table has at least one order in its open visit. A button with an open request shows 'Request sent' and is disabled; a double press makes one request. The two kinds are independent. A 409 NO_OPEN_VISIT hides the card; a network failure says 'Could not send. Try again.'"
    violation: "Not applicable."
    source: "AC17.1.1, AC17.1.4"
    spec_ref: "D10, W7"
  - id: BR5.2
    statement: "When staff respond, the diner sees 'Help is on the way.'"
    category: policy
    applies_to: HelpCard
    trigger: "A SERVICE_CALL_RESPONDED event or a read that shows the request responded"
    logic: "Show 'Help is on the way.' for that button, and make the button available again for a new request."
    violation: "Not applicable."
    source: "AC17.1.3"
    spec_ref: "D10, W7"
  - id: BR5.3
    statement: "Closing the table clears the card."
    category: policy
    applies_to: HelpCard
    trigger: "A TABLE_CLOSED event"
    logic: "The card is gone; the server has already cleared the open requests."
    violation: "Not applicable."
    source: "AC17.1.5"
    spec_ref: "W7"
  - id: BR6.1
    statement: "A dish has one rating per closed visit; it can change until Done and then it is locked."
    category: constraint
    applies_to: RatingList
    trigger: "Tapping a thumb or Done"
    logic: "A thumb saves at once; the other thumb changes it. 'Done' sends the ratings with done set to true and shows a thank-you line; after it the thumbs are disabled and a refused change (RATING_LOCKED) says 'Your ratings are saved.' A failed save says 'Could not save. Try again.' and the thumb returns to its earlier state."
    violation: "Not applicable."
    source: "AC18.1.2"
    spec_ref: "D11, W9"
  - id: BR6.2
    statement: "After the table is closed, each dish of that visit shows with a thumbs up and a thumbs down."
    category: policy
    applies_to: RatingList
    trigger: "The closed message showing"
    logic: "Read the dishes of the table's most recently closed visit from the server (the visit=last_closed option of the orders route), each dish once, Cancelled orders' dishes left out, and show a thumbs up and a thumbs down for each beside the closed message."
    violation: "Not applicable."
    source: "AC18.1.1"
    spec_ref: "W9"
  - id: BR7.1
    statement: "Every new element uses the design system and is compared with its mockup."
    category: constraint
    applies_to: DesignSystem
    trigger: "Building any new screen or element"
    logic: "Use U5's tokens and shared components with no literal colour a token covers; keep 44 px touch areas, visible focus, keyboard use, words with colour, and no motion under reduced motion. A mockup-match spec compares each built screen with its mockup and lists the parts other Units own."
    violation: "The mockup-match or style test fails."
    source: "AC1.1.1, AC1.1.3, AC1.1.4"
    spec_ref: "D12, W10"
  - id: BR7.2
    statement: "The theme can be chosen in the Settings sheet."
    category: policy
    applies_to: SettingsSheet
    trigger: "Choosing Follow device, Light or Dark"
    logic: "Use U5's theme hook: Light or Dark is saved and shows after a reload; Follow device removes the saved choice and returns to the device setting."
    violation: "Not applicable."
    source: "AC2.1.3"
    spec_ref: "W6"
  - id: BR8.1
    statement: "'Same again' re-adds what it can match and names what it skipped."
    category: policy
    applies_to: SameAgainButton
    trigger: "Pressing Same again on a past order"
    logic: "Each line is looked up on the current menu. An order's lines keep each option's label and price change only, so options are matched by label among the item's current choices. IF the item is sold out, hidden or gone, or an option's label finds no choice, or a label matches choices in two groups, or two matched choices fall in one choose-one group, or a now-required group is left empty THEN skip the line and name it. Otherwise re-select the options, add at today's prices, and cap the quantity at 20 per line, naming a capped line. A special line from the past order is added as an ordinary item at its menu price, with a notice. The button is disabled until the work has finished, so a double tap adds the items once."
    violation: "Not applicable."
    source: "AC16.1.1, AC16.1.2"
    spec_ref: "W8"
  - id: BR8.2
    statement: "After 'Same again' the Cart tab opens with one notice."
    category: policy
    applies_to: SameAgainButton
    trigger: "The tap finishing"
    logic: "Open the Cart tab with a notice of what was added and what was skipped. IF every item was skipped THEN nothing is added and the notice says why."
    violation: "Not applicable."
    source: "AC16.1.3"
    spec_ref: "W8"
  - id: BR9.1
    statement: "While a Chef's special is live its card shows the name, special price, stock left and a countdown, and it can be added like an item."
    category: policy
    applies_to: SpecialCard
    trigger: "A live special"
    logic: "Show the card above the category pills with 'Ends in mm:ss' and '<n> left'. 'Add' adds a special line (through the options sheet when the item has options), limited to the stock left."
    violation: "Not applicable."
    source: "AC11.1.2"
    spec_ref: "W3"
  - id: BR9.2
    statement: "The special's card disappears the moment it ends, sells out or runs out of time."
    category: policy
    applies_to: SpecialCard
    trigger: "A SPECIAL_CHANGED event with no special, or the countdown reaching zero"
    logic: "Remove the card at once. A countdown that reaches zero removes the card without waiting for the server."
    violation: "Not applicable."
    source: "AC11.1.3"
    spec_ref: "W3"
  - id: BR10.1
    statement: "The orders route can return the dishes of the table's last closed visit."
    category: policy
    applies_to: ApiRoutes
    trigger: "GET orders with visit=last_closed"
    logic: "Return the same body as visit=current for the table's most recently closed visit, or an empty list when the table was never closed. visit=current and v1's behaviour do not change; the route stays open to every diner. (From the answer to Q1.)"
    violation: "An unknown visit value answers an empty list, as v1 does."
    source: "AC18.1.1, Functional Design Q1"
    spec_ref: "What U6 Changes, W9"
```

## Rules Summary (derived)

| Group | Rules | What they decide |
|---|---|---|
| BR1 Cart and options | BR1.1 to BR1.6 | Line identity, price preview, required choices, cart refresh, checks before sending, dropped lines |
| BR2 Allergies | BR2.1 to BR2.3 | Marks, the warning before ordering, the saved list |
| BR3 Wait time and tracker | BR3.1 to BR3.5 | Estimate label, live reading, the wait text, the bar, Cancelled |
| BR4 Ready banner | BR4.1 to BR4.2 | Once per event, sound and vibration, dismiss and mute |
| BR5 Calls | BR5.1 to BR5.3 | One request per kind, the response line, cleared at close |
| BR6 Ratings | BR6.1 to BR6.2 | One rating per dish and the Done lock, the dishes of the closed visit |
| BR7 Design and Settings | BR7.1 to BR7.2 | Design system and mockup match, the theme control |
| BR8 Same again | BR8.1 to BR8.2 | What is re-added and skipped, the Cart tab and notice |
| BR9 Chef's special | BR9.1 to BR9.2 | The card and its live removal |
| BR10 Server | BR10.1 | The one additive route option |

## Assumptions & Open Questions

- The notes on the screen choices I made myself (the special line in "Same again", the special falling back to the regular price, the ready banner staying until dismissed, thumbs unrated after a reload, the countdown using the device clock) are listed in `functional-spec.md`.
