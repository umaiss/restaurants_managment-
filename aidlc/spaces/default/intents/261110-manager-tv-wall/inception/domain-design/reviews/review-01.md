## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-10T18:03:44Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/domain-design/components.md > components OrderRepository, ServiceCallRepository, BillingRepository ("existing, used ... Unchanged") | The catalogue says these three are only read from and do not change, but the real code has no read that fits. orderRepo.ts only offers per-visit reads (getOrdersByVisit, getOrdersOfLastClosedVisit), serviceCallRepo.ts only offers per-table listCalls(tableId), and billingRepo.ts only offers per-table buildBill(tableId). Nothing returns today's open orders, today's order counts and portions across all tables, or open requests across all tables. ADR-001 itself says nothing like this exists today. Either TvWallSummary runs its own SQL (and the "unchanged" labels are wrong) or the repositories gain new read functions. Code Generation would have to guess. | Decide where the new cross-table, today-bounded reads live. Either mark OrderRepository and ServiceCallRepository (and BillingRepository if a visit-id bill read is added) as "existing, extended" with the named read added, or state that TvWallSummary owns its own queries. Update the component text and summary table to match. | New |
| R-02 | Major | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/domain-design/components.md > TvWallApi, TvTakingsSwitch, TvSettings | TvWallApi is described as "two routes": read the summary, and change the setting. The switch "shows the current setting" and "reads and changes the setting", but no route returns the setting. While takings are off the summary leaves money out, so a missing money field is a poor stand-in for the flag. The "TV settings changed" event payload is also not defined (does it carry the new value?). A switch loading on a staff page, and a TV deciding between "Takings hidden" and a figure, have no stated source of truth. | Add the current show_takings value to the summary answer, or add a read-setting route. State the event payload (value or "re-read"). Update TvWallApi's route list and the switch's dependency text. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/domain-design/components.md > SalesReports ("existing, extended") | In the real code the closed-day rule lives in src/server/routes/u7/sales.ts (getSales), a route-layer function that scans every closed visit and groups by day. A service module depending on a route module is a layering inversion. getSales already takes from/to, but it still loads all history, so the "callable for one day" change must be a real extraction, not a parameter. | Name the real owner file. Say the extraction goes into a shared module that both the Sales route and TvWallSummary call, and that it reads only the requested day's closed visits. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/domain-design/components.md > TvWallSummary ("today's rows only") | A Pending or Preparing order placed before midnight (the TV left open overnight) would drop off the open-orders list at the day boundary although it is still open. Midnight also fires no live event, so figures flip only on the next event or poll. | State that open orders are listed whatever day they were placed (only the counts and takings are day-bounded). Name the day-rollover refresh. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/domain-design/components.md > TvWallScreen behaviour vs decisions.md > ADR-003 | The "re-read at least every 5 minutes" rule appears only in ADR-003 and is missing from TvWallScreen's behaviour. Nothing says to coalesce a burst of events into one read. Each event triggers a full summary read. | Add the 5-minute re-read to TvWallScreen. Add a short coalescing rule for bursts (for example one in-flight read plus one pending). | New |
| R-06 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/domain-design/traceability.json > coverage | US1.2 and US5.2 map to "StaffSession, TvWallApi" and "TvWallApi, StaffAccess", but the 12-hour idle refresh (ADR-003) is also carried by TvWallScreen's periodic re-read, which is not listed. | Add TvWallScreen to the targets for the idle-refresh story. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| None listed for this stage | Manual check of components.md | Names are unique. depends_on and dependents are symmetric for all 14 components. The graph is acyclic (StaffShell is a leaf, the data components are roots). The only new entity, TvSetting, is owned once. All stable event names the TV needs (ORDER_PLACED, ORDER_STATUS_CHANGED, TABLE_CLOSED, SERVICE_CALL_OPENED, SERVICE_CALL_RESPONDED) are already published on the staff channel in src/server. requireStaff({ refresh }) exists in staffAccess.ts, so ADR-003's "existing refresh mode" claim holds. |

### Summary

The structure is sound and the ADRs are complete, with alternatives and security notes. Two gaps would make a developer guess: the "unchanged" repositories lack the cross-table, today-bounded reads the summary needs, and there is no stated way for the switch and TV to read the current setting. Both are fixable in the document before Units Generation.
