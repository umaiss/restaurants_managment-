# Bolt Plan: Table Order v2

A **Bolt** is one build pass over a piece of the work, ending in something that runs. v2 has three Units (U5, U6, U7), so three Bolts, numbered from 5 because v1's Bolts 1 to 4 are done and are never planned again. This plan is built from the Units (`inception/units-generation/unit-of-work.md`, `unit-of-work-dependency.md`, `unit-of-work-story-map.md`), the contracts (`inception/contract-design/contract-summary.md`), the requirements (`inception/requirements-analysis/requirements.md`), the stories (`inception/user-stories/stories.md`), the mockups (`inception/refined-mockups/mockups.md`), the component catalogue (`inception/domain-design/components.md`) and the team's rules in `aidlc/spaces/default/memory/project.md`.

## The Bolts

The Bolt table is the workshop dashboard's source: one row per Bolt with the Bolt number, name and Unit directory. v2's Bolts have no time limit, so the rows carry no minutes.

| Bolt | Name | Unit | Ports / DB |
|---|---|---|---|
| 5 | u5-foundation | U5 `u5-foundation` | main folder; PORT=3000, E2E_PORT=3100 |
| 6 | u6-diner-features | U6 `u6-diner-features` | worktree; E2E_PORT=4100, worktree-local DB_FILE |
| 7 | u7-staff-kitchen-features | U7 `u7-staff-kitchen-features` | worktree; E2E_PORT=5100, worktree-local DB_FILE |

## Build Order and Construction Mode

- **Build order:** Bolt 5 alone, then Bolts 6 and 7 in parallel. There is no Bolt 8: nothing needs both U6 and U7. (Planning answer Q1.)
- **Construction mode:** stage by stage, with the parallel build for Bolts 6 and 7 (`Construction Iteration: stage-major`, `Construction Execution: swarm`).
- **Bolt 5** is built first and on its own, in the main folder, and the team signs it off. After its sign-off the AI asks once to commit the approved work, because Bolts 6 and 7 start from that commit.
- **Functional Design** runs for Units U6 and U7 next, one after the other, before one grouped code-plan approval; then Bolts 6 and 7 are built at the same time, each in its own separate copy of the project (a git worktree) with its own `E2E_PORT` and database file.
- After Bolts 6 and 7 merge back, the checkpoint routine runs again in the main folder on the merged app (all the tests, the mockup match for every Unit and the code review) before the app is opened for the team.
- If the parallel build fails, the team says "build them one at a time instead" and the approved plans are kept.
- After Bolt 5 the team's choice is "Review each checkpoint", so Bolts 6 and 7 are signed off together.

## Bolt 5: Foundation (U5 `u5-foundation`), the walking skeleton

- **What it holds:** everything U6 and U7 share. The new look on all five v1 screens and Dark mode; the Staff PIN (screen, server guard, lockout); the staff app shell with side navigation and a placeholder page per staff page; every new database table and column and the seed options; menu data (options, allergens, stations, hidden items); the order changes (options, frozen price and station, Completed time, estimate); the Chef's special engine; the call and rating engines; the wait estimate; the new live events and the shared alert logic; the test helpers and the registries U6 and U7 fill.
- **Walking-skeleton marker:** yes. It proves the whole v2 stack end to end: a diner can place an order with options on a new-look Menu, staff sign in with the PIN and see it on the new-look Kitchen Board and move it on, a special, a call and a rating each work through their routes and live events, and everything works in both themes.
- **Definition of Done:**
  - `npm test && npm run test:e2e` passes, with v1's tests and U5's together; every v1 test that had to change (for the staff guard) is listed under "v1 tests changed" in U5's `code-summary.md`.
  - U5's mockup-match spec passes for the screens U5 builds (the design system page, the PIN screen, and the Menu, Cart, My orders, Kitchen Board and Table Bill in the new look), with parts that U6 and U7 own left out and listed.
  - A v1 database file starts under v2 with all its data and the seed still loads with 10 tables, 4 categories and 12 items.
  - The keyboard-only journey passes for the PIN and shell.
  - The team has seen the app in both themes and signed Bolt 5 off.
