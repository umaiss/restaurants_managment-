# User Stories Assessment: Table Order v2

## Decision

Execute.

## Rationale

User stories add clear value here. Table Order v2 adds 17 features and a new look on top of a live ordering app, and each feature is something a person sees and uses: diners on their phones, cooks at the kitchen board, and waiters at the till. Three kinds of people with different goals touch the same orders, so the Given/When/Then criteria in the stories are what the browser tests and the mockup-match checks will be written from. The requirements (`requirements.md`) say what the app must do; the stories say who needs it and how a pass or fail looks to that person.

## Factors Considered

| Factor | Finding |
|---|---|
| Project type | Brownfield: new work on the signed-off v1 app, described in `business-overview.md` and `component-inventory.md` |
| User-facing scope | Every one of the 19 requirement groups changes something a person sees or does |
| Personas | Three: the Diner, the Kitchen staff and the Front-of-house staff (answer Q1) |
| Complexity signals | Orders cross three audiences; Kitchen stations changes when an order counts as Completed; the Staff PIN changes who may act |
| Timeline | Hand-in on Tuesday 10 November 2026, so story priority (Must, Should, Could) decides what slips first |

## Where Stories Add the Most Value

- Features with two audiences, where one person acts and another sees the result: Notifications, Call the waiter / Ask for the bill, Make it yours (the diner chooses, the kitchen reads the ticket), Chef's special drop, Rate your meal.
- Features that change v1 behaviour, where the acceptance criteria protect what must not break: Staff PIN, Kitchen stations, Dark mode.
- Features with numbers and clocks, where a precise pass or fail is needed: Honest wait time, Kitchen ticket timers, Past visits and sales.

## Approach (from your answers)

- One story per feature, about 20 in all (Q2): 19 stories, one for each requirement group.
- Grouped by feature in the order of the scope document, Must then Should then Could (Q3).
- Story IDs follow the requirement groups (`US3.1` is the story for requirement group `FR3`), so a story always traces back to its requirement.
