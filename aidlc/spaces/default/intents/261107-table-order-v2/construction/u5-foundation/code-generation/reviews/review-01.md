## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08T00:00:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/server/db.ts > seedIfEmpty (returns early when the tables table has rows) and seedV2Details; code-generation-plan.md line 49 ("A v1 database file is only upgraded, never re-seeded") | The upgrade of an existing v1 database adds the new columns and tables but never applies the v2 seed details. The v1 file `table-order.db` (with data, last written 7 Nov) is still in the main folder. When the app starts on it, every item stays at the default station Grill, every item has allergens NULL ("not set"), and Classic Burger and Margherita Pizza have no option groups. `dbUpgrade.test.ts` asserts exactly this outcome, so it is deliberate. But the team's own app on port 3000 will then show no options, no allergen marks and no stations, and U6 and U7 will look broken on it, although fresh databases and every test database are fine. | Decide before sign-off: either (a) state in the sign-off steps that the old `table-order.db` must be deleted so the seed runs (and put the same line in the notes for U6 and U7), or (b) add an idempotent, additive backfill that sets station, allergens and the option groups only for the 12 seed item ids that are still at their defaults, with a test. Do not leave it unmentioned. | New |
| R-02 | Minor | src/server/routes/orders.ts > POST /tables/:id/orders (line validation) | The open order route caps `quantity` (1 to 20) but not the number of lines or the length of each `option_ids` list. Only the default 100 kB body limit bounds it. A caller with no session can make one request run several thousand option lookups inside a write transaction, which blocks the single server process. | Add a cap on lines per order and on option ids per line (for example 50 lines and 20 option ids) and answer 400 INVALID_REQUEST above it, with a test. | New |
| R-03 | Minor | src/server/presence.ts > getOrCreate and dropOldest (the 500 per table and 5,000 total caps) | When a cap forces the oldest page out, that page may still have its stream open. Later heartbeats recreate its record with `connections` at 0, and `isPresent` needs `connections > 0`, so a live page stays uncounted until its stream reconnects. Only reachable at the caps, so low risk, but the cap test does not cover it. | Prefer evicting a page whose connection is closed, or count a heartbeat-recreated page as present. Add a test for the evicted live page. | New |
| R-04 | Minor | src/server/repositories/tableRepo.ts > getLastClosedVisitId (and getCurrentVisit in db.ts) | They order by `closed_at` and `opened_at` as text, while v1 rows hold `YYYY-MM-DD HH:MM:SS` and v2 rows hold ISO `...T...Z`. On the same calendar day a space sorts before `T`, so a v1 row can sort before a v2 row even when it is later. Only possible on the day a v1 database is first run on v2, but it would pick the wrong "last closed visit" for ratings (BR7.1). | Order by a normalised instant (for example `julianday(closed_at)`) or accept and record the one-day edge case. | New |
| R-05 | Minor | src/server/routes/staff.ts > POST /staff/logout (behind the guard) | Logout with an already-ended session answers 401 and does not clear the cookie, so the stale cookie stays in the browser. No security effect, since the session is already gone and the client goes to the PIN screen on any 401. | Optional: answer 204 and clear the cookie whether or not the session is valid. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npx vitest run src/server/__tests__/foundation --coverage.enabled=false` | PASS: 22 files, 337 tests | Matches the 22 foundation files in the code summary. Covers BR3.1 check order, all-or-nothing (rollback of stock, order number and visit), lockout by address, session end closing streams, the 12-hour idle end, and the upgrade running twice. |
| `npx vitest run src/client/design src/client/components/ui src/client/alerts src/client/staff src/client/diner src/client/hooks --coverage.enabled=false` | PASS: 16 files, 269 tests | The summary says 268 at Step 16; the one extra test is harmless. |
| `npx vitest run src/server/__tests__ src/client/components src/client/screens src/client/views --coverage.enabled=false` | PASS: 48 files, 628 tests | v1's server and client tests pass with only the four listed server edits. |
| `npx tsc --noEmit` | PASS: no output | Types are clean. |
| Playwright | Not run, by instruction | The person's own run (868 unit and 83 browser tests) is recorded in the code summary and is not re-checked here. |

### Checks that found no defect

- **Staff guard.** `routes/staff.ts` holds the open login route, then `router.use('/staff', requireStaff())`, and the registry mounts it before the five U7 stubs. `/sse/staff` uses `requireStaff({ refresh: false })`. The sold-out toggle, bill, Close table, specials launch and end, call respond and by=staff status changes are all guarded; diner routes are open as BR1.5 lists. `by=station` is refused with 400 on the status route.
- **PIN handling.** The PIN comes only from `STAFF_PIN`, or a random one printed once. It is compared in constant time on hashes, is never logged again, and a bad setting is reported by name only. The cookie is HttpOnly, SameSite=Strict, Path=/, with no expiry. The lockout counts by the socket address, never a header, and fails closed when all 1,000 slots are locked. The only PIN literal is the test value `4242` in `playwright.config.ts` and `src/test-setup.ts`, labelled as a test value.
- **Order placement.** The check order matches BR3.1 (known and not hidden, sold out, special checked only, options exist, options belong, one-of, required). The guarded stock statement runs last, after every line has passed. `EMPTY_ORDER` rolls back the whole transaction, including a visit opened for it.
- **Streams and presence.** Streams end with the session, with a re-check at each keep-alive. Presence has the page-id pattern, the 5-minute window, the 30-second sweep, the caps and the one-event-a-second merge. The page id and 60-second heartbeat live in `useTableSSE`.
- **Database upgrade.** It only adds, each step is named on failure, and the seed keeps 10 tables, 4 categories and 12 items.
- **Route mounting.** The registry is mounted before the page catch-all in `index.ts`, and the page is still served with `{ root: distDir }`.
- **v1 protection.** `git status` shows changed v1 files only inside the plan's list, and `source-manifest.json` covers every changed and new file I found. Of the v1 tests, only the four server specs and `bill-and-close.spec.ts` changed, and each is listed under "v1 tests changed" with a reason. No v1 client test changed.
- **Recorded decisions, noted and not re-raised.** The Size groups are choose-one but not required (BR2.6 deviation; U6 makes them required). Item names on old lines are read live from `items` (accepted risk). The wording differences kept for v1 tests ("Clear all", "Place →", the closed-table text, "Mark completed"). The wrong-PIN brute-force exposure across many addresses is also recorded in BR1.4.
- **Test quality.** No test that cannot fail was found: no `expect(true)`, and the only `.skip` is the deliberate lockout flow in the non-main browser projects. The 300 ms timing test measures real requests against the seed, so it could be slow on a loaded machine; the person should treat a failure there as a test problem to fix, not a threshold to loosen.

### Summary

U5 is implementable and sound: the guard, lockout, order placement, special stock, calls, ratings, presence and the additive upgrade all match the rules, and all four commands pass. READY, with one item for the person to decide before sign-off: an existing v1 database file is upgraded but never given the v2 stations, allergens or options, so the team's own app on it would show none of them.
