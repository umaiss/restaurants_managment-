## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-10T18:10:26Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/contract-design/contract-summary.md > C5 modules salesRules.ts `closedDayTakingsCents` and required_tests (10,000 past visits under 300 ms) | The contract says the rule "reads only that day's closed visits", but today's `getSales` in src/server/routes/u7/sales.ts loads every closed visit and works out each visit's local day in code, because `closed_at` can be stored in two time formats. A day-limited read therefore needs a rule for filtering by local day in SQL across both formats (or a new index or column), and the contract gives none. Without it the 300 ms test is either unreachable or the TV total can differ from the Sales page, which breaks the "exactly the Sales page's total_cents" promise. | Add to C5 how the day filter works: for example a UTC range covering the local day for both stored formats, with a wider range that is then checked in code with the same day rule as the Sales page. Also name a test with visits in both stored formats near midnight. If a column or index is added, list it in the `tv-settings` or a separate additive upgrade step. | New |
| R-02 | Major | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/contract-design/contract-summary.md > C3 consumer behaviour (the switch) | The switch on every staff page learns its position only from TV_SETTINGS_CHANGED, and the reconnect re-read of C1 is written for the TV pages only. The staff stream replays at most 60 events (src/server/sse.ts), shared with all order traffic, so a staff page whose stream dropped for a while can miss the event and show the wrong position indefinitely. | Say that the switch also reads `GET /api/staff/tv/settings` on mount and on every stream reconnect. Add that to the C2 and C3 consumers and to U8's tests. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/contract-design/contract-summary.md > C5 routes registry_entry; src/server/routes/registry.ts `RouteModule.owner` | The registry entry uses `owner: 'U8'`, but the `owner` type is `'v1' \| 'U5' \| 'U7'`, so the entry will not compile as written. The summary lists the registry change but not the type change. | Add the widening of `owner` to include `'U8'` to the "v1/v2 changes" list, and state it in C5. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/contract-design/contract-summary.md > C2 PUT | The contract does not say whether TV_SETTINGS_CHANGED is published when the sent value equals the stored one. It says "saves nothing new" but is silent on the event and on `updated_at`. A developer has to guess, and tests could disagree. | State that a no-change PUT publishes no event and leaves `updated_at` as it was, or the opposite. Add one test for it. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/contract-design/contract-summary.md > Error, Timeout and Retry Behaviour (C1 401) | Staff sessions live only in server memory (src/server/staffAccess.ts) and the cookie ends with the browser. A server restart turns an unattended wall TV into a PIN screen with no recovery path other than someone typing the PIN. The earlier answer to keep the TV signed in covers idle time, not restarts. | Record this as a known limit in the contract. Optionally say the PIN screen on the TV shows a plain "Sign in again on this screen" message, and that the wall recovers by itself once signed in. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/contract-design/contract-summary.md > C1 description (`requireStaff({ refresh: true })`) | The staff router already applies `requireStaff()` (which refreshes by default) to every `/api/staff` route through `router.use('/staff', ...)` in src/server/routes/staff.ts. The summary reads as if U8 must add its own guard, which could double-wrap or invite `refresh:false` by mistake. | Reword to say the route relies on the existing staff guard, mounted after `staff` in the registry, and add a test that an unauthenticated read gets 401 and an authenticated one refreshes the idle time. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| none listed for this stage | not run | Checked against src/server/errors.ts (INVALID_REQUEST, UNAUTHORIZED, INTERNAL_ERROR all exist with the stated statuses), src/client/hooks/eventNames.ts (STAFF_EVENT_NAMES can take one more name), src/server/sse.ts (60-event ring, per-channel), src/server/staffAccess.ts and routes/staff.ts (guard behaviour), routes/u7/sales.ts and routes/registry.ts. |

### Summary

The contracts are consistent with the real code: error codes, the staff stream, the guard and the Sales rule all resolve, and there is no circular dependency between U8 and U9. The two Major points (how a day-limited takings read works with the two stored time formats, and the switch going stale after a missed event) are fixable with short additions to the summary and do not block the design.
