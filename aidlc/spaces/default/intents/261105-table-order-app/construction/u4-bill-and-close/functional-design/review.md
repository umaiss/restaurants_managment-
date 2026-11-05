## Review

**Verdict:** READY

### Findings

| # | Severity | Location | Finding | Suggested fix |
|---|---|---|---|---|
| 1 | Minor | `functional-spec.md` > Server — Billing component / GET /api/tables/:id/bill; `entities.md` > Entities owned by other components | U4 names the in-process Ordering call `getOrdersByVisit(tableId, visitId)` throughout, but `contract-summary.md` > Billing > GET /api/tables/:id/bill names it `Ordering.getOrdersForVisit(table_id, visit_id)`. A developer implementing `billingRepo.ts` will see two names for the same boundary and must guess which is authoritative. | Align the name in `functional-spec.md` and `entities.md` to match the contract: `getOrdersForVisit(table_id, visit_id)`. |
| 2 | Minor | `entities.md` > Entities owned by other components — Visit row | The in-process call `getCurrentVisit(tableId)` on `Tables` is listed here as how U4 reads the current visit, but it does not appear anywhere in the shared contracts (`contract-summary.md` or `components.md`). A developer cannot confirm the method signature exists on the Tables module without guessing. | Add `getCurrentVisit(tableId)` to the in-process contract note in `functional-spec.md` alongside `closeVisit(tableId)`, and confirm the method exists in the Tables module contract (or note it as an in-process method established in U1). |
| 3 | Minor | `functional-spec.md` > Screen S2 — Table Bill / Close table flow | The Close table flow handles `CLOSE_BLOCKED` (step 4) and `TABLE_EMPTY` (step 5) but has no specified UI response for `TABLE_ALREADY_CLOSED` (409), which is listed as an error code for `POST /api/tables/:id/close` in both the spec and the contract. A developer implementing the error handler in `TableBillScreen.tsx` has no guidance for this case. | Add a step 6 (or a note below step 5) specifying that on `TABLE_ALREADY_CLOSED` the screen navigates back to `/staff` immediately, since the table is already closed, treating it the same as receiving a `TABLE_CLOSED` SSE event. |
