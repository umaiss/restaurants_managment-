# Units of Work — Manager TV Wall

The building blocks in `inception/domain-design/components.md` (with the decisions in `decisions.md`) are grouped into two Units, built one after the other (Q1). The Units implement the requirements in `inception/requirements-analysis/requirements.md` and the stories in `inception/user-stories/stories.md`.

v1's Units (U1 to U4) and v2's Units (U5 to U7) are finished, so this work starts at U8. Both Units ship inside the existing app: one Node process, one SQLite file and one browser app. Nothing is deployed separately.

| Unit ID | Directory | Kind | Complexity | Deployment |
|---|---|---|---|---|
| U8 | `u8-tv-foundation` | service | M | Embedded in the existing app |
| U9 | `u9-tv-wall-screen` | ui | M | Embedded in the existing app |

## U8 — `u8-tv-foundation` (walking skeleton)

**Description:** the smallest working slice of the TV wall, end to end.
- A signed-in staff member opens "TV wall" from the staff navigation and sees a plain full-screen page.
- The page lists today's open orders and today's figures from the new summary read, and updates live.
- The "Show takings on TV" switch in the navigation shows and hides the money on it.

**Components:**
- New: TvSettings, TvWallSummary, TvWallApi, TvTakingsSwitch.
- Extended:
  - StaffShell: registry entry, full-screen route, link and switch.
  - StaffLiveStream: new event name.
  - StaffAccess: the summary read refreshes the session.
  - SalesReports: the closed-day takings rule.
- A first, plain version of TvWallScreen.

**Responsibilities:**
- A new additive upgrade step adds the settings table. The setting reads as off when the row is missing, so takings are hidden on fresh and upgraded databases.
- The cross-table "today" reads live where the data already lives:
  - today's open orders, order counts per table and portions per dish go in the order repository;
  - open requests across all tables go in the service-call repository;
  - the sum of open visits' live bills goes in the billing repository.

  These repositories become "existing, extended", which settles domain-design review finding R-01.
- The Sales page's closed-day takings rule moves out of `src/server/routes/u7/sales.ts` into a shared module that reads only the asked day. The Sales route and the TV summary both call it, and the Sales page's output is unchanged (R-03).
- The summary answer carries:
  - today's open orders, listed whatever day they were placed (R-04);
  - takings and on open tables, only while the setting is on;
  - the busiest table and the top dish;
  - open requests;
  - the current setting value;
  - the server time.
- Staff-only routes:
  - read the summary, which refreshes the idle timer;
  - read the setting;
  - change the setting, saved first and then announced with a "TV settings changed" event that carries the new value (R-02).
- The navigation gains the "📺 TV wall" link and the "Show takings on TV" switch.
- The plain TV wall page:
  - lives at `/staff/tv` inside the PIN gate, without the navigation;
  - re-reads on order, table, request and setting events, and on reconnect;
  - combines a burst of events into one read (one read in flight, at most one waiting);
  - re-reads at least every 5 minutes, and at local midnight (R-04, R-05).
- Browser tests in `e2e/u8-tv-foundation/` for the main flows and `mockup-match.spec.ts` for `staff-nav-switch.html`. The TV wall mockups belong to U9 and are left out of U8's comparison.

**Implementation notes and constraints:**
- Routes are mounted after the staff guard.
- Page routes serve `index.html` with `{ root: distDir }`.
- Ports and the database file come from `PORT`, `E2E_PORT` and `DB_FILE`.
- No colour outside `tokens.css`.
- Existing v1 and v2 tests that the new route module, the new event name, the upgrade step or the navigation entry make out of date are changed and listed with reasons in U8's `code-summary.md` (NFR8).

## U9 — `u9-tv-wall-screen`

**Description:** the finished TV wall, exactly as the refined mockups draw it.

**Components:** TvWallScreen (finished).

**Responsibilities:**
- The two-column layout at 1920 by 1080, with at least 8 order rows, "+N more", the "Slow" (from 8 min) and "Late" (from 15 min) words and bars, and the oldest-wait tile with its red outline.
- The takings tile with "Takings hidden", the busiest table and top dish tiles with their empty wording, and the requests strip (Could).
- The header's "Live" and "Reconnecting… last update HH:MM" states, the loading skeleton and the first-read error message.
- Minutes recounted every 15 seconds on the server's clock.
- TV-only type sizes (80 and 72 px figures, 32 px minimum).
- Dark and light themes, and no motion when reduced motion is requested.
- Browser tests in `e2e/u9-tv-wall-screen/`:
  - the main flows;
  - the 7, 8, 14 and 15 minute boundaries;
  - contrast in both themes;
  - reduced motion;
  - `mockup-match.spec.ts` for `tv-wall-busy.html`, `tv-wall-hidden.html`, `tv-wall-empty.html` and `tv-wall-reconnecting.html`.

**Implementation notes and constraints:**
- U9 uses only U8's routes and events, and the project as it stands.
- The TV-only sizes are scoped to the TV page so no other screen changes.
