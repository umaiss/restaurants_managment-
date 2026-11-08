# Architecture Decisions: Table Order v2 Domain Design

Each decision follows the Inception phase rule: Context, Decision, Consequences, Alternatives Rejected. They come from the requirements (`inception/requirements-analysis/requirements.md`), the stories (`inception/user-stories/stories.md`), the code knowledge base of v1 (`aidlc/spaces/default/codekb/table-order/architecture.md`) and your two answers (`domain-design-questions.md`). Ownership stays with the team: any of these can be overturned at the approval.

## ADR-001: Extend v1's building blocks and add one for each new concern

- **Context:** v2 adds 17 features and a new look to a signed-off v1 whose layers are clean: routes call repositories, repositories own SQL, live events are in-memory. v1's tests and behaviour must keep working (FR19), and the new Units must be buildable in parallel against v1 and a shared foundation.
- **Decision:** Keep v1's building blocks (MenuCatalog, TableSessions, OrderManagement, Billing, LiveEvents, ApiRoutes, DinerApp, StaffApp) and extend them where a feature changes what they already own. Add a new component for each new concern that has its own data, rules or lifecycle (KitchenStations, ChefSpecials, ServiceCalls, DishRatings, StaffAccess, ClientPreferences, DesignSystem, Notifications) and for each read-only view that owns no data (WaitEstimation, FloorStatus, SalesReporting, TableQrCodes).
- **Consequences:** v1 code keeps its shape, so v1's tests are a reliable safety net. Each new component can be built and tested on its own. The cost is more components than a minimal change needs, and each extended v1 component (OrderManagement above all) is touched by several features, so its changes belong in the shared foundation.
- **Alternatives Rejected:**
  - *One new "Features" component holding all 17 features:* quicker to start, but it would mix menu, kitchen, billing and staff concerns, have no clear owner for any entity, and make parallel work collide in one file set.
  - *One vertical slice per feature, each with its own tables, routes and screens:* maximum independence, but features share data (menu items, orders, tables), so slices would copy or fight over the same entities.

## ADR-002: ApiRoutes runs every use case that spans components; components do not call each other sideways

- **Context:** Several features cross components: placing an order must also reserve a special's stock, record the estimate and publish events; Close table must also clear service calls; a station finishing must complete the order. If components called each other for these, MenuCatalog, OrderManagement, ChefSpecials and WaitEstimation would end up in cycles.
- **Decision:** The API layer (ApiRoutes, which v1 already uses to call a repository and then publish) is the one place that runs a use case across components, inside one database transaction where the data must change together. Components read only downward, from the component that owns the data, and the dependency graph has no cycles.
- **Consequences:** Cycles are impossible by construction, each component stays small, and Contract Design can pin each use case once. ApiRoutes grows and needs care; its use cases are tested end to end.
- **Alternatives Rejected:**
  - *Components call each other directly:* shorter code paths, but OrderManagement and ChefSpecials (stock) and WaitEstimation (estimate at placement) would call each other, and every new feature would add edges.
  - *An internal event bus between components:* decouples them, but makes the order of effects and the atomic stock update hard to reason about and to test, and v1 has no such bus.

## ADR-003: Freeze price, options and station on each order line at placement

- **Context:** Staff can now edit prices, options and stations while orders are open (FR6, FR8, FR13). v1 already freezes the price on each order line so the bill stays right. The requirements review asked what happens to a station change while an order is open, and you chose to fix the station at placement (answer Q1).
- **Decision:** At placement, each order line stores its unit price (item price plus the chosen options), the chosen options as text with their price change (OrderLineOption), and its station. Later menu edits never change an order already placed.
- **Consequences:** Bills, sales and kitchen tickets are always consistent with what the diner ordered; a station edit takes effect for new orders only. Orders store a little more data. Orders from before v2 have no station on their lines and are treated as Grill.
- **Alternatives Rejected:**
  - *Look the station and option text up live from the menu:* less stored data, but an edit or a hidden item would change a placed order, the bill, and who must cook it.
  - *Freeze only the price, as v1 does:* simplest, but a renamed option or a moved station would make the kitchen ticket disagree with what was ordered.

## ADR-004: KitchenStations owns only the "done" marks; a station's lines are derived

