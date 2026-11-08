# Units of Work: Table Order v2

v2 is split into three Units, built as three Bolts: U5, U6 and U7 (v1 used U1 to U4, which are done). The split follows the plan you approved: by domain and audience, with every part that both feature Units use placed in the foundation, so U6 and U7 never need each other. There is no U8: once the shared parts sit in U5, nothing needs both U6 and U7. It is built from the component catalogue (`inception/domain-design/components.md`), its decisions (`decisions.md`), the requirements (`inception/requirements-analysis/requirements.md`) and the stories (`inception/user-stories/stories.md`). Your answers: U5 gives the new look to all five v1 screens (Q1), and U5 holds every server part that both U6 and U7 use (Q2).

## Units

| Unit ID | Directory | Name | Kind | Complexity |
|---|---|---|---|---|
| U5 | `u5-foundation` | Foundation | service | XL |
| U6 | `u6-diner-features` | Diner features | ui | L |
| U7 | `u7-staff-kitchen-features` | Staff and kitchen features | ui | XL |

## U5: Foundation (`u5-foundation`)

**Description.** v2's walking skeleton: the smallest working integrated slice that every other part builds on. After U5 is signed off the whole v1 app has the new look in both themes behind a Staff PIN, and every new table, route and live event that the feature Units share exists and works.

**Boundaries.** U5 owns everything both U6 and U7 use. It does not build the feature screens.

**Responsibilities and delivers.**
- **New look and Dark mode (US1.1, US2.1):** the design system (tokens in a dark and a light theme, type, spacing, radius, shadows, shared components), applied to all five v1 screens (Menu, Cart, My orders, Kitchen Board, Table Bill and Close table); the theme switch (Follow device, Light, Dark) and its saved choice.
- **Staff PIN (US3.1):** the PIN screen, the server-side staff session, the lockout and the guard on every staff route and the staff live stream; the `by` field is no longer trusted for staff changes.
- **Staff app shell:** the side navigation (top bar and menu button on narrow screens) with a route for every staff page; each page starts as a placeholder that U7 replaces.
- **Database changes (all additive):** new columns and tables for options, allergens, stations, hidden items, the Completed time and estimate on orders, frozen option text and station on order lines, station done marks, Chef's specials, service calls and ratings; a safe, repeatable upgrade step for v1 database files; seed options, allergens and stations on the existing 12 items without changing v1's counts (US19.1).
- **Menu data and read side (US6.1, US8.1, US10.1):** options, allergens, stations and hidden items in the menu the diner reads.
- **Order changes (US8.1, US9.1, US13.1):** placing an order with options, frozen prices, options and station on each line; the Completed time; the wait estimate worked out and recorded at placement; the estimate service.
- **Chef's special engine (US11.1):** the special, its guarded stock update inside the order transaction, its live events.
- **Service calls and ratings engines (US17.1, US18.1):** open, respond and clear calls; record and change ratings; their routes and live events.
- **Live events and shared alerts (US4.1):** the new event types, registered in the browser's event lists; the alert logic (once per event, sound unless muted, vibration, no repeat after reconnect) shared by both feature Units.
- **Keeping v1 safe (US19.1):** v1's tests stay green; any v1 test that a chosen change makes out of date is updated and listed in the Unit's `code-summary.md`.

**Deployment model.** Embedded: the same single server process, the same SQLite file and the same page bundle as v1.

**Implementation notes and constraints.** U5 creates the seams so U6 and U7 do not edit the same lines: one route module per feature registered from a single list, one page file per staff page registered from a single list, and one file per diner feature area. U5 mounts new routes before the page catch-all and serves pages with `res.sendFile('index.html', { root: distDir })`. Every port and the database file come from `PORT`, `E2E_PORT` and `DB_FILE`. The seed's 10 tables, 4 categories and 12 items do not change.

## U6: Diner features (`u6-diner-features`)

**Description.** Everything the diner sees and does that is new, on top of U5.

**Boundaries.** Diner screens only (`/table/:id`). U6 never edits a staff screen, a server component that U7 owns, or a U5 file outside its registered seams.

**Responsibilities and delivers.**
- **Make it yours (US8.1):** the options sheet, options on each cart line, the cart refresh notice when an option changes.
- **Allergy shield (US10.1):** the Settings sheet's allergy chips, the unsafe marks and "Allergens not set" on the Menu, the allergy warning before ordering.
- **Honest wait time (US9.1):** the estimate in the Cart and on each open order, "Running late".
- **Animated order tracker (US14.1):** the three-step bar with its animation and reduced-motion behaviour.
- **Notifications, diner half (US4.1):** the ready banner with sound and vibration.
- **"Same again" (US16.1).**
- **Call the waiter / Ask for the bill, diner half (US17.1):** the card on My orders and its states.
- **Chef's special, diner half (US11.1):** the live card and countdown on the Menu.
- **Rate your meal, diner half (US18.1):** the thumbs on the closed-table screen.
- **Settings sheet (US2.1):** the Settings sheet itself, with the theme and sound controls.

