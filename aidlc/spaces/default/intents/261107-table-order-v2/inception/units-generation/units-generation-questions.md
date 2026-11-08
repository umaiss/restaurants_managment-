# Units Generation Questions

The project's plan for v2 is fixed: U5 `u5-foundation` is built first and on its own; U6 and U7 are built in parallel once U5 is signed off, each using only v1 and U5, never each other; U8 is added only if something needs both U6 and U7. From the component design (`inception/domain-design/components.md`) and the stories, nothing needs both U6 and U7 once the shared parts sit in U5, so I propose **three Units and no U8**. The proposed split is:

- **U5 `u5-foundation` (kind: service):** everything the other two Units share.
- **U6 `u6-diner-features` (kind: ui):** the diner's side of the features.
- **U7 `u7-staff-kitchen-features` (kind: ui):** the staff and kitchen side of the features.

Two decisions change how big and how risky U5 is.

## Q1. [Architect] Which Unit gives the five v1 screens the new look?

You chose the new look for every v1 screen (Menu, Cart, My orders, Kitchen Board, Table Bill and Close table). U5 builds the design system either way. This decides who applies it to the v1 screens, and what you can see when you sign off U5.

A. U5 applies it to all five v1 screens, so at U5's sign-off the whole app already has the new look and Dark mode; U6 and U7 then add features on top (Recommended)
B. Each screen's own Unit applies it (U6 the diner screens, U7 the board and bill); U5 only provides the tokens and components, so at U5's sign-off the v1 screens still look as they do today
C. Not yet defined
X. Other (please specify)

[Answer]: A. U5 applies it to all five v1 screens

## Q2. [Architect] How much of the server work should U5 hold?

A feature Unit may use only v1 and U5. Several features need the same server data from both the diner side and the staff side: item options and allergens (Make it yours, Allergy shield, Menu management), the Chef's special and its stock, waiter and bill calls, ratings, and the order itself (options, station and estimate frozen on each line). If these are not in U5, U6 and U7 would need each other.

A. U5 holds every server part that both U6 and U7 use (new database tables and columns, the order changes, specials, calls, ratings, the wait estimate, the Staff PIN and its guard on every staff route, and the new live events); each feature Unit adds only what it alone uses. U5 is the largest Unit (Recommended)
B. U5 stays small (the new look, the PIN, the app shell and the database changes); U6 and U7 each build the server parts they use, and the shared ones are pinned down in Contract Design so the two Units agree. Faster first sign-off, but a higher risk that the Units collide
C. Not yet defined
X. Other (please specify)

[Answer]: A. U5 holds every server part that both U6 and U7 use
