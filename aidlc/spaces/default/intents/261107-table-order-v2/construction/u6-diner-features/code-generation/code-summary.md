# Code Summary: u6-diner-features (Bolt 6)

Built in the worktree `.aidlc/worktrees/bolt-c49ff7e2_u6-diner-features`, from `main` with v1 and U5. No package was added; `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `playwright*.ts`, `tsconfig.json` and `src/server/db.ts` are untouched.

## What was built

Everything new the diner sees and does: options on dishes ("Make it yours" sheet), allergy marks and the warning before ordering, the estimated wait, the order tracker with the wait text and "Running late", the ready banner, the Settings sheet (allergies, theme, sound), "Same again", the call card (Call the waiter, Ask for the bill), the Chef's special card, and rating a meal after Close table.

### Files (worktree-relative)

Server (the one additive change, BR10.1):
- `src/server/repositories/orderRepo.ts`: `getOrdersOfLastClosedVisit(tableId)` beside the existing order reads.
- `src/server/routes/orders.ts`: `GET /api/tables/{id}/orders?visit=last_closed`. `visit=current`, a missing visit and an unknown visit behave as before.

Client, new modules (each starts with a comment naming the rule ids it implements):
- `src/client/diner/features/cartModel.ts`: the cart line model and the cart refresh (BR1.1, BR1.2, BR1.4; D1 to D3).
- `.../orderSend.ts`: order lines with option ids and special id, dropped-line reasons, `EMPTY_ORDER` and `INVALID_OPTIONS` (BR1.5, BR1.6).
- `.../api.ts`: the fetch wrappers for U5's routes (`ApiError` with status and code).
- `.../menuTypes.ts`, `.../liveHelpers.ts` (events seen once, preference changes), `.../cartNotice.ts` (a refresh notice that waits for the Cart), `.../Portal.tsx`, `.../features.css`.
- `options/` (`OptionsSheet.tsx`, `useOptionChoice.ts`, `index.tsx`), `allergies/` (`allergyLogic.ts`, `index.tsx`), `estimate/` (`useEstimate.ts`, `index.tsx`), `tracker/index.tsx`, `ready-banner/index.tsx`, `same-again/` (`buildSameAgain.ts`, `index.tsx`), `help-card/` (`useCalls.ts`, `index.tsx`), `special-card/` (`useCurrentSpecial.ts`, `index.tsx`), `rating/` (`useRatings.ts`, `index.tsx`), `settings/index.tsx`.

Client, edited (diner side only):
- `src/client/hooks/useCart.ts`: the line model; v1 signatures kept (`addItem` takes an optional fifth argument), `refreshPrices` kept as a wrapper, new `refreshCart`.
- `src/client/screens/diner/MenuScreen.tsx`, `CartScreen.tsx`, `MyOrdersScreen.tsx`, `src/client/views/TableView.tsx`, `src/client/components/diner/TableClosedTakeover.tsx` (it now takes children, so Rate your meal sits under the closed message).

Tests: `src/server/__tests__/u6/`, `src/client/diner/features/__tests__/`, `src/client/hooks/__tests__/useCartLines.test.ts`, `src/client/screens/diner/__tests__/u6Screens.test.tsx`, `src/client/views/__tests__/TableViewU6.test.tsx`, `e2e/u6-diner-features/diner-features.spec.ts`, `e2e/u6-diner-features/mockup-match.spec.ts`.

## Decisions where the design left the choice open

- **The mount points stay, and are used as blocks** (special card, estimate, call card, tracker, ready banner, Settings, thumbs). Where a feature changes an existing control (the "+ Add" button, the cart lines, Place order, an item card's marks) the screen calls into the feature folder. The tracker and "Same again" mount once per order card and decide for themselves whether to show.
- **Cart storage keeps `cart:table:<id>`.** A cart saved by v1 loads (its lines become plain lines); a fresh add of the same plain item joins that line. A saved line is rewritten in the new shape the next time the cart is saved.
- **A change to the cart is saved at the moment it is made** (see the bugs list), from a ref holding the newest cart.
- **A refresh that happens while the Cart is closed** (a live menu change on the Menu) leaves its notice for the Cart (`cartNotice.ts`), so the Cart still says what changed.
- **Sheets are rendered on the page body** (`Portal.tsx`): inside the frosted header or an animated screen, a "fixed" sheet is measured from its parent.
- **Ready banner id:** an alert fires once for `ORDER_STATUS_CHANGED:<order>:Completed` and is given no time, so no device clock is compared with the server's. The server sends no event id the browser hook keeps, so the order number and status are the event's identity.
- **The Chef's special card** takes the item's picture and description from the menu the Menu already holds; the countdown is amber, red in the last two minutes.
- **`visit=last_closed` for a table number that does not exist** answers `{ "orders": [] }`, as `visit=current` does in v1; the 404 `UNKNOWN_TABLE` is for an id that is not a table number (also as in v1). The plan's test line "a table that does not exist answers 404 as v1 does" is tested with `abc`.

## The one U5 server file edited, and U5 files edited on the diner side

- `src/server/routes/orders.ts` and `src/server/repositories/orderRepo.ts` (the read function), for the route option. Tests: `src/server/__tests__/u6/lastClosedOrders.test.ts` (7 tests).
- Diner-side files U5 had placed: `TableView.tsx`, `useCart.ts`, `TableClosedTakeover.tsx` (named in the plan's "Touches"; the last takes children), and the feature folders U5 left as placeholders (`registry.ts` is not edited).

## Test summary

| Area | New tests |
|---|---|
| Orders route option | 7 (6 for the route, 1 checking that U6 changes no table: the tables the route reads keep their columns) |
| Cart model and `useCart` lines | 21 + 7 |
| Options (hook and sheet) | 14 |
| Allergies | 12 |
| "Same again" | 15 |
| Order sending and client calls | 28 |
| Estimate, tracker, call card, special card | 27 |
| Rate your meal, ready banner, Settings | 23 |
| Screens (Menu, Cart, My orders) | 31 |
| Diner page (TableView) | 4 |
| Browser flows (`diner-features.spec.ts`) | 21 |
| Mockup match (`mockup-match.spec.ts`, 6 screens x 2 themes) | 12 |

Baseline before any change (Step 2): `npx vitest run src/server src/client` 887 passed. After the build and the review fixes: `npm test` 1083 passed, 0 failed (coverage run; no threshold exists and none was added or lowered). Browser tests: `E2E_PORT=4100`, 118 passed, 0 failed, 0 flaky (the U6 specs 35, v1 and U5 and Build and Test specs 83). The table above counts the tests of the first build; the review fixes add 8 unit tests and 2 browser tests (see "Review findings fixed").

Commands run: `npx vitest run src/server/__tests__/u6 --coverage.enabled=false`; `npx vitest run src/server src/client --coverage.enabled=false`; `E2E_PORT=4100 npx playwright test e2e/u6-diner-features --project=chromium`; `E2E_PORT=4100 npx playwright test e2e/u1-walking-skeleton e2e/u2-diner-screens e2e/u3-kitchen-board e2e/u4-bill-and-close e2e/u5-foundation e2e/build-and-test`; `npx tsc --noEmit` (clean); `npm run build`; and the approved check `aidlc engine swarm check u6-diner-features --show-output` (`"converged":true`).

Tests not run here: Chrome and WebKit (the cross-browser config) and the keyboard-only journey of the whole app are Build and Test's. The two U6 keyboard flows (the options sheet and the Settings sheet: focus inside, Escape, focus back) are in `diner-features.spec.ts` (Chromium).

## v1 tests changed

- `src/client/screens/diner/__tests__/MyOrdersScreen.test.tsx`, 5 tests (`re-fetches orders on ORDER_STATUS_CHANGED SSE event`, `regression: a cancel refused because staff already started the order says so`, `regression: a network failure while cancelling shows a clear error in that order's card`, `the cancel error goes away when the diner tries again`, `shows cancel button for Pending orders and completes cancel flow`): the call card now reads the table's calls when My orders opens, and these tests hand out their answers one request after another, so the new request took an answer meant for the next one. A `callsAware` wrapper answers the calls request on its own; nothing else about the tests changed.
- `src/client/views/__tests__/TableView.test.tsx`, `a line added while the first answer is on its way is kept; only the lines that were there before go`: the stored cart is compared with `toMatchObject` and one more check, because a v1-shaped line is written back in the new line shape (it carries `lineId` and `optionChoices` besides v1's fields).
- `src/client/diner/__tests__/features.test.tsx` (U5): the "placeholder renders nothing" test now covers the folders that still show nothing while they have nothing to show; the call card and the Settings gear are always on screen, so a new test checks that they show their controls.
- `e2e/u5-foundation/mockup-match.spec.ts` (U5), `diner-menu` and `diner-cart` in both themes (three places): the Classic Burger now has options, so "+ Add" opens the sheet; the test presses "Add to cart" in it (no choice is required in the seed) and carries on.

Nothing else in v1's or U5's tests changed. The seeded Classic Burger and Margherita Pizza are the only dishes with options, and no other v1 test adds them with "+ Add".

## Bugs found by the tests and fixed

1. **The call card could go back to "Call the waiter" after a press.** The read the card makes when it opens could answer after the press and overwrite "Request sent" with the old state. Fixed in `src/client/diner/features/help-card/useCalls.ts` (the `version` counter, lines 35, 41, 61 and 65): a read that started before a press is ignored. Regression test: `regression: a calls read that started before the press cannot undo "Request sent" when it answers after the press` in `src/client/diner/features/__tests__/liveFeatures.test.tsx` (checked to fail without the fix).
2. **"Same again" opened an empty Cart.** `addItem` saved the cart inside a state updater that React runs later, and the Cart tab opening in the same moment removed the screen that had queued the updates, so nothing was saved. Fixed in `src/client/hooks/useCart.ts` (`itemsRef` and `setItems`, lines 167 to 170, and `addItem`, `removeItem`, `updateQuantity`): every change is computed from the newest cart and saved at once. Regression test: `regression: "Same again" on My orders opens the Cart with one notice and the items it added` in `src/client/views/__tests__/TableViewU6.test.tsx` (it failed before the fix).
3. **The Settings sheet could not be used in the browser.** The gear sits in the page header, which has a frosted-glass background; inside it a "fixed" sheet was measured from the header, came out header-high and its chips could not be clicked. Fixed by showing the three sheets on the page body: `src/client/diner/features/Portal.tsx`, used in `settings/index.tsx` (lines 20 and 78), `options/OptionsSheet.tsx` (52 and 110) and `allergies/index.tsx` (63 and 89). Regression tests: `regression: the sheet is put on the page body, not inside the frosted header the gear sits in` in `src/client/diner/features/__tests__/ratingBannerSettings.test.tsx` (checked to fail without the fix), and flows 3 and 12 of `diner-features.spec.ts`, which timed out before the fix.

## Review findings fixed

Updated counts after these fixes: `npm test` 1083 passed, 0 failed (8 more than before); browser tests with `E2E_PORT=4100` 118 passed, 0 failed, 0 flaky (2 more); `aidlc engine swarm check u6-diner-features --show-output` says `"converged":true`. `npx tsc --noEmit` is clean. No v1 or U5 test changed for these fixes, and `components.css` (U5) is untouched. Every regression test below was run with its fix taken out and failed, then the fix was put back.

1. **Major, touch areas under 44 px.** The thumbs, Mute, Dismiss, Call the waiter, Ask for the bill, Same again and the allergy chips were 32 to 36 px. Fixed in U6's own stylesheet `src/client/diner/features/features.css` (rule `.btn.u6-touch, .chip.u6-touch`, 44 px minimum height and width from `--touch`); the class is added to each control in `rating/index.tsx`, `ready-banner/index.tsx` (Mute and Dismiss), `help-card/index.tsx`, `same-again/index.tsx` and `settings/index.tsx` (chips). The controls are a little taller; nothing else about them changed. Tests: `regression: U6 controls reach a 44 px touch area` (2 tests, `src/client/diner/features/__tests__/touchAreas.test.tsx`: the class on every control, the rule in U6's stylesheet, U5's stylesheet untouched) and `18. regression: every U6 control has a touch area of at least 44 x 44 px (dark)` and `(light)` in `e2e/u6-diner-features/diner-features.spec.ts`, which measure the real box of every one of those controls (all nine chips, both thumbs of each dish).
2. **Minor, cart with browser storage blocked.** `refreshCart` and `removeLines` read the cart back from storage, so they did nothing when storage threw, and "Same again" could open an empty Cart. Fixed in `src/client/hooks/useCart.ts`: a per-table in-memory copy (`memoryCarts`, line 116) is written by every save and read when storage cannot be read (`loadItems`, lines 118 to 133); storage writes are best-effort and the `cart-updated` notice is sent whether or not storage took the write (`saveItems`, lines 135 to 148), so every hook instance sees the same cart. Storage that works stays the source of truth, as before. Tests, in `src/client/hooks/__tests__/useCartLines.test.ts` with storage that throws: `regression: with browser storage blocked the cart works from the in-memory copy > refreshCart still removes and reprices lines` and `> removeLines still removes, and another hook instance (a screen opened next) sees the cart`.
3. **Minor, Place order not guarded while the menu loads.** Fixed in `src/client/screens/diner/CartScreen.tsx`: `handlePlaceClick` (lines 95 to 121) ignores a tap while the check runs, while a warning or the confirm dialog is open, and the button is disabled while the check runs (`checking`, `checkingUi`, lines 53 to 54 and 429). Test: `regression: while the menu is still loading, Place order is disabled and a second tap does nothing (one check, one dialog)` in `src/client/screens/diner/__tests__/u6Screens.test.tsx` (slow menu; one warning, one extra menu read, a tap with the dialog open does nothing).
4. **Minor, call card stuck hidden.** Fixed in `src/client/diner/features/help-card/useCalls.ts` (the live-event handler, lines 49 to 66): `TABLE_CLOSED` hides the card and puts both buttons back to ready; `ORDER_PLACED`, `SERVICE_CALL_OPENED` and `SERVICE_CALL_RESPONDED` mean the table has an open visit again, so the card is shown and its requests read again. Other events do not bring it back. Tests in `src/client/diner/features/__tests__/liveFeatures.test.tsx`: `regression: the card comes back when an order is placed after a 409 NO_OPEN_VISIT hid it`, `regression: after the table is closed the card is hidden, and a new visit (an order placed) shows it again with both buttons ready`, and `the card stays hidden while there is no open visit: events that are not about a visit do not bring it back`.

No new source paths were written by these fixes beyond files already listed in `source-manifest.json` (the new test file `touchAreas.test.tsx` sits in the already listed `src/client/diner/features/__tests__/`).

## Mockup match: pairs looked at and differences accepted

All 14 pairs in `test-results/mockup-match/u6-diner-features/` were looked at (6 screens in dark and light, plus the allergy warning as its own pair). Fixed after looking: the close button of the two sheets now sits in the title row as in the mockups, and the special card shows the dish's picture and description and an amber countdown. Accepted differences (also attached to each test as annotations):

- The mockup's special is a Lobster Linguine; the seed menu has no such dish, so the built special is on the House Salad at the same price and stock. Sample dish text in the Menu, Cart and My orders mockups is not compared.
- The ready banner says "Your order #n is ready" (the functional design, W5 and BR4.1); the mockup says "Order #9 is ready". The conductor may want to confirm which wording the team wants.
- A line reads "1× Classic Burger" (v1's format, kept); the mockup writes "1 × Classic Burger".
- Table closed keeps v1's "This table was closed" / "Thanks for visiting!" (v1 tests check them); Rate your meal below it is compared.
- The seed's Size group is not required (a U5 deviation); the options mockup is compared with a menu answer in which it is.
- The estimate number is the live one ("about 14 min" in the mockup).
- Parts other Units own and left out: the page header, tab bar, category pills and card layout (U5, compared in `e2e/u5-foundation`); no diner mockup holds anything U7 owns.
- A guidance line ("Marks for dairy are guidance, not a promise...") shows above the category pills while an allergy is set (W3 step 2); the mockup does not show it.

## Deviations and things to know

- None from the plan's steps. The plan's "Step 3" is a record only: the tables the route reads keep their columns (a test in `lastClosedOrders.test.ts`).
- `diner-features.spec.ts` flow 2 gives the page a menu answer in which the Size group is required (the seed's is not and there is no route to change it until U7's menu management).
- The estimate test (flow 15) reads the new value from the server before comparing, because the estimate is never below 1 and the earlier flows leave the average near 0.
- Port 3000 was never used; every browser run used `E2E_PORT=4100` with an in-memory database.