- **Confidence hypothesis:** shipping Bolt 5 proves that the shared parts are real and that U6 and U7 can be built against them without needing each other: the contracts hold up in running code.
- **Expected demo:** open the app on a light device and a dark device; place an order with options; sign in with the PIN; move the order along; launch a special with a test helper; see each effect on the other screen.
- **Real integrated check:** `npm test && npm run test:e2e` (the verification command below), plus the mockup match for U5's screens.
- **Prerequisites:** none other than v1 as it stands.

## Bolt 6: Diner features (U6 `u6-diner-features`)

- **What it holds:** Make it yours (options sheet, cart lines, refresh notice), Allergy shield (chips, marks, warning), Honest wait time (estimate in the Cart and on orders, "Running late"), the Animated order tracker, the diner ready banner, "Same again", the call card, the Chef's special card, Rate your meal, and the Settings sheet.
- **Definition of Done:** `npm test && npm run test:e2e` passes in its own copy of the project with only v1 and U5; the mockup-match spec passes for `diner-item-options`, `diner-settings`, `diner-closed-rate` and the U6 parts of `diner-menu`, `diner-cart` and `diner-orders`; each of U6's story criteria in `unit-of-work-story-map.md` passes; every feature in U6 is built (planning answer Q2: everything before sign-off).
- **Confidence hypothesis:** shipping Bolt 6 proves the diner side works against U5 alone, and that a menu change, a special, a call and a rating made through U5's helpers show up correctly for the diner.
- **Expected demo:** a diner customises a burger, sees an allergy warning, places the order, watches the tracker move, hears the ready banner, taps "Same again", calls the waiter, and rates the meal.
- **Real integrated check:** the verification command, run in Bolt 6's copy with `E2E_PORT=4100`.

## Bolt 7: Staff and kitchen features (U7 `u7-staff-kitchen-features`)

- **What it holds:** the station boards and completion, ticket timers, the new-order alert, call Respond and the pulse, the floor map, Menu management, the Chef's special page, Past visits and sales (with ratings), QR codes, and option lines on the bill.
- **Definition of Done:** `npm test && npm run test:e2e` passes in its own copy with only v1 and U5; the mockup-match spec passes for `staff-station`, `staff-floor`, `staff-menu`, `staff-special`, `staff-sales`, `staff-qr` and the U7 parts of `staff-board` and `staff-bill`; each of U7's story criteria passes; every feature in U7 is built.
- **Confidence hypothesis:** shipping Bolt 7 proves the staff side works against U5 alone, and that orders, calls, specials and ratings made through U5's helpers show up correctly for staff.
- **Expected demo:** staff sign in, see a new order alert and a calling table, finish it station by station, edit the menu and see it change live, launch a special, watch the floor map change, open the sales page and print the QR codes.
- **Real integrated check:** the verification command, run in Bolt 7's copy with `E2E_PORT=5100`.

## After Bolts 6 and 7 Merge

The merged app runs the whole verification command and the mockup match for every Unit, plus Build and Test's keyboard-only journey, the Chrome and WebKit checks, and the end-to-end journey from a diner's order to a closed table with ratings. Only then does the AI open the app for the team, with test steps for every Unit.

## Verification Command

`npm test && npm run test:e2e`. It runs the unit tests with coverage and the Playwright browser tests in `e2e/<unit>/`, v1's and v2's together, so every Bolt also proves v1 still works. It needs the installed Chromium and does not run Firefox (never installed or tested) or WebKit, which Build and Test adds at the end.

## Assumptions & Open Questions

- Bolt 5 is large (XL). Planning answer Q2 is to build everything in a Unit before its sign-off, so a slow Bolt 5 delays both parallel Bolts; see `risk-and-sequencing-rationale.md`.
- The test PIN and `STAFF_PIN` are set in the test setup, never in source files.
- The 13 open review findings on Contract Design and the other accepted review findings are carried into Functional Design and the code plans (see `risk-and-sequencing-rationale.md`).
