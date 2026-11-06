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
| R-01 | Major | src/client/screens/diner/MyOrdersScreen.tsx > fetchOrders, line 61 | Cancelled orders are silently filtered from the list on every fetch, including when triggered by ORDER_STATUS_CHANGED. The functional spec (Screen D3) says Cancelled orders should show a Cancelled status pill; the Cancel order flow in the spec assumes the diner can see the cancelled card. The current code removes them from view, so an ORDER_STATUS_CHANGED re-fetch that transitions an order to Cancelled makes the card vanish entirely rather than showing the Cancelled pill. | Remove the `.filter((o) => o.status !== 'Cancelled')` on line 61. Display all orders including Cancelled ones. The Cancelled pill is already styled and icon-mapped; only suppress the Cancel button for non-Pending orders, which the spec already requires. | New |
| R-02 | Major | src/client/screens/diner/CartScreen.tsx > handlePlaceOrder, lines 44–48 | The server always returns HTTP 201 for new orders (never 409 DUPLICATE_PLACEMENT_KEY per the comment in orders.ts line 65–72); the 409 branch in CartScreen is therefore dead code. The spec says duplicate protection is enforced by the placement_key, but the server implementation does not raise a 409 at all — it always returns the same 201 for the same placement_key within a visit. The duplicate-banner UI path will never fire in production, and the placement_key is cleared after a 201 success, removing idempotency protection for retries on a flaky network before the response arrives. | Coordinate with the server: either make the server return 409 with code DUPLICATE_PLACEMENT_KEY when it detects an already-placed placement_key (the spec's intent), or document the actual idempotency contract and remove the dead branch. The placement_key must not be cleared until the UI has navigated away or the session ends — clearing it immediately on success (useCart.clearCart) makes in-flight network retries send a fresh key on the next tap, defeating idempotency. | New |
| R-03 | Minor | src/client/hooks/useTableSSE.ts > connect, lines 47–51 | Last-Event-ID is passed as a URL query parameter (`?lastEventId=…`) because EventSource does not support request headers. The server SSE route (`src/server/routes/sse.ts`, lines 14–19) does not read this query parameter at all and therefore cannot replay missed events from the ring buffer. The spec requires event replay on reconnect. | Either update the SSE server route to read `lastEventId` from the query string and replay buffered events from that point, or document that server-side replay is not yet implemented and mark this as a known gap. | New |
| R-04 | Minor | src/client/screens/diner/CartScreen.tsx > ConfirmModal usage, line 296 | The ConfirmModal is called with props `message`, `cancelLabel`, and `onCancel`, but the component spec in frontend-components.md defines those props as `body`, `confirmLabel`, `onClose`, with no `cancelLabel` or `onCancel`. If ConfirmModal from U1 uses the spec's prop names the modal will render with an empty body and the cancel callback will be a no-op, leaving the modal impossible to dismiss. | Verify the actual ConfirmModal component API and align CartScreen's prop names with it. If the U1 component was built as `message`/`cancelLabel`/`onCancel`, update the design spec; if it was built as `body`/`onClose`, update CartScreen. | New |
| R-05 | Minor | src/client/screens/diner/MenuScreen.tsx > MenuItemCard, line 398–442 | The `+ Add` button has no `disabled` attribute and no `aria-disabled` when the item is at maximum quantity (20). The functional spec requires the pill to read "Max" and be disabled at quantity 20. The current AddPill logic in MenuItemCard shows the in-cart count badge but never shows "Max" and never disables the button, allowing the quantity to exceed 20 by repeated taps. | Add a check: when `cartQuantity >= 20`, render the button text as "Max" and set `disabled` and `aria-disabled="true"` on the button, matching the spec requirement. | New |
| R-06 | Minor | src/client/screens/diner/MyOrdersScreen.tsx > Cancel order | The functional spec (Screen D3) requires a Cancel order button on Pending orders that opens a confirmation modal and POSTs to `/api/orders/:order_number/transition` with `{ to: "Cancelled", by: "diner" }`. No Cancel button is implemented anywhere in MyOrdersScreen. | Add a Cancel order button to Pending order cards, wired to a ConfirmModal and the transition endpoint. This is an omitted feature from US3 / FR1.9. | New |
| R-07 | Minor | src/client/hooks/useTableSSE.ts > BACKOFF_STEPS, line 13 | The backoff sequence is `[1000, 2000, 4000, 8000, 16000, 30000]` (exponential doubling) but the spec requires `1 s, 2 s, 5 s, 10 s, 15 s, 15 s, …`. The cap is 30 s in code vs 15 s in the spec. This is a minor deviation from the documented reconnect contract. | Align the backoff sequence with the spec: `[1000, 2000, 5000, 10000, 15000, 15000]`. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual API contract check | Server orders.ts never returns 409 for duplicate placement_key (always 201) | Confirms the Major finding on dead CartScreen idempotency branch |
| Manual SSE route check | Server sse.ts does not read lastEventId query parameter | Confirms the Minor finding on replay not being wired |
| Manual spec vs code check | MyOrdersScreen filters out Cancelled orders; spec shows Cancelled pill | Confirms the Major finding on hidden Cancelled orders |

### Summary

The diner screens are substantially correct — all three screens render, the SSE hook reconnects, the cart persists to localStorage, and the placement_key idempotency mechanism is in place on the client side. Two Major findings block a clean sign-off: Cancelled orders are silently hidden instead of showing a Cancelled pill as the spec requires, and the server-side 409 DUPLICATE_PLACEMENT_KEY response the client code guards against is never actually emitted by the server, making that branch dead and leaving the idempotency story incomplete. Four Minor findings cover the missing Cancel order button in My Orders, the missing Max-quantity guard on the Add pill, a prop-name mismatch on ConfirmModal, and misaligned SSE backoff values.
