# Architecture Decisions — Manager TV Wall

Decisions behind `components.md`. They are built on `inception/requirements-analysis/requirements.md`, `inception/user-stories/stories.md` and the existing app in `aidlc/spaces/default/codekb/table-order/architecture.md`.

## ADR-001: One day-bounded summary read for the TV wall

**Status:** Accepted (team choice, domain-design Q1)

**Context**
- The TV wall needs five figures plus the open orders and requests (FR2 to FR5, FR9).
- The figures partly exist today, in different places:
  - The Kitchen Board loads each table's orders with a separate request.
  - The Sales page recomputes every past day on each read (architecture.md, improvement opportunities).
  - Nothing works out the busiest table or the top dish.
- The TV must answer quickly with years of history (NFR6), and must not receive money while takings are hidden (FR6.3).

**Decision**

A new server module, TvWallSummary, builds one answer from today's rows only. A new staff route serves it. The TV re-reads it when a live event says an order, table, request or the setting changed, and on reconnect.

**Consequences**
- Positive: one small request per change; reads only today's rows; the money is decided on the server; each rule is testable without a browser.
- Negative: a second place applies the Sales money rule. ADR-005 shares it, so the two cannot drift. The TV makes one read per relevant event; on a busy evening that is a few reads a minute on one local process.
- Security: the route sits behind the staff guard (NFR4), and while takings are hidden no amount leaves the server.

**Alternatives Rejected**
- Combine existing reads in the browser:
  - many requests, including a full-history read on every change;
  - money reaches the browser even while hidden;
  - the busiest table and top dish would still need new code.
- Push the summary inside live events:
  - large events;
  - a missed event leaves the TV wrong;
  - money would travel on the shared staff channel to every staff screen.

## ADR-002: Restaurant-wide setting stored on the server, off by default, and money left out of the answer while off

**Status:** Accepted (requirements Q3, scope Q1)

**Context**

Diners must not see revenue (intent). The setting must reach every TV within 2 seconds (FR6.4) and survive a restart (FR6.1).

**Decision**
- TvSettings stores one `show_takings` value in a new table, added by a new additive upgrade step.
- A missing row reads as off.
- While it is off, TvWallSummary leaves both money fields out of its answer, and the TV shows "Takings hidden".
- A change is saved first, then announced on the staff channel as a "TV settings changed" event.

**Consequences**
- Positive: safe by default on new and upgraded databases (NFR5); every TV and every switch follows one fact; nothing to inspect in the browser while hidden.
- Negative: one more table and one more event name. Existing tests that count the upgrade steps and event names must change, and are listed in the code summary (NFR8).
- Security: only signed-in staff can change it (FR6.2). The value is validated as true or false.

**Alternatives Rejected**
- Per-TV setting in browser storage: rejected by the team (requirements Q3); a new TV would start in the wrong state.
- Hide on the client only: money would still reach the browser.

## ADR-003: The TV's own reads keep its staff session alive

**Status:** Accepted (requirements Q2; stories assumption)

**Context**

Staff sessions end after 12 hours without a staff request, and the live stream deliberately does not refresh them (architecture.md, BR1.9). A TV that only listens would be signed out mid-service.

**Decision**
- The TV wall summary route uses the staff guard's existing "refresh the idle timer" mode.
- The TV re-reads the summary at least every 5 minutes even without events.

**Consequences**
- Positive: no new keep-alive route or session type; an open TV stays signed in (FR8.1); a restart or closed browser still asks for the PIN (FR8.2).
- Negative: a TV left open keeps a staff session alive indefinitely. This is accepted, because the TV is in the staff area and the session ends when the browser closes.
- Security: no long-lived token is added. The session cookie keeps its HttpOnly and SameSite rules.

**Alternatives Rejected**
- A separate long-lived TV token: rejected by the team (requirements Q2); it adds a credential that survives restarts.
- Let the stream refresh the session: it would change BR1.9 for every staff screen.

## ADR-004: Full-screen page inside the PIN gate but outside the staff navigation

**Status:** Accepted (requirements Q4)

**Context**

The TV has no input, so the navigation only takes space. The page must stay staff-only.

**Decision**

The TV wall is a registry entry whose route renders full screen. It stays under `/staff/*`, so the existing PIN gate wraps it. Only the navigation is left out.

**Consequences**
- Positive: reuses the sign-in flow unchanged; one new registry entry.
- Negative: the shell must support one page without the navigation. This is a small, isolated change.
- Security: unchanged; every `/staff/*` page is behind the gate.

**Alternatives Rejected**
- A separate top-level path outside `/staff`: it would need its own sign-in handling.
- An ordinary page inside the navigation: rejected by the team.

## ADR-005: One closed-day takings rule shared by the Sales page and the TV

**Status:** Accepted

**Context**
- "Today's takings" must equal the Sales page's total for today (AC3.1.2).
- The TV must not re-read all history (NFR6).

**Decision**
- The Sales page's closed-day money rule is made callable for one day.
- The TV calls it for today.
- The Sales page keeps calling it for every day, with unchanged output.

**Consequences**
- Positive: the two figures cannot drift; the TV reads one day.
- Negative: a small refactor inside SalesReports. The Sales page's existing tests must still pass unchanged.

**Alternatives Rejected**
- Copy the rule into the TV module: the two would drift.
- Call the full Sales read and pick today: it reads all history on every change.