- **Context:** Each order must show only a station's lines on its board, and become Completed when every station with lines has finished (FR13). The station of each line is already frozen on the order line (ADR-003).
- **Decision:** KitchenStations stores one StationDone mark per order and station. A station's lines are read from the order lines; the order is Completed through OrderManagement when every station with lines has a mark. The All stations Complete button marks every remaining station at once, which keeps v1's single-board behaviour and tests working.
- **Consequences:** No per-order station rows to create or repair at placement, and no cycle between OrderManagement and KitchenStations. An order with one station behaves as in v1. A station is "waiting" when it has lines and no mark.
- **Alternatives Rejected:**
  - *Create a station-part row per order and station at placement:* explicit, but it needs OrderManagement to call KitchenStations (a cycle) and rows to be repaired if an order is cancelled.
  - *Put the done flags on OrderLine:* fewer tables, but a station's progress would be spread over lines and v1's order shape would change.

## ADR-005: The Staff PIN is checked on the server in one place, with sessions held in memory

- **Context:** v1 has no authentication and trusts the `by` field in a request (code knowledge base, Middleware). The requirements say the PIN is checked on the server for every staff route and stream, with a lockout (FR3, NFR2), and the review noted the lockout must be counted by the server.
- **Decision:** StaffAccess owns the PIN check, sessions and lockout. A correct PIN opens a staff session held in server memory and carried by a cookie that is not readable by page scripts. ApiRoutes checks the session on every staff route and on the staff stream. Wrong tries are counted by client address plus session on the server; a restart signs staff out and clears the counts. The PIN comes from `STAFF_PIN`, or is made at random and printed once; it is never logged.
- **Consequences:** Guests cannot drive staff actions from a browser console. A restart costs staff one PIN entry. The lockout is per client, so a shared address (one restaurant router) can lock out staff too; the 60 seconds keeps that short.
- **Alternatives Rejected:**
  - *Check the PIN on the screen only:* trivial, but nothing would stop a direct request; it does not meet FR3.2.
  - *Store sessions in the database:* survives restarts, but adds a table and a cleanup job for a one-restaurant app where one PIN entry after a restart is acceptable.
  - *Per-staff accounts:* stronger, but out of scope (no accounts) and not asked for.

## ADR-006: Wait estimate, floor status and sales are derived read components that own no data

- **Context:** Honest wait time, the Live floor map and Past visits and sales all combine data that other components already own (orders, visits, calls, connections).
- **Decision:** WaitEstimation, FloorStatus and SalesReporting compute their answers on request from the owning components and own no tables. The one stored value is the estimate shown at placement (`estimate_minutes` on the order, owned by OrderManagement), so "Running late" compares an order with the estimate the diner saw. The completed time (`completed_at`) is also recorded on the order.
- **Consequences:** No duplicate copies of facts to keep in step, and no new tables for these features. Computing each answer on request is cheap at one restaurant's size; an index may be added later if sales over many days become slow.
- **Alternatives Rejected:**
  - *Materialized summary tables updated on every event:* faster reads, but a second copy of every fact to keep right, and more events to publish.
  - *Compute the estimate in the browser:* no server work, but each phone would see a different number and could not know the kitchen's load.

## ADR-007: A diner's allergies, theme and sound stay in their own browser

- **Context:** Allergies are set once per diner (FR10.1); the theme and sound are personal (FR2.3, FR4.4). There are no diner accounts (out of scope), and a table's page is used by whoever sits there.
- **Decision:** ClientPreferences keeps these in the browser's storage, never on the server. Blocked storage falls back to the defaults without an error.
- **Consequences:** Nothing personal is stored on the server, and there is nothing to secure or delete. A diner who changes phone sets their allergies again, and two phones at one table keep separate settings.
- **Alternatives Rejected:**
  - *Store allergies per table visit on the server:* shared across phones, but it would tie one diner's health information to a table and expose it to the next diner of that table.

## Assumptions & Open Questions

- ADR-005 assumes the cookie for the staff session is set by the server and not readable by page scripts; Contract Design pins the exact name and lifetime.
- ADR-006 assumes sales over a few weeks stay small enough to compute on request; if that proves false, a summary table is a later, additive change.
- The exact new live event names, route paths and error codes are for Contract Design.
