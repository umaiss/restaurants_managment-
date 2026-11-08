## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261107-table-order-v2/construction/u6-diner-features/functional-design/functional-spec.md > W2 steps 5 and 6; rules.md > BR1.6 | The design says that when every line is dropped, the cart stays and the notice says so, with each reason read from `dropped_lines`. The real order route (`src/server/routes/orders.ts`, `orderRepo.placeOrderAtTable`) does not answer that way. When nothing is kept it throws `EMPTY_ORDER` and answers 400 with no `dropped_lines` at all. U5's BR3.4 says the same. This is exactly the case in AC11.1.4 (two diners, one special left, a one-line cart): the losing diner gets a 400 with no reason, and neither W2 nor the error table covers it. | Add the `400 EMPTY_ORDER` answer to W2, BR1.6 and the API table. On it, refresh the cart (D3), say that nothing could be ordered because items were sold out or the special ran out, keep the cart and keep the placement key. | New |
| R-02 | Minor | functional-spec.md > W8 step 2; rules.md > BR8.1 | "Same again" matches options "by their group and label", but an order line carries only `label` and `price_delta_cents` for each option (`orderRepo.readLines`, `LineOption`). The group is not stored, so a match by group cannot be built. A label that exists in two groups of the same item is ambiguous. | Say that the match is by label within the item's current option groups. State what happens when a label matches in more than one group (skip the line and name it is the safe choice). | New |
| R-03 | Minor | functional-spec.md > D3 and W2 step 1; frontend-components.md > Cart Model | The refresh only resets a special line when the special has ended or run out. A special still live with less stock than the cart quantity is not handled. The server then drops the whole line as SPECIAL_SOLD_OUT, because its stock guard (U5 BR5.3) is all or nothing, even though stock is left. Also, when a special line falls back to the regular price its `lineId` changes and can collide with an existing regular line of the same choices. The merge is not specified. | In D3, cap a special line's quantity to the stock left on every `SPECIAL_CHANGED` event. State that a line which falls back to the regular price merges into an existing line with the same `lineId`, up to 20. | New |
| R-04 | Minor | frontend-components.md > Cart Model; functional-spec.md > D1 | A v1 line is read as having `lineId` equal to its item id. A new line with no choices and no special is built from the item, an empty choice list and no special id, with no stated format. If those two forms differ, a v1 cart line and a fresh add of the same item become two lines. | Define `lineId` so that no choices and no special gives exactly the item id. Add a test that loads a v1-shaped cart and adds the same item. | New |
| R-05 | Minor | functional-spec.md > W2 and W8 | Double-tap behaviour is only given for the call buttons. "Place order" and "Same again" say nothing about in-flight state. A double tap on "Same again" would add the quantities twice. The placement key covers a repeated order send, but the screen should not depend on that. | Disable "Place order" while the request is in flight. Make "Same again" one-shot while it runs, or say that a second tap adds again on purpose. | New |
| R-06 | Minor | functional-spec.md > W5 and D9; src/client/alerts/alertLogic.ts > `AlertGate.shouldFire` | The "not older than the page load" check compares the event's `occurredAt` (the server's `completed_at`) with the device clock at page load. A phone whose clock is ahead of the server can suppress a real ready banner. This is the same clock risk the spec already accepts for the special countdown, but there it is only cosmetic. Here the banner is missed. | State which time is passed as `occurredAt`. Prefer null for events that arrive live after the stream opens, and rely on the seen-id set and on ignoring replayed events after a reconnect. Or record the server time at connect. Note the accepted risk if kept. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261107-table-order-v2/inception/units-generation/unit-of-work.md > U6 Boundaries; functional-spec.md > What U6 Changes | The unit boundary says U6 never edits a U5 file outside its registered seams. The design edits the three diner screens, `TableView`, `useCart` and `src/server/routes/orders.ts`, and records that this differs from contract 7. The conflict risk with U7 is low (U7 is staff-only), but I could not check that U7 leaves `orders.ts` alone. | At the gate, confirm this deviation. Make sure the Delivery Planning and Code Generation plans record that U6 alone owns the `visit=last_closed` edit in `orders.ts`. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| aidlc engine sensor-traceability --stage functional-design --output-path .../u6-diner-features/functional-design/traceability.json | `{"pass":true,"gaps":[],"orphans":[],"missing_from_table":[],"missing_from_upstream_ids":[],"invalid_entries":[],"invalid_targets":[],"findings_count":0}` | Every acceptance criterion of the eleven U6 stories is traced to a rule, with no gaps and no invalid targets. |

**Feasibility checks that held (no finding):**
- `GET /api/tables/{id}/orders` returns each order with `estimate_minutes`, `completed_at`, and lines with `menu_item_id`, `special_id` and `options` (label and price change). That is enough for the tracker, "Same again" and the thumbs list.
- `GET /api/tables/{id}` already returns `last_closed_visit_id`, and `getOrdersByVisit` already exists. The `visit=last_closed` option needs no database change and no new repository function, as the person decided in Q1.
- The orders route accepts `option_ids` and `special_id`. A removed option drops the line as OPTION_UNAVAILABLE rather than failing, which matches D3 and W2 step 6.
- Calls: `openCall` is idempotent per kind. A new request can be made after a response. `NO_OPEN_VISIT` is thrown with no visit. `listCalls` returns an empty list with no open visit. This matches W7.
- `waitDisplay` in `src/shared/wait.ts` and `AlertGate` exist as the design describes.
- Ratings: the route and `saveRatings` match W9, including `RATING_LOCKED` and `VISIT_NOT_CLOSED`.
- The `GET /api/menu` items carry `available`, `allergens` and `options` (groups and choices), so D3 and D5 can be computed on the client.

### Summary

The design traces every U6 acceptance criterion (the sensor passes) and fits the routes and events U5 built. The one real gap is the all-lines-dropped case, which the server answers with `400 EMPTY_ORDER` and no dropped list, and which is the main AC11.1.4 scenario. The other points are small precision fixes the person can have the AI make without changing the design.
