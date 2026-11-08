## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-07T18:56:08Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261107-table-order-v2/inception/domain-design/components.md > component StaffAccess behaviour; decisions.md > ADR-005 Decision | The lockout counts wrong tries by "client address plus session". A guesser who discards the cookie gets a new session and a fresh count, so the 5-tries-per-60-seconds limit can be bypassed and a 4-digit PIN (10,000 values) can be brute-forced from one address. FR3.3 says "one browser", which is not the same as one session. The LoginAttempt table in memory also has no size limit or cleanup, so repeated new sessions grow it without bound. | Key the lockout on client address alone (or address plus a fixed per-browser value that is not reset by dropping the cookie), and say so in ADR-005. Note the shared-router trade-off already listed. Add an expiry or size cap for LoginAttempt entries. State that the PIN comparison is constant-time and that the session cookie is HttpOnly with SameSite set. | New |
| R-02 | Major | aidlc/spaces/default/intents/261107-table-order-v2/inception/domain-design/components.md > components FloorStatus, SalesReporting (depends_on), ServiceCalls, DishRatings, ApiRoutes | Cross-feature edges would make two parallel Units depend on each other. FloorStatus depends on ServiceCalls (call-the-waiter feature) and LiveEvents. SalesReporting depends on DishRatings (ratings feature) and on KitchenStations-driven completed times. If these are split across the two parallel feature Units, one Unit's code needs the other's tables and component. ApiRoutes holds every cross-component use case, so both parallel Units will edit the same file set (placement transaction touches ChefSpecials, WaitEstimation and OrderManagement together). | Record in the design which components and tables belong in the shared foundation. At minimum: the ServiceCall, DishRating, StationDone and ChefSpecial tables and the ApiRoutes use-case seams (order placement, close table, station done). Otherwise state that FloorStatus with ServiceCalls and SalesReporting with DishRatings must be grouped in the same Unit. Units Generation then has an explicit rule to follow. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261107-table-order-v2/inception/domain-design/components.md > components ChefSpecials, OrderManagement, entity OrderLine | Two gaps in the special-stock design. (1) The atomic update is described as "in the same transaction" but not as a single guarded update (stock reduced only when enough is left, special not ended and not past its end time, checked inside the transaction); a read-then-write would still oversell. (2) OrderLine.special_id has no declared reference to ChefSpecial, and OrderManagement does not depend on ChefSpecials, so it is unstated who supplies the special price when the line is frozen. "One special live at a time" has no stated enforcement. | Add the guarded-update rule and a quantity-greater-than-one case to ChefSpecials. Declare the OrderLine to ChefSpecial reference and say that ApiRoutes passes the special price into placement. Say how the single-live-special rule is enforced. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261107-table-order-v2/inception/domain-design/components.md > component ApiRoutes behaviour; requirements.md FR3.6 | Guarding every staff route and the staff stream changes v1's API (v1 trusted the `by` field), so v1 tests that call staff routes without a session will fail. The design does not say these v1 tests are changed, or that the guard is on the "Changes to v1" list. I could not locate a scope-definition folder in the record to confirm the list. | Confirm FR3.6 and the staff guard are on the "Changes to v1" list, and name in the design that v1 tests calling staff routes must be updated and listed in the Unit's code-summary under "v1 tests changed". | New |
| R-05 | Minor | aidlc/spaces/default/intents/261107-table-order-v2/inception/domain-design/components.md > component FloorStatus behaviour | "Browsing" needs the table of each open diner connection and its last activity from LiveEvents, but LiveEvents has no declared entity or attribute for this, and the 5-minute quiet limit has no named owner for the activity timestamp. | State in LiveEvents where the per-table connection count and last-activity time live (in memory) and that a restart resets them. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Step 4 rule: component names unique | PASS: 20 components, no duplicates | None |
| Step 4 rule: `component:` and `owned_by` name declared components | PASS | All 14 ApiRoutes edges, all entity references (Category, MenuItem, OptionGroup, Visit, Table, Order, OrderLine, ...) resolve |
| Step 4 rule: no self-dependency | PASS | None |
| Step 4 rule: depends_on and dependents symmetric | PASS | Checked every pair in both directions (for example TableSessions to its 8 dependents, OrderManagement to its 6, LiveEvents to its 5, ClientPreferences to its 3) |
| Step 4 rule: each entity one owner and an identifier | PASS: 20 entities, one owner each, all have `identifier` | None |
| Step 4 rule: `references.entity` declared under its `owned_by` | PASS | None |
| Step 4 rule: dependency graph acyclic | PASS | ApiRoutes and the client views are at the top; no path returns to a component above it |
| traceability.json against stories.md | PASS | The 19 US IDs (US1.1 to US19.1) match stories.md exactly, and every named target is a component or entity declared in components.md |
| `aidlc engine sensor-traceability --stage domain-design` | Could not run: `aidlc-sensor-traceability: --output-path is required` | It needs an output path; I did not write one. The manual checks above cover the same ground. |

### Summary

The component catalogue is structurally sound: every well-formedness rule and the story-to-component trace passes, and the ADRs have real alternatives. Two Major points should be weighed before approval: the PIN lockout can be bypassed by dropping the session cookie, and the design does not say which tables and components belong in the foundation, so the two parallel feature Units could end up depending on each other through FloorStatus, ServiceCalls, SalesReporting and DishRatings.
