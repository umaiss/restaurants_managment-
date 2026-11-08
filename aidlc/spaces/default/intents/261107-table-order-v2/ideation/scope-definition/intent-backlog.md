# Intent Backlog: Table Order v2

This backlog turns the scope document (`scope-document.md`) and the intent statement (`ideation/intent-capture/intent-statement.md`) into three groups of work, called proto-Units. Later stages turn them into the real Units. The grouping follows the project's plan for v2: a shared foundation first and on its own, then two feature groups built in parallel that depend only on v1 and the foundation, never on each other.

## Prioritised Backlog

Ranked with MoSCoW (Must / Should / Could), as chosen in Q1.

| # | Feature | Group | Rank |
|---|---|---|---|
| 1 | New look on every screen, and Dark mode | Foundation | Must (new look), Should (Dark mode) |
| 2 | Staff PIN | Foundation | Must |
| 3 | Make it yours | Diner features | Must |
| 4 | Honest wait time | Diner features | Must |
| 5 | Animated order tracker | Diner features | Must |
| 6 | Notifications | Diner features | Must |
| 7 | Allergy shield | Diner features | Should |
| 8 | "Same again" | Diner features | Could |
| 9 | Rate your meal | Diner features | Could |
| 10 | Kitchen ticket timers | Staff and kitchen features | Must |
| 11 | Kitchen stations | Staff and kitchen features | Should |
| 12 | Call the waiter / Ask for the bill | Staff and kitchen features | Should |
| 13 | Menu management | Staff and kitchen features | Should |
| 14 | Past visits and sales | Staff and kitchen features | Should |
| 15 | QR codes | Staff and kitchen features | Could |
| 16 | Chef's special drop | Staff and kitchen features | Could |
| 17 | Live floor map | Staff and kitchen features | Could |

## Proto-Units

| Proto-Unit | What it holds | Built |
|---|---|---|
| Foundation | What the other groups share: the new look as a small design system applied to every v1 screen, Dark mode, the Staff PIN, the new stored information the features need, and the new tabs or links to reach new screens | First, on its own |
| Diner features | The features a diner sees on the Menu, Cart and My orders screens | In parallel with Staff and kitchen features, after the Foundation is signed off |
| Staff and kitchen features | The features staff and the kitchen see: boards, menu and special management, sales, floor map, QR codes | In parallel with Diner features, after the Foundation is signed off |

## Dependencies and Shared Seams

- Both feature groups need only v1 and the Foundation. Where they both touch the same thing, the Foundation or the contract design owns it, so neither group needs the other.
- Things both groups touch, to settle in Units Generation and Contract Design: the options and allergy information on menu items (Make it yours, Allergy shield, Menu management); the station each item belongs to (Kitchen stations); the Chef's special shown on the menu (Chef's special drop); the estimated wait (Honest wait time, Animated order tracker); and the waiter and bill calls (Call the waiter / Ask for the bill, Live floor map).
- Kitchen stations changes when an order counts as Completed, which the Animated order tracker and Notifications read. This is the one dependency most likely to need a shared rule in the Foundation.
- Nothing needs a fourth group yet. If two features turn out to need both groups, a final group is added after the parallel ones have merged.

## Sequencing

Value-first within each group: Must items before Should before Could. The Foundation comes first because both groups depend on it.

## Assumptions & Open Questions

- The three groups above are a proposal for Units Generation to confirm; the final split is decided there.
- The ranking is the one in `scope-document.md` and is waiting for your acceptance at this stage's approval.
