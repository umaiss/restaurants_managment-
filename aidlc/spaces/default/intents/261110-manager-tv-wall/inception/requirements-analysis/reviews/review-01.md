## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-11-10T17:48:57Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261110-manager-tv-wall/inception/requirements-analysis/requirements.md > FR6.2 and Assumptions (first bullet) | Where staff flip the "Show takings on the TV" switch is only an assumption (under the navigation link). The scope document says the only change to v1 and v2 is one navigation link, so a second control in the navigation goes beyond what was agreed. FR6.2 has no acceptance criterion for the switch itself being reachable. This is the one place the people who agreed the scope could be surprised. | Either state the switch's location as a requirement with a Given/When/Then, and add it to the scope's changes to v1 and v2 so NFR8 matches, or put it on the TV wall's own staff-side area. Ask the team to confirm at the gate. | New |
| R-02 | Minor | requirements.md > FR2.5 and NFR2 | "Room for 12 rows" is only an example. The number of rows that fit at 1920x1080 is never fixed, and NFR2 says "first rows" without a count. QA cannot say how many rows must be visible. | State the minimum number of rows visible at 1920x1080, and that "+N more" appears only when open orders exceed it. | New |
| R-03 | Minor | requirements.md > NFR1 and NFR2 | Five headline figures at least 72 px, all other text at least 32 px, and a list of rows, all without scrolling, may not fit together on a 1080 px-high screen. The requirements do not say which wins if they conflict. | Name the priority (for example, the headline figures and the oldest-wait row win, and the list is trimmed with "+N more"). Or confirm with a quick layout sketch at the mockup stage. | New |
| R-04 | Minor | requirements.md > FR7.1 and NFR3 | FR7.1 says "within 2 seconds" without exception. NFR3 says 95% within 2 seconds. The two give different pass and fail results. | Align them: keep the 95% target and make FR7.1 refer to NFR3. | New |
| R-05 | Minor | requirements.md > FR3.2, FR4.1, FR5.1, Assumptions (second bullet) | "Today" is defined by the Sales page's close-time day. The busiest table and top dish are counted by order date. A visit open across midnight, or an order placed yesterday on a table closed today, is not covered. | Add one sentence saying which day such orders and tables belong to for each figure. | New |
| R-06 | Minor | requirements.md > FR2.2, FR7.3 | "Number of items" could mean lines or total portions. The "minutes waited" counter runs on the TV browser's clock while the order time comes from the server, so a wrong TV clock gives wrong waits. | Define items as total portions (or lines). Compute the wait from a server-supplied time offset, or state the clock assumption. | New |
| R-07 | Minor | requirements.md > NFR6 | "Under 300 ms on the restaurant machine" cannot be reproduced in an integration test on varying hardware. | Phrase it as a test-environment threshold, or as "reads only rows from today" checked by a query-count or row-count test. | New |
| R-08 | Minor | requirements.md > FR8.1 | The keep-alive needs to use an existing route or a new one, and it must reset the idle timer. This is not stated, and NFR8 lists only the new route and the new event as reasons to change an existing test. | State whether the keep-alive is part of the new data read or a separate call, and include it in the allowed-changes list in NFR8. | New |

### Summary

The requirements are complete, trace to the intent and scope, and are mostly testable, with edge cases (empty, tie, hidden, reconnect, sign-out) settled. One Major point remains: the takings switch's location goes beyond the agreed scope and should be confirmed. It has a clear workaround, so the work is ready for engineering once the team decides it at the gate.
