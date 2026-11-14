## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-10T18:18:22Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261110-manager-tv-wall/construction/u8-tv-foundation/functional-design/rules.md > BR10.1 and BR3.4; functional-spec.md > W6 | The design makes `getSales` call `closedDayTakingsCents` once for every day. Today `getSales` (src/server/routes/u7/sales.ts) makes a single pass over all closed visits and lines. The new design would run one query per day of history, and each query still scans the visits table, because the "first 10 characters" filter in BR3.4 cannot use an index and no index on `closed_at` is planned (BR1.4 adds only `tv_settings`). So "reads only that day's closed visits" is not true, and the Sales page could get much slower as history grows. The regression test in BR10.1 checks that the output is unchanged, not how long it takes. | State how `getSales` shares the rule without a per-day loop. For example, share only the line-money rule and the day-of-visit helper and keep the single pass. Or have `closedDayTakingsCents` accept a day range and be called once. If an index on `closed_at` is wanted, add it as an additive step in BR1.4 and say so. Reword the BR3.4 claim to what is really achieved. | New |
| R-02 | Minor | functional-spec.md > W4 step 4 and rules.md > BR7.4 | The midnight re-read says the TV re-reads when "now passes midnight of `summary.day`". It does not say how the browser finds the server's midnight. The browser may be in a different time zone from the server. Parsing the `day` text with the browser's own local time gives the wrong moment, and the summary carries no next-midnight value. The Sales rule it builds on is server-local. | Add a field to the summary (for example `day_ends_at`, an ISO instant) or say the client takes the offset from `server_time`. Add a client unit test for a browser time zone that differs from the server's. | New |
| R-03 | Minor | functional-spec.md > W5 and rules.md > BR8.1 | `useStaffSSE` exposes `lastEvent`, which is replaced when several events arrive together. It also exposes `events`, each with a `seq`. The switch and the TV hook must read `events`, or a burst can hide `TV_SETTINGS_CHANGED` (or hide a trigger event). The design does not say which one to use. `onConnected` also fires on the very first open, not only on reconnects. | Say that both consumers read `events` by `seq`, and that the first open counts as the initial read, merged under BR7.2. | New |
| R-04 | Minor | rules.md > BR7.3 compared with functional-spec.md > W4 step 5 | BR7.3 says "5 minutes since the last successful read started". W4 says "five minutes after the last read started". The two differ when reads fail. | Use one wording. Recommended: 5 minutes since the last read started, whatever the outcome. The 10-second retry in BR7.6 already covers failures. | New |
| R-05 | Minor | rules.md > BR7.1 and entities.md > TopDishView | The top dish name is "read live", but `MENU_CHANGED` is not a re-read trigger. A renamed dish can show the old name for up to 5 minutes. | Either add `MENU_CHANGED` to BR7.1 or record the 5-minute lag as accepted. | New |
| R-06 | Minor | rules.md > BR3.4 | The day filter uses the first 10 characters of stored times and calls them "their UTC date". That holds for "YYYY-MM-DD HH:MM:SS" text and for ISO text that ends in `Z`. It would be wrong for ISO text written with a non-UTC offset. | State that stored times are always written in UTC (check the app's `toIso`), or widen the window or fall back to a parsed check for any other offset. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (none listed for this stage) | n/a | I checked the design against the code instead. Findings: the staff guard in staff.ts covers `/staff/tv/*` when the new router is mounted after `staff`. `closedDayTakingsCents` money matches the quantity times frozen unit price used in Sales and in `buildBill`. The single shared `/sse/staff` stream is confirmed. `getSales` as written is a single pass, which supports the Major finding. |

### Summary

The design is implementable and its references resolve: guard order, time formats, the shared stream and the frozen-price money rule all match the code. The one point to weigh before approval is how the shared Sales rule is reused, because a per-day loop plus an unindexed day filter could slow the existing Sales page.
