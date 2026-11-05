# Decisions — Domain Design

**Based on:** `components.md` from this stage, `requirements.md` from `inception/requirements-analysis/`, `stories.md` from `inception/user-stories/`.

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

---

## ADR-001 — Split the server into eight components around the walking skeleton

### Context

The brief ships three features (order from the table, live kitchen board, bill and close) and the project rules build the system as four Bolts: U1 walking skeleton, then U2 and U3 in parallel, then U4. The choice is how to decompose the server side so that:
- every invariant lives in exactly one place,
- U1 can ship a minimal end-to-end skeleton that U2/U3/U4 depend only on,
- U2, U3 and U4 can be built in parallel (U4 after U2/U3) without cross-Unit refactors,
- there are no dependency cycles.

Three options were considered.

### Options considered

#### Option A — Eight components (RECOMMENDED)

`Menu`, `Tables`, `Ordering`, `Billing`, `LiveUpdates`, `DinerApp`, `StaffApp`, `Platform`.

- **Pros:** Each business rule lives in one place (ordering state machine in Ordering, availability in Menu, close rules in Billing). Dependencies are acyclic and point to Platform. U2/U3 can be built in parallel because they consume disjoint parts of Ordering/Menu. U4 depends only on Ordering+Tables (both frozen in U1) and Billing (new in U4). LiveUpdates is a port, not a hub.
- **Cons:** More components means more boundaries, but each boundary is small and already implied by the brief.

#### Option B — Merge Tables and Billing into Ordering

`Menu`, `OrderingAndBilling`, `LiveUpdates`, `DinerApp`, `StaffApp`, `Platform`.

- **Pros:** Fewer inter-component calls on the server. One place for order + bill + close.
- **Cons:** `OrderingAndBilling` is a large component with two very different responsibility sets (order state machine vs bill/close rules). Any U4 change risks U2/U3 regressions. Parallel U4 against U2/U3 becomes risky because they all touch the same component. Closing-with-open-orders rule has to be tested where Ordering invariants live, blurring ownership.

#### Option C — One "Restaurant" server component plus Platform and UIs

`Restaurant`, `LiveUpdates`, `DinerApp`, `StaffApp`, `Platform`.

- **Pros:** The simplest wiring. One file to find any rule.
- **Cons:** Every business rule in one place, so every change ripples through every Unit. Parallel build of U2/U3/U4 is essentially a parallel build of the same file. Testing ownership is unclear. Future extension (payments, multi-restaurant) would require splitting anyway.

### Decision

**Adopt Option A.** It is the only split that:
- maps 1:1 to the Unit DAG the project rules fix (Bolt 1 skeleton → Bolts 2/3 parallel → Bolt 4),
- keeps every invariant in a single owner,
- is acyclic and lets LiveUpdates stay a pure port.

### Consequences

- Positive: Bolts 2 and 3 can be built in parallel with minimal merge risk because they touch different server components (U2: Menu + Ordering reads; U3: Ordering transitions + Menu availability). U4's Billing is new code and does not change U2/U3's components.
- Positive: Testing ownership is sharp: ordering state-machine tests live with Ordering, bill totals with Billing, availability with Menu.
- Negative: Eight components is more boundaries than three; each boundary needs its own contract (resolved in Contract Design).
- Reversible: If a Unit later outgrows a component (e.g. Ordering grows a workflow engine), splitting is straightforward because owners are already sharp.

### Alternatives rejected

- **Option B** (merge Tables+Billing into Ordering) — rejected because it breaks parallel U4 and blurs invariants.
- **Option C** (one Restaurant component) — rejected because it defeats the parallel-build goal of the project rules.

### Compliance and security implications

- The app runs locally only; no cloud dependency. [NFR3]
- No login or PIN during the workshop; the app is on a local machine only. [Q3 of requirements-analysis]
- All interactions are over `localhost`; no external service calls. [phase: construction]
- No credentials, API keys or secrets stored in code; environment variables govern PORT, E2E_PORT and DB_FILE. [phase: construction]

### Trace

- Enables: FR1.1–FR5.2, NFR1–NFR6.
- Required by: project rule "Walking Skeleton — Unit 1 carries everything the other Units share".

---

## ADR-002 — LiveUpdates uses Server-Sent Events with a 1-hour ring buffer

### Context

The brief chooses Server-Sent Events for live updates. Diners' and staff screens need reconnect behaviour with event catch-up. The team's Testing Posture requires every port and DB file to come from environment variables.

### Options considered

- **A. Server-Sent Events + 1-hour per-channel ring buffer** (RECOMMENDED): the brief's choice, one-way server-to-client fit, auto-reconnect built into the EventSource API, catch-up via a `Last-Event-ID` header against the buffer.
- **B. WebSockets**: bidirectional and heavier; the app has no client-to-server live channel, so the extra complexity is not justified.
- **C. Polling every 2 seconds**: satisfies the 2-second rule naively but creates constant load and does not meet the "within 2 seconds" bound reliably.

### Decision

Server-Sent Events with a per-channel ring buffer that retains the last hour of events. The buffer sits in LiveUpdates and is replayed when a client reconnects with a `Last-Event-ID`.

### Consequences

- Positive: Meets FR4.1 (2-second delivery) and FR4.2 (reconnect + replay) directly.
- Positive: No separate protocol handler; stock Express can host SSE.
- Negative: In-memory buffer means a server restart loses the buffer; acceptable for a workshop app that runs locally only. If a restart happens, clients reconnect and resync from the current state. [NFR3]

### Alternatives rejected

- B rejected (unnecessary complexity).
- C rejected (poor user feel and higher load).

### Trace

- Enables: FR4.1, FR4.2, NFR1, NFR2.

---

## ADR-003 — Order state machine owns the only source of truth for status

### Context

Order status drives both the diner's "My orders" view and the staff Kitchen Board. Multiple requirements and stories touch it (FR1.8, FR2.4, FR2.5, FR2.6, US3.2, US6.1, US6.2). Any duplication would cause divergent behaviour.

### Options considered

- **A. Ordering owns the state machine; UI reads status** (RECOMMENDED).
- **B. StaffApp owns the transition rules; Ordering is a passive data store**: UI logic drifts from server invariants.
- **C. A shared helper library both server and UI import**: works but duplicates ownership; two places to change.

### Decision

Adopt Option A. The state machine lives in Ordering as part of its domain. UI components call transition APIs (`startPreparing`, `markCompleted`, `cancel`) and receive the updated status; they never decide the transition themselves.

### Consequences

- Positive: One place to express allowed transitions and refusals.
- Positive: Testing the state machine lives with Ordering.
- Negative: UI must handle the refusal case (e.g. racing Cancel vs Start preparing) by showing the live status.

### Alternatives rejected

- B and C rejected (they duplicate ownership and allow drift).

### Trace

- Enables: FR1.8, FR2.4, FR2.5, FR2.6, US3.2, US6.1, US6.2.
