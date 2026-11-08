# Integration fixes: the meeting point of U5, U6 and U7

Done in the main folder after the Bolts were merged. Each finding says what was wrong, what changed, and the tests. Every regression test below was run with its fix taken out and failed, then the fix was put back.

## 1. Major: a live Chef's special survived hiding or selling out its item

**Wrong:** a special stayed live (and its card stayed on the diner's Menu with a "+ Add" that did nothing) after staff hid its item or its category, or sold the item out.

**Changed**
- `src/server/repositories/specialsRepo.ts`: `getCurrentSpecial` now treats a special as not live when its item is hidden, its category is hidden, or the item is sold out. The order path already refused such items before it looked at the special (hidden: `UNKNOWN_ITEM`; sold out: the line is dropped), so an order cannot take one; a test pins that.
- `src/server/menuEvents.ts`: new `watchSpecial(write)`. It publishes `SPECIAL_CHANGED` (the special that is live now, or null) when a write changed which special is live.
- `src/server/routes/staff-menu.ts` (item PATCH, options PUT, category PATCH) and `src/server/routes/menu.ts` (the v1 sold-out route) run their writes through `watchSpecial`.
- `src/client/diner/features/special-card/index.tsx`: no card when the item is not on the diner's menu or is sold out (`itemInfo`).
- `src/client/screens/diner/MenuScreen.tsx`: passes `available` to the card; "+ Add" on the card says "<name> is not available right now." instead of doing nothing if the item is gone by the time it is pressed (a defensive path; the card is already hidden by then, so it has no test of its own).

**Tests (new)**
- `src/server/__tests__/integration/integrationFixes.test.ts`: `regression: hiding the item ends the live special for the diner and publishes SPECIAL_CHANGED with null`; `regression: hiding the item's category does the same, and showing it again brings the special back with an event`; `regression: selling the item out through the v1 sold-out route does the same`; `an options change or a change to another item publishes no SPECIAL_CHANGED`; `an order cannot take such a special: a sold-out item drops the line, a hidden one is refused`.
- `src/client/diner/features/__tests__/integrationFixes.test.tsx`: the four tests of `regression: no Chef's special card, and no dead "+ Add", for an item the diner cannot order (finding 1)`.
- `e2e/u6-diner-features/diner-features.spec.ts`: `19. regression: hiding or selling out the special's item takes the card off an open Menu within 2 seconds, and it returns when the item does`.

## 2. Major: a special with a negative option could make the order unplaceable for good

**Wrong:** the server refuses a whole order when a line's price is below zero, but nothing stopped the combination being set up, and the diner's cart clamped the price to $0.00, never removed the line, and repeated "An option needed attention" for ever.

**Changed**
- (a) `specialsRepo.ts`: `launchSpecial` refuses with 400 `INVALID_REQUEST`, `details.field` `special_price_cents`, when the special price plus the item's cheapest possible options is below zero (new `lowestOptionTotal`, the BR5.4 rule).
- (b) `src/server/routes/u7/menuAdmin.ts`: replacing options is checked against the lowest of the regular price and a live special's price for that item (`lowestPriceWithSpecial`).
- (c) `src/client/diner/features/cartModel.ts`: `computeRefresh` never keeps a below-zero price. A special line falls back to the regular price (named as reset); a line still below zero is removed and named.
- (d) `src/client/diner/features/orderSend.ts` and `src/client/screens/diner/CartScreen.tsx`: for `INVALID_OPTIONS` the result carries the item the server named; when the refresh changed nothing, that line is removed with a notice ("X could not be ordered as chosen, so it was taken out of your cart..."), so the diner is never stuck.

**Tests (new)**
- Server (`integrationFixes.test.ts`): `regression: launching a special whose price plus the cheapest options is below zero is refused on special_price_cents`; `launches when the cheapest possible price is not below zero`; `regression: replacing the options is checked against a live special's price, not only the regular price`; `a special on another item does not change the check`.
- Diner (`src/client/diner/features/__tests__/integrationFixes.test.tsx`): `regression: a price below zero is never clamped and sent (finding 2c)` (4 tests); `regression: the diner can never be stuck in an INVALID_OPTIONS loop (finding 2d)` (3 tests, including the loop itself: refused, line taken out, second try goes through).

## 3. Minor: UNKNOWN_ITEM showed the server's raw text

**Wrong:** an item hidden or removed while the order was on its way gave "Unknown item i-05".

**Changed:** `orderSend.ts` maps 400 `UNKNOWN_ITEM` to a new `unknown_item` result; `CartScreen.tsx` refreshes the cart (the item is removed and named) and says "Something on the menu changed while you were ordering, so your cart was checked again."

**Tests (new):** `regression: UNKNOWN_ITEM is mapped like INVALID_OPTIONS (finding 3)` and `regression: an order refused for an unknown item says what changed in plain words (finding 3)` (both in the diner `integrationFixes.test.tsx`).

## 4. Minor: the item form was not atomic

**Wrong:** the form sent PATCH and then PUT options; a valid combined edit (lower price and drop the negative option) was refused against the old options, and a failing PUT left a half-saved item.

**Changed**
- `menuAdmin.ts`: `PATCH /api/staff/menu/items/{id}` accepts an optional `options` (the groups of the PUT; the `{ "groups": [...] }` form is also accepted). The new price is checked against the NEW options (and a live special), and the fields and options are written in one transaction (all or nothing). `replaceOptions` and the PUT route are unchanged in behaviour (the write moved into `writeOptions`).
- `staff-menu.ts`: still one `publishMenuChange` per edit.
- `src/client/staff/pages/menu/ItemForm.tsx`: an edit is ONE PATCH with the options inside; a new item is still made first and then given its options (it has no id yet).

**Tests (new)** in `integrationFixes.test.ts`: `regression: lowering the price and dropping the negative option in one PATCH is accepted`; `regression: an invalid options array leaves the price (and everything else) unchanged`; `a new price that is below zero against the NEW options is refused and nothing is saved`; `keeps the ids of groups and choices that are listed with their id`; `publishes one MENU_CHANGED for the whole edit`; `a PATCH without options still leaves the options alone, and PUT .../options still works as before`; `is all or nothing even when the write fails half-way (a database error rolls the price back)`.

## 5. Minor: the Sales page (and the Kitchen Board) opened more than one live stream

**Wrong:** every caller of `useStaffSSE` opened its own `/sse/staff`; the Sales page called `useLiveRead` twice, and the Kitchen Board opened a second one while its availability panel was open (the "single shared EventSource" comment was wrong).

**Changed:** `src/client/hooks/useStaffSSE.ts` now keeps ONE EventSource for the page, shared by every caller: opened with the first, closed with the last; each caller still gets its own `events` and `seq` starting from when it mounted, and a late caller is told the stream is already open. This fixes the Sales page, the board with its panel, and any page, and makes the comment true. Pages checked: floor, menu, special, QR (no stream of its own), stations, board, sales: each now opens at most one.

**Tests (new)** `src/client/staff/__tests__/integrationFixes.test.tsx`, `regression: the staff pages share one live stream`: two callers share one stream and it closes with the last; a later caller sees only later events; the Sales page opens one EventSource and one event still reloads both reads; the Floor map, Menu management and Chef's special pages open at most one.

## 6. Note (no code)

The best and worst rated dishes view reloads only on `TABLE_CLOSED` and `ORDER_STATUS_CHANGED`, because a rating has no live event of its own in the contract. This is as designed.

## 7. test-results tracked in git

`git rm --cached -r -q test-results` was run (index only; nothing deleted, nothing committed). `git ls-files test-results` now prints nothing.

## Existing tests changed

- `src/client/staff/pages/menu/__tests__/menu.test.tsx`, `Save sends the whole item in whole cents, then the option groups with their ids kept, then closes and reads again`: an edit is now one PATCH with the options inside, so the test asserts one PATCH, no PUT, and the same option ids and fields in `patch.options` (the old assertions on the PUT body moved to it; nothing weakened).
- Same file, `shows the server's message beside the choice it names (the cheapest-line rule)`: the options error now comes from the PATCH, so the stub answers it there. The assertions are unchanged.
- `src/client/hooks/__tests__/useBoardOrdersU7.test.ts`, `useBoardOrders.test.ts`, `liveHooksV2.test.ts`, `useBill.test.ts`, `useMenuAvailability.test.ts`, `useStaffSSE.test.ts`: `cleanup()` added at the start of each `afterEach` (and imported). These tests rendered hooks and never unmounted them; with one shared stream a hook left mounted by one test kept the stream alive for the next. No assertion changed.

No other existing test changed. `npm test` exit 0; the one run in which `foundation/callsApi.test.ts` (`UNKNOWN_CALL`) failed once did not repeat in four further runs of the file and the suite.
