# Interaction Specification: Table Order v2

How each new or changed screen behaves. It builds on `mockups.md`, the stories (`inception/user-stories/stories.md`) and the requirements (`inception/requirements-analysis/requirements.md`). Component names are the ones in the design system (`mockups/design-system.css`).

## Global Behaviour

| Topic | Behaviour | Requirement |
|---|---|---|
| Theme | The app follows the device (light or dark). The Settings sheet (diner) and the header (staff) offer Follow device, Light and Dark. The choice is saved in that browser; Follow device removes the saved choice. Switching changes colours at once with no flash. | FR2.1, FR2.3 |
| Motion | The tracker step change, the call pulse, the countdown tick, banners sliding in and the theme change all stop when the device asks for reduced motion. State still changes; only the movement is removed. | NFR3 |
| Live updates | New events reach every open screen within 2 seconds. After a reconnect each screen reloads its data, and no banner or sound repeats for events that already happened. | NFR1, NFR7, FR4.3 |
| Sound and vibration | Start only after the person has tapped something on the page. A mute control is always in reach; muted still shows the banner. Vibration is a short buzz where the device supports it. | FR4.4 |
| Touch and keyboard | Every control is at least 44 px and works by keyboard; focus is always visible; a sheet traps focus and Escape closes it. | NFR3 |
| Colour is never alone | Status words, "Slow", "Late", "⚠ Contains dairy", "Needs the bill" always appear with their colour. | FR15.3, FR2.4 |

## Diner

### Menu
- A Chef's special card shows above the category pills while a special is live: its name, special price, "<n> left" and a countdown "Ends in mm:ss". It is added like any item. When the stock reaches 0 or the time runs out the card is removed live. (FR11.2, FR11.3)
- An item with an allergen the diner set shows "⚠ Contains <allergen>" and a red border; its "+ Add" still works, and the warning comes at Place order. An item with no allergen information shows "Allergens not set", never a safe mark. (FR10.2, FR10.3)
- An item with options shows a "Make it yours" badge. "+ Add" opens the options sheet for it; an item with no options adds straight away as in v1. (FR8.2)
- Sold-out and hidden items behave as in v1: sold out shows "Sold out" and cannot be added; hidden items are not shown. A live menu change (price, name, hidden) updates the card in place. (FR6.3)

### Make it yours sheet
- Three kinds of group: choose one (radio, may be required), choose any (checkboxes) and leave out (checkboxes). Each choice shows its price change, for example "+$3.00" or "+$0.00".
- "Add to cart" stays disabled until every required group is chosen, and the first missing group is named. The live line price updates with every choice. The same item with different options is a separate cart line.

### Cart
- Each line lists its chosen options under the item name. Quantity changes as in v1 (1 to 20 per line).
- The estimate banner shows "Estimated wait: about <n> min", always labelled "Estimate", and shows "Estimate" with the starting value when no order has completed today. (FR9.2, FR9.4)
- Place order with an unsafe item opens the allergy warning first, naming the items; "Place order anyway" continues, "Back to cart" returns. The order cannot finish without it. (FR10.4)
- If an item or option changed after it was added, the cart refreshes with the notice v1 already shows. (FR6.6, FR8.6)

### My orders
- The ready banner appears when an order becomes Completed, with vibration and sound unless muted, and is dismissible. It does not return after a reload or reconnect. (FR4.1, FR4.3)
- Need something? card: "Call the waiter" and "Ask for the bill". Pressing one sets an open request; pressing it again does nothing new. When staff respond the line "Help is on the way." shows. Both buttons are independent. (FR17.1, FR17.3, FR17.4)
- Each open order shows the three-step tracker and the estimate "About <n> min left". When the order has waited longer than its estimate at placement it shows "Running late" instead of a time. A Cancelled order shows "Cancelled" and no bar. (FR9.3, FR14.1 to FR14.4)
- A past order shows "Same again". It adds the same items and options to the cart at current prices, skips anything sold out or hidden with a notice, never goes above 20 per line, then opens the Cart tab. (FR16.1 to FR16.3)
- "Cancel order" works as in v1 for a Pending order only.

### Settings sheet
- My allergies: nine chips (gluten, dairy, eggs, peanuts, tree nuts, fish, shellfish, soy, sesame), multi-select, saved in the browser. Theme: Follow device, Light, Dark. Sound alerts: On or Muted. (FR10.1, FR2.3, FR4.4)

### Table closed and Rate your meal
- After Close table the full-screen "Table closed" message shows as in v1, with a list of each dish from that visit and thumbs up and down. One rating per dish; tapping the other thumb changes it until Done is pressed; after Done a rating cannot be changed. (FR18.1, FR18.2)

## Staff

