# Business Rules — U8 `u8-tv-foundation`

These rules come from the requirements (`inception/requirements-analysis/requirements.md`), the stories mapped to U8 in `inception/units-generation/unit-of-work-story-map.md`, the components in `inception/domain-design/components.md` and the contracts in `inception/contract-design/contract-summary.md`.

They also settle the review findings the team accepted earlier:
- Domain Design R-01 to R-06.
- Units Generation R-01, R-03 and R-05.
- Contract Design R-01 to R-06.

```yaml
rules:
  # BR1 — the takings setting
  - id: BR1.1
    statement: Takings are hidden unless a staff member has turned them on.
    category: policy
    applies_to: TvSetting
    trigger: any read of the setting
    logic: IF no tv_settings row exists THEN show_takings is false; ELSE show_takings is the stored value. The value survives a server restart.
    violation: n/a (read rule)
    source: FR6.1, NFR5
  - id: BR1.2
    statement: Only a signed-in staff member can change the setting, and only to true or false.
    category: authorization
    applies_to: PUT /api/staff/tv/settings
    trigger: change request
    logic: IF no staff session THEN refuse 401 UNAUTHORIZED. IF the body is not an object with exactly one field show_takings holding a boolean THEN refuse 400 INVALID_REQUEST. The setting stays as it was.
    violation: 401 or 400 in the error envelope; nothing saved, no event
    source: FR6.2, NFR4
  - id: BR1.3
    statement: A change is saved first and then announced, with the new value.
    category: policy
    applies_to: PUT /api/staff/tv/settings
    trigger: valid change request
    logic: IF the new value differs from the current one THEN save it with updated_at = now, then publish TV_SETTINGS_CHANGED { show_takings, updated_at } on the staff channel. IF it is the same THEN save nothing, publish nothing, and answer 200 with the current setting and its unchanged updated_at.
    violation: a failed save answers 500 INTERNAL_ERROR, is logged, and publishes nothing
    source: FR6.4
  - id: BR1.4
    statement: The setting's table is added without touching existing data.
    category: constraint
    applies_to: database upgrade
    trigger: server start
    logic: A new named upgrade step 'tv-settings' creates tv_settings IF it does not exist. It inserts no row, so upgraded v2 databases read as hidden.
    violation: an upgrade failure stops the server start with a logged error (fail fast)
    source: FR6.1, NFR5, NFR8

  # BR2 — open orders and waits
  - id: BR2.1
    statement: The TV lists every open order, whatever day it was placed, oldest first.
    category: calculation
    applies_to: TvSummary.orders
    trigger: summary read
    logic: Take every order whose status is Pending or Preparing, across all tables and visits. Order by placed_at (instant, read with the shared stored-time reader) ascending, then by order_number ascending.
    violation: n/a
    source: FR2.1, FR2.6
  - id: BR2.2
    statement: An order's size is its number of portions.
    category: calculation
    applies_to: OpenOrderView.portions
    trigger: summary read
    logic: portions = sum of quantity over the order's lines. An order with no lines has 0.
    violation: n/a
    source: FR2.2
  - id: BR2.3
    statement: Minutes waited are counted on the server's clock.
    category: calculation
    applies_to: wait shown for an order and the oldest wait
    trigger: render and every recount
    logic: minutes = floor((serverNow − placed_at) / 60000), never below 0. serverNow = server_time from the last summary + time elapsed since it arrived.
    violation: n/a
    source: FR2.2, FR7.3
  - id: BR2.4
    statement: Waits are labelled Slow from 8 minutes and Late from 15 minutes.
    category: calculation
    applies_to: wait label
    trigger: render and every recount
    logic: IF minutes < 8 THEN no label; IF 8 ≤ minutes ≤ 14 THEN "Slow"; IF minutes ≥ 15 THEN "Late". The label is shown as a word, not by colour alone.
    violation: n/a
    source: FR2.3, NFR7
  - id: BR2.5
    statement: The oldest wait is the wait of the first listed order.
    category: calculation
    applies_to: oldest wait figure
    trigger: render
    logic: IF the orders list is empty THEN show "No open orders"; ELSE show BR2.3's minutes for its first order.
    violation: n/a
    source: FR2.4
  - id: BR2.6
    statement: An empty list says so in words.
    category: policy
    applies_to: orders list on the TV page
    trigger: render
    logic: IF no open order THEN the list reads "No open orders".
    violation: n/a
    source: FR2.6

  # BR3 — money
  - id: BR3.1
    statement: Today's takings are exactly the Sales page's total for today.
    category: calculation
    applies_to: TakingsView.closed_cents
    trigger: summary read while takings are shown
    logic: closed_cents = closedDayTakingsCents(today), the shared rule the Sales page also uses. It sums quantity × unit_price_cents (frozen price) over lines of non-cancelled orders of visits closed on that server-local day.
    violation: n/a
    source: FR3.1, AC3.1.2
  - id: BR3.2
    statement: Money on open tables is the sum of the live bills of open visits.
    category: calculation
    applies_to: TakingsView.open_cents
    trigger: summary read while takings are shown
    logic: open_cents = sum over visits with closed_at null of the line totals of their non-cancelled orders, with the same line rule as buildBill.
    violation: n/a
    source: FR3.2
  - id: BR3.3
    statement: While takings are hidden, no amount leaves the server.
    category: authorization
    applies_to: TvSummary
    trigger: summary read
    logic: IF show_takings is false THEN the answer has no takings key and no amount anywhere; the TV shows "Takings hidden" in both places.
    violation: n/a
    source: FR6.3, NFR5
  - id: BR3.4
    statement: A day's closed visits are found without reading all history, and the day rule is the same for both stored time formats.
    category: constraint
    applies_to: closedDayTakingsCents(day), today's order counts and portions
    trigger: summary read and Sales read
    logic: Select only rows whose first 10 characters (their UTC date) fall between the day before and the day after the asked server-local day. This covers both "YYYY-MM-DD HH:MM:SS" and ISO text. Then keep only rows whose parsed instant's server-local day equals the asked day (the existing localDay rule).
    violation: n/a
    source: NFR6, FR3.1
  - id: BR3.5
    statement: Zero is shown as an amount.
    category: policy
    applies_to: takings display
    trigger: render while takings are shown
    logic: Amounts are formatted with the existing staff money format; 0 cents shows as 0.00 with the currency mark, never blank.
    violation: n/a
    source: FR3.3

  # BR4 — busiest table and top dish
  - id: BR4.1
    statement: The busiest table has the most orders placed today.
    category: calculation
    applies_to: BusiestTableView
    trigger: summary read
    logic: Count non-cancelled orders whose placed_at falls on today's server-local day (BR3.4 window), grouped by table, open and closed visits alike. The highest count wins; a tie goes to the lower table_id. IF there are none THEN null and the TV shows "No orders yet".
    violation: n/a
    source: FR4.1, FR4.2, FR4.3
  - id: BR4.2
    statement: The top dish has the most portions ordered today.
    category: calculation
    applies_to: TopDishView
    trigger: summary read
    logic: Sum quantity over lines of non-cancelled orders placed today (BR3.4 window), grouped by item. The highest wins; a tie goes to the name first in alphabetical order (localeCompare, as the Sales page's best sellers). IF there are none THEN null and the TV shows "No dishes yet".
    violation: n/a
    source: FR5.1, FR5.2, FR5.3

  # BR5 — requests
  - id: BR5.1
    statement: Open waiter and bill requests are listed oldest first.
    category: calculation
    applies_to: TvSummary.requests
    trigger: summary read
    logic: Every service call with no responded_at, across all tables, ordered by opened_at ascending.
    violation: n/a
    source: FR9.1

  # BR6 — access and staying signed in
  - id: BR6.1
    statement: The TV wall data and the setting are staff-only.
    category: authorization
    applies_to: every /api/staff/tv/* route and /staff/tv page
    trigger: any request
    logic: The routes are mounted after the existing staff guard in the route registry, so a request with no valid staff session gets 401 UNAUTHORIZED and no data. The page sits under /staff, so the existing PIN gate shows first and returns to /staff/tv after the correct PIN.
    violation: 401; the page shows the PIN screen
    source: FR1.1, FR6.2, NFR4
  - id: BR6.2
    statement: An open TV wall keeps its staff session alive.
    category: policy
    applies_to: GET /api/staff/tv/summary
    trigger: summary read
    logic: The existing staff guard refreshes the session's idle time on every guarded request (its default), so each summary read restarts the 12-hour idle clock.
    violation: n/a
    source: FR8.1
  - id: BR6.3
    statement: A server restart or a closed browser asks for the PIN again.
    category: policy
    applies_to: TV page
    trigger: 401 on any read
    logic: Sessions live in server memory, so after a restart the next read gets 401 and the page shows the PIN screen as every staff page does. This is a known limit: someone enters the PIN once on the TV.
    violation: n/a
    source: FR8.2

  # BR7 — keeping the TV current
  - id: BR7.1
    statement: The TV re-reads the summary whenever something it shows may have changed.
    category: policy
    applies_to: TV page data hook
    trigger: staff-stream events ORDER_PLACED, ORDER_STATUS_CHANGED, STATION_DONE, TABLE_CLOSED, SERVICE_CALL_OPENED, SERVICE_CALL_RESPONDED, TV_SETTINGS_CHANGED, and every stream reconnect
    logic: Request a re-read (BR7.2).
    violation: n/a
    source: FR7.1, FR6.4, NFR3
  - id: BR7.2
    statement: A burst of events causes at most one read in flight and one waiting.
    category: constraint
    applies_to: TV page data hook
    trigger: re-read request
    logic: IF no read is in flight THEN start one. ELSE mark one read as waiting; further requests while one is waiting are dropped. When the in-flight read ends and one is waiting, start it.
    violation: n/a
    source: NFR3, NFR6
  - id: BR7.3
    statement: The TV re-reads at least every 5 minutes, even with no events.
    category: policy
    applies_to: TV page data hook
    trigger: 5 minutes since the last successful read started
    logic: Request a re-read (BR7.2).
    violation: n/a
    source: FR8.1, FR1.3
  - id: BR7.4
    statement: The TV re-reads at the server's midnight.
    category: policy
    applies_to: TV page data hook
    trigger: serverNow (BR2.3) passes midnight of the summary's day
    logic: Request a re-read (BR7.2), so the day's counts and takings restart for the new day.
    violation: n/a
    source: FR3.1, FR4.1, FR5.1
  - id: BR7.5
    statement: A newer read always wins over an older one that answers late.
    category: constraint
    applies_to: TV page data hook
    trigger: read answer
    logic: Each read gets a rising number; an answer whose number is lower than the newest started read is ignored.
    violation: n/a
    source: FR7.1
  - id: BR7.6
    statement: When reads or the live stream fail, the TV keeps its last figures and says so.
    category: policy
    applies_to: TV page
    trigger: stream drop, a read that fails or takes longer than 10 s
    logic: IF a summary has been shown before THEN keep it and show "Reconnecting… last update HH:MM" (the time the last good read arrived), retrying every 10 s. ELSE show "Can't reach the restaurant server. Trying again…" and retry every 10 s. On success, return to "Live".
    violation: n/a
    source: FR7.2
  - id: BR7.7
    statement: Waits count up on their own between reads.
    category: policy
    applies_to: TV page
    trigger: every 15 seconds
    logic: Recompute serverNow and every wait (BR2.3) and label (BR2.4); no read is made.
    violation: n/a
    source: FR7.3

  # BR8 — the switch
  - id: BR8.1
    statement: The switch always shows the setting the server holds.
    category: policy
    applies_to: TvTakingsSwitch
    trigger: page load, every staff-stream reconnect, TV_SETTINGS_CHANGED
    logic: On load and on every reconnect, read GET /api/staff/tv/settings. On TV_SETTINGS_CHANGED, take show_takings from the event. The switch shows On or Off accordingly.
    violation: a failed read leaves the switch at its last known position
    source: FR6.2, FR6.4
  - id: BR8.2
    statement: Flipping the switch saves the new value, and returns the switch to its old position if the save fails.
    category: policy
    applies_to: TvTakingsSwitch
    trigger: click, Space or Enter
    logic: Show the new position at once and send PUT { show_takings }. IF it fails (any non-200, or no answer in 10 s) THEN return the switch to the old position and show the existing "Server did not answer, Try again" message; a 401 shows the PIN screen.
    violation: as stated
    source: FR6.2

  # BR9 — navigation and page
  - id: BR9.1
    statement: The TV wall is a staff page at /staff/tv that fills the screen, opened from a "TV wall" navigation link.
    category: policy
    applies_to: staff page registry and shell
    trigger: navigation
    logic: The registry gains { key 'tv', path 'tv', label 'TV wall', icon '📺', inNav true, fullScreen true }. The shell renders a fullScreen page without the side navigation and without the narrow-screen menu button.
    violation: n/a
    source: FR1.1, FR1.2
  - id: BR9.2
    statement: The takings switch sits directly under the "TV wall" link.
    category: policy
    applies_to: staff navigation
    trigger: render of any staff page with navigation
    logic: The navigation renders the switch row "Show takings on TV" with its On/Off word right after the TV wall link. It is at least 44 px tall and works by keyboard.
    violation: n/a
    source: FR6.2
  - id: BR9.3
    statement: The page route works from any folder.
    category: constraint
    applies_to: server page fallback
    trigger: GET /staff/tv
    logic: Served by the existing SPA fallback, which uses sendFile('index.html', { root: distDir }); U8 adds no new page route on the server.
    violation: n/a
    source: project.md Walking Skeleton

  # BR10 — protecting v1 and v2
  - id: BR10.1
    statement: Moving the Sales rule changes nothing on the Sales page.
    category: constraint
    applies_to: getSales
    trigger: Sales read
    logic: A regression test captures getSales() for a fixed dataset (visits in both time formats, closed today and yesterday, cancelled orders, orders with no lines) before the move. The same test passes unchanged after getSales calls closedDayTakingsCents per day.
    violation: the build stops until the outputs match
    source: NFR8, AC3.1.2
  - id: BR10.2
    statement: Every existing test changed by U8 is listed with its reason.
    category: policy
    applies_to: U8 code summary
    trigger: build
    logic: The expected changes are the route-registry owner type and route count, STAFF_EVENT_NAMES, the upgrade-step list and the navigation entries. Each one is listed under "v1/v2 tests changed" in code-summary.md with its reason. No other v1 or v2 test changes.
    violation: n/a
    source: NFR8
```

## Rules Summary

| Group | Rules | What they settle |
|---|---|---|
| Setting | BR1.1–BR1.4 | Hidden by default, staff-only, saved then announced, no event when the value does not change, additive table |
| Orders and waits | BR2.1–BR2.6 | Open orders of any day, oldest first, portions, server-clock waits, Slow from 8 and Late from 15, empty wording |
| Money | BR3.1–BR3.5 | Same total as the Sales page, money on open tables, no amount sent while hidden, a day filter that handles both time formats, zero shown as an amount |
| Busiest table and top dish | BR4.1–BR4.2 | Today's counts, tie-breaks, empty wording |
| Requests | BR5.1 | Open requests, oldest first |
| Access | BR6.1–BR6.3 | Existing staff guard, the session kept alive, restart as a known limit |
| Keeping current | BR7.1–BR7.7 | Events, burst merging, 5-minute and midnight re-reads, latest answer wins, reconnecting, waits counting up |
| Switch | BR8.1–BR8.2 | Re-read on load and reconnect, revert on a failed save |
| Navigation and page | BR9.1–BR9.3 | Full-screen registry entry, the switch's place, the route works from any folder |
| Protecting v1 and v2 | BR10.1–BR10.2 | Sales regression test, changed tests listed |