**Deployment model.** Embedded in the same page bundle.

**Implementation notes and constraints.** Uses only v1 and U5. Reads options, allergens, the estimate, specials, calls and ratings through the routes U5 provides.

## U7: Staff and kitchen features (`u7-staff-kitchen-features`)

**Description.** Everything staff and the kitchen see and do that is new, on top of U5.

**Boundaries.** Staff screens only (`/staff/*`), plus the server parts that only staff use. U7 never edits a diner screen or a U5 file outside its registered seams.

**Responsibilities and delivers.**
- **Kitchen stations (US13.1):** the per-station boards, the All stations view, "<Station> done", completing an order when every station is done; the station component's server logic.
- **Kitchen ticket timers (US15.1).**
- **Notifications, staff half (US4.1):** the new-order alert with sound and mute.
- **Call the waiter / Ask for the bill, staff half (US17.1):** the pulsing card on the board and the Respond action.
- **Live floor map (US12.1):** the table list route, the open-connection count per table and the five table states.
- **Menu management (US6.1, plus staff editing for US8.1, US10.1, US13.1):** items, categories, options, allergens and stations, with live changes to open menus and server-side validation.
- **Chef's special, staff half (US11.1):** the launch and end page.
- **Past visits and sales (US5.1, US18.1):** the sales and ratings summary routes and page.
- **QR codes (US7.1).**
- **Option lines on the bill (US8.1):** the bill shows each line's chosen options.

**Deployment model.** Embedded in the same page bundle and server.

**Implementation notes and constraints.** Uses only v1 and U5. Registers its pages and route modules in the seams U5 provides.

## Where the Components Go

| Component | U5 | U6 | U7 |
|---|---|---|---|
| MenuCatalog | data, options, allergens, stations, hidden items, read side | | staff edit routes and validation |
| TableSessions | | | the table list |
| OrderManagement | options, frozen prices and station, Completed time, estimate | | |
| KitchenStations | the `StationDone` table | | all logic and routes |
| ChefSpecials | engine, stock, routes, events | the card | the staff page |
| ServiceCalls | engine, routes, events | the diner card | Respond and the pulse |
| DishRatings | engine, routes, events | the thumbs | the summary |
| StaffAccess | all | | |
| WaitEstimation | all | the display | |
| FloorStatus | | | all |
| SalesReporting | | | all |
| Billing | | | option lines on the bill |
| TableQrCodes | | | all |
| LiveEvents | new event types, client lists | | the open-connection count |
| ApiRoutes | the seams, the guard, the shared routes | | its own route modules |
| ClientPreferences, DesignSystem | all | | |
| Notifications | the shared alert logic | the ready banner | the new-order alert |
| DinerApp | the new look on its screens | its features | |
| StaffApp | the shell, navigation, PIN and the new look on its screens | | its pages |

## Which Unit Builds Which Mockup

The mockup-match tests compare each built screen with its mockup in `inception/refined-mockups/mockups/`. A part that another Unit owns is left out of a Unit's comparison and listed.

| Mockup | U5 | U6 | U7 |
|---|---|---|---|
| `design-system.html` | all | | |
| `staff-pin.html` | all | | |
| `diner-menu.html` | the Menu in the new look | the special card, allergy marks, "Make it yours" badge, Settings icon | |
| `diner-cart.html` | the Cart in the new look | options on lines, estimate, allergy warning | |
| `diner-orders.html` | My orders in the new look | ready banner, tracker, estimate, "Same again", call card | |
| `diner-item-options.html`, `diner-settings.html`, `diner-closed-rate.html` | | all | |
| `staff-board.html` | the Kitchen Board in the new look and the staff shell | | station tabs, timers, new-order alert, options, call pulse |
| `staff-bill.html` | the bill in the new look | | option lines |
| `staff-station.html`, `staff-floor.html`, `staff-menu.html`, `staff-special.html`, `staff-sales.html`, `staff-qr.html` | | | all |

## Assumptions & Open Questions

- Complexity sizes (S, M, L, XL) are relative and rough; Delivery Planning decides what to build first and how long each Bolt may take.
- Which Unit owns each shared file region is a constraint for Contract Design and the code plans: the seams are named in U5's notes above.
- `U8` is not created. If Functional Design finds something that needs both U6 and U7, a U8 is added after they have merged.