### PIN
- Any staff address with no staff session shows only the PIN screen. A wrong PIN clears the digits and says "That PIN is not right" with the tries left; after 5 wrong tries the server refuses for 60 seconds and the screen says "Too many tries". A correct PIN opens the page that was asked for. "Sign out" returns to the PIN screen. (FR3.1 to FR3.5)

### Navigation
- At 1024 px and wider a side navigation lists Kitchen Board, Floor map, Menu management, Chef's special, Past visits and sales, QR codes and Sign out. Below 1024 px it becomes a top bar with a menu button that opens the same list as a sheet. The current page is marked with `aria-current="page"`.

### Kitchen Board
- v1's cards, buttons (Start preparing, Complete, Cancel with its confirm step) and rules stay. A new order raises a banner "New order #<n> from Table <n>" with a short sound unless muted; the Sound on / Muted switch is in the header. (FR4.2)
- Station tabs: All stations (v1's board) and one tab per station. On a station tab each ticket shows only that station's lines; "<Station> done" marks that part. The order becomes Completed when every station that has lines in it is done. On All stations, Complete finishes every remaining part at once. (FR13.2 to FR13.5)
- Ticket timers count from the placed time: green under 8 minutes, amber and "Slow" from 8, red and "Late" from 15; they stop when the order is Completed or Cancelled and are not reset by a reload. (FR15)
- A table that has called shows a pulsing card with "Calling the waiter" or "Asking for the bill" until staff press Respond; both can be open at once. (FR17.2)

### Table Bill and Close table
- As v1: the bill of the open visit, the combined total and Close table (only when no order is Pending or Preparing; otherwise a note names the blocking orders). Option lines show under their item. Closing clears open calls. (FR17.5, FR8.3)

### Floor map
- Ten tables from the server's table list. A table shows its state as a word and a colour: Empty, Browsing (a diner screen is open and nothing ordered), Waiting (an order is Pending or Preparing), Eating (every order Completed) and Needs the bill. When two apply, Needs the bill wins, then Waiting, then Eating, then Browsing, then Empty. Selecting a table opens its bill. (FR12)

### Menu management
- A list by category with each item's station, price and Edit; Hide and Show toggle visibility; categories can be added, renamed, reordered (up and down) and hidden. The item form has name, description, price, image (emoji or web address), category, station, allergens and option groups. Save checks every field on the server; an invalid save names the field, keeps everything typed and shows the message beside the field. Saved changes reach open menus live. (FR6, FR8.5, FR10.2, FR13.1)

### Chef's special
- One live special at a time with its countdown and stock; "End special now" removes it at once. The launch form needs an item, a price, a stock of 1 to 999 and a run time in minutes; invalid values name the field. Launching a new special ends the current one. (FR11)

### Past visits and sales
- One card per day, newest first, with total sales, visits, orders, average time to Completed ("No completed orders" when none), best sellers by quantity (ties by item name) and, for today, best and worst rated dishes with their rating counts. Days run midnight to midnight in the server's local time. An empty list says so. (FR5, FR18.3, FR18.4)

### QR codes
- A code and label for every table, built from the address the page was opened on followed by `/table/<number>`. The Print button prints only the codes. A note explains that a phone needs the restaurant's network address, not "localhost". (FR7)

## States for the New Screens

| Screen | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Menu management | A skeleton list | "No menu items yet. Add your first item." | "The menu could not be loaded. Try again." with a Retry button | A save that fails keeps the form and shows the field message |
| Floor map | Table cards as skeletons | Never empty (tables always exist) | "The tables could not be loaded. Try again." | A reconnecting banner after 3 seconds of no live connection, as v1 |
| Past visits and sales | A skeleton card | "No closed visits yet." | "Sales could not be loaded. Try again." | A day with no completed orders shows "No completed orders" |
| Chef's special | A skeleton card | "No special is live." | The form shows the server's message beside the field | A special that sells out while the page is open switches to "No special is live." |
| QR codes | Skeleton cards | Never empty | "The table list could not be loaded. Try again." | None |
| Kitchen Board stations | v1's loading view | "No open orders for this station right now." | v1's error view | A reconnecting banner, as v1 |
| Staff PIN | None | None | "That PIN is not right"; "Too many tries" | None |

## Responsive Behaviour

| Width | Diner | Staff |
|---|---|---|
| Phone, 360 to 520 px | One column, bottom tab bar, sheets from the bottom | Top bar with menu button; board cards one per row; tables scroll sideways |
| Tablet, 768 to 1023 px | Centred 520 px column | Top bar with menu button; board two or three cards per row |
| Desktop, 1024 px and wider | Centred 520 px column | Side navigation; board fills the width in columns of at least 260 px; floor map five tables per row |
