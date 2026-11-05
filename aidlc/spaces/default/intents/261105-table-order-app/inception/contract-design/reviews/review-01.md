**Collaborator:** aidlc-architecture-reviewer-agent

### Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-05
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261105-table-order-app/inception/contract-design/contract-summary.md > Ordering > POST /api/tables/:id/orders > placement_key dedup | The dedup rule says a duplicate placement_key returns `200 OK` with the existing order, but does not specify what happens when the same key is replayed across two different table ids (the client generated one key, then retried against a different path). Left unresolved, U2 and U4 developers may implement different behaviour. | Add one sentence: "A placement_key is scoped to the table it was first accepted on; a retry against a different table_id is treated as a new order." | New |
| R-02 | Minor | aidlc/spaces/default/intents/261105-table-order-app/inception/contract-design/contract-summary.md > Ordering > POST /api/orders/:order_number/transition > by field | The contract says the diner client "is expected to send a `by: 'diner'` field" but this field is not in the request schema, not validated in the error-code list, and not tested in `order_transition.spec`. A developer implementing U2 or U3 cannot determine whether the field is required, optional, or advisory. | Promote `by` to a named request field in the schema (e.g. `{ "to": "Cancelled", "by": "diner" }`), add `FORBIDDEN_TRANSITION` or reuse `ILLEGAL_TRANSITION` as the error code when a diner tries to cancel a Preparing order, and add a test case for it in `order_transition.spec`. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261105-table-order-app/inception/contract-design/contract-summary.md > Billing > GET /api/tables/:id/bill > orders[].subtotal_cents | The bill shape example shows `"subtotal_cents": 2400` on the order object, but the lines already carry `subtotal_cents` per line. It is not clear whether the order-level `subtotal_cents` is the sum of its own lines (Completed lines only, or all non-Cancelled lines). The `GET /api/tables/:id/orders` response shape is not shown, creating a minor ambiguity for U4 about whether to reuse that endpoint or query the DB directly. | Clarify in the bill-shape description that `orders[].subtotal_cents` is the sum of that order's non-cancelled lines, and state whether `GET /api/tables/:id/orders?visit=current` is the upstream call or whether Billing queries directly. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261105-table-order-app/inception/contract-design/contract-summary.md > SSE > Event types > ORDER_PLACED payload | The `ORDER_PLACED` payload carries `lines` but does not include `price_cents_each` or `subtotal_cents` per line. The Kitchen Board (U3) renders item quantities from the SSE payload directly (mockups.md Screen S1 shows "× 1", "× 2" for each order card). If the board builds its view purely from the SSE event it has the quantity, but the bill (U4) needs prices. Clarify whether U3 and U4 are expected to call `GET /api/tables/:id/orders` after receiving the event, or whether the SSE payload should include prices. | State explicitly in the SSE section whether `ORDER_PLACED` is a notification-only event (clients must fetch to get prices) or a full payload. If notification-only, add a contract note; if full payload, add `price_cents_each` and `subtotal_cents` to the `ORDER_PLACED` lines schema. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (none listed for this stage) | Not run | No validation tools were declared for contract-design; structural checks were performed manually against the upstream artifacts. |

### Summary

The contract is well-structured and covers all functional requirements. Every FR has a contract path, the error envelope is consistent, the order state machine matches requirements exactly, placement_key dedup is correct in the common case, sold-out drop at submit is covered, U4 Billing endpoints address FR3.1–FR3.6, and SSE event types align with the mockup live-update flows. Four minor ambiguities were found — the placement_key cross-table scope, the informal `by` actor field on the transition endpoint, an order-level subtotal clarification on the bill, and whether ORDER_PLACED carries prices — none of which block parallel Bolt development, but each should be tightened before U2/U3 Functional Design to prevent divergent implementations.

READY
