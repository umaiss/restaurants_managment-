# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

These rules were set by the workshop team during the 2026-10-30 dry run, and tightened on 2026-11-02 so the whole run fits in 5 hours. On 2026-11-05 the facilitator added the rules for the follow-up exercise.

**Which rules apply to which piece of work**

This project holds two pieces of work:
- **v1, the workshop run:** the piece of work built from `ideas/table-order/IDEA.md`.
- **v2, the follow-up exercise:** the piece of work built from `ideas/table-order-v2/IDEA.md`.

A rule marked **(v1 only)** applies only to v1, and a rule marked **(v2 only)** only to v2. Every other rule applies to both.

**Questions to the team**
- **Every team gets the same questions (v1 only).** (Added by the workshop team on 2026-11-04.)
  - At each stage the AI asks exactly the questions in `ideas/table-order/QUESTIONS.md` for that stage, in that order, with the same wording and the same lettered options, the recommended one first.
  - It writes them into the stage's question file as they are, and asks no questions of its own. The one exception is a single follow-up when an answer is unclear or contradicts an earlier one.
  - Where a stage lists no questions, it asks none.
  - Where a scripted question assumes something a team's earlier answers changed, the AI still asks it as written and adds one sentence saying what it assumes.
  - At each decision point it expects the reply the script names.
- **Each team chooses its own work (v2 only).**
  - There is no question script. `ideas/table-order/QUESTIONS.md` belongs to v1 and is never used in v2.
  - The AI writes its own questions from the v2 brief and the team's earlier answers, within the v2 limits below.
  - Intent Capture opens with which features and which X-factor the team picks. Scope Definition confirms that list, and asks whether the team wants to change any v1 screen or behaviour (see "Protecting v1").
- Every question offers lettered options.
- The recommended option comes first and is marked "(Recommended)".
- Each Code Generation plan-approval question is asked on its own, never bundled with another question, because AI-DLC only records a plan approval given as a reply to that question alone.
- The run stays at Standard depth (full documents and tests), but asks only the questions whose answer changes what gets built. Most per stage:

  | Stage | Most questions, v1 | Most questions, v2 |
  |---|---|---|
  | 1.1 Intent Capture | 6 | 6 |
  | 1.4 Scope Definition | 5 | 5 |
  | 2.3 Requirements Analysis | 5: the brief's open questions come first | 6: the brief's open questions come first |
  | 2.4 User Stories | 2 | 3 |
  | 2.5 Refined Mockups | 3 | 4 |
  | 2.6 Domain Design | 2 | 2 |
  | 2.7 Units Generation, 2.8 Contract Design, 2.9 Delivery Planning | 1 each | 2 each |
  | 3.1 Functional Design | 1 per Unit, only for a gap the earlier answers leave open | 2 per Unit, only for a gap the earlier answers leave open |
  | 3.5 Code Generation, 3.6 Build and Test | none besides the plan approval and the sign-off | none besides the plan approval and the sign-off |

- Anything the brief or an earlier answer already settles is never asked.
- For every other open point, the AI chooses the recommended option itself and lists it under Assumptions & Open Questions, so the team accepts the list in one reply or turns an item back into a question.
- A follow-up is asked only when an answer is unclear or contradicts an earlier one.

**Review findings**
- Every finding from a specialist review is fixed before the work moves on, whatever its severity:
  - design and inception findings are fixed in the documents before the next step;
  - code review findings are fixed in the Unit, or written into the next Bolt's code plan as its first step.
- Who decides the fix:
  - **Minor:** the AI decides and fixes it without asking.
  - **Major:** the first Major finding of the whole run, in whichever stage it appears, goes to the team, who decide its fix at the gate. Before asking about a Major finding, the AI checks the earlier stages' question files; once the team has decided one Major finding in this run, the AI decides and fixes every later Major finding itself.
  - **Critical:** always goes to the team.
- At each gate, the AI lists the findings it fixed itself in plain words, so the team sees what changed.
- **Bugs the tests catch during a build** are shown at that Unit's sign-off, next to the review findings. (Added by the workshop team on 2026-11-04.)
  - For each bug, the sign-off says in plain words what went wrong, where it was fixed (file and lines), and the name of its regression test.
  - Each bug gets its own regression test named "regression: …". The test is checked to fail without the fix.
  - The Unit's `code-summary.md` lists them under "Bugs found by the tests and fixed".

**Protecting v1 (v2 only)**
- v1 stays exactly as it was signed off until the team chooses to change it. A v1 screen, behaviour, API, data field or test changes only when the team picked that change in a Scope Definition question.
- The scope document lists every chosen change under "Changes to v1": the screen or behaviour, what changes, and why. Anything not on that list is left alone.
- v1's records (its own folder under `aidlc/spaces/default/intents/`, with its documents, mockups and question files) are never edited. v2 writes everything into its own record. Where v2 changes a v1 screen, it makes a new mockup in its own record, and the v1 mockup stays as it was.
- v1's tests stay in the suite and keep passing. A v1 test is changed only when a chosen change makes it out of date. The change is listed in that Unit's `code-summary.md` under "v1 tests changed", with the reason.
- Database changes only add: new tables or new columns with defaults. v1 data is migrated, never wiped, and v1's seed data still loads.
- Reverse Engineering reads the v1 code before Requirements Analysis, so the plans build on what is there.

**Construction: Bolt 1 alone, then Bolts 2 and 3 in parallel, then Bolt 4 alone (v1 only)**

Updated by the workshop team on 2026-11-03.
- The app is split into exactly **4 Units**, built as exactly **4 Bolts**, one Bolt per Unit. Units Generation and Delivery Planning keep to this split, never more and never fewer:
  - Bolt 1: U1 `u1-walking-skeleton`, the walking skeleton;
  - Bolt 2: U2 `u2-diner-screens`, the diner's Menu, Cart and My orders screens;
  - Bolt 3: U3 `u3-kitchen-board`, the kitchen board;
  - Bolt 4: U4 `u4-bill-and-close`, the table bill and Close table.
- Bolt 1, the walking skeleton, is built first and on its own, in the main folder, and the team signs it off.
- Bolts 2 and 3 are then built in parallel, each in its own git worktree, using AI-DLC's parallel Construction. Bolt 4 is built on its own after they have merged and been signed off.
  - The team asks for it at the Delivery Planning gate ("Build Bolt 1 on its own, then Bolts 2 and 3 in parallel, then Bolt 4 on its own"). The AI then runs `aidlc engine state set-construction-iteration stage-major` and `aidlc engine state set-construction-execution swarm`.
  - AI-DLC builds Units in the order of the Units Generation edge block, so Bolt 4's Unit lists Bolts 2 and 3's Units under `depends_on`. This is a build-order edge chosen by the team: Bolt 4's code still uses only the walking skeleton.
  - The workshop dashboard reads the Bolts from the table at the top of `bolt-plan.md`, one row per Bolt: `| <Bolt number> | <name> | U<n> \`<unit-directory>\` | … |`. Each row carries its Code Generation timebox as "<N> min", so the dashboard shows each Bolt's timer and its progress bar: Bolt 1 45 min, Bolts 2 and 3 30 min each, Bolt 4 25 min.
  - After Bolt 1's sign-off, the AI asks the team once to commit the approved work, because the parallel Bolts start from that commit.
  - Functional Design runs for every remaining Unit first: its questions come one Unit after another, within the question limits above. Then there is one grouped code-plan approval, then the parallel build.
  - After the Bolts merge back, the AI runs the Unit checkpoint routine in the main folder on the merged app: all the tests, the mockup match for every Unit and the code review. Only then does it open the app, with test steps for every Unit.
  - When AI-DLC asks how to continue after Bolt 1, the team's choice is "Review each checkpoint", so the team signs off the parallel Bolts together.
- If the parallel build fails, the team says "build them one at a time instead"; the approved plans are kept.

**Construction: Bolt 5 alone, then Bolts 6 and 7 in parallel, then Bolt 8 if needed (v2 only)**
- v1's Units (U1 to U4) and Bolts (1 to 4) are done and are never planned again. v2's Units are numbered from U5, with one Bolt per Unit and the same number: Bolt 5 builds U5, and so on.
- v2 has 3 or 4 Units:
  - **Bolt 5:** U5 `u5-foundation`, v2's walking skeleton. It holds everything v2's other Units share: database changes, new API routes and live events, new tabs or links in the app shell, and the design system if the team chose a design change. It is built first and on its own, in the main folder, and the team signs it off.
  - **Bolts 6 and 7:** U6 and U7, the features and the X-factor, grouped so that each Unit's code uses only v1 and U5, never the other. They are built in parallel, each in its own git worktree, once Bolt 5 is signed off and committed.
  - **Bolt 8 (only if needed):** U8, for work that needs both U6 and U7, built on its own after they have merged and been signed off.
- At the Delivery Planning gate the team asks for "Build Bolt 5 on its own, then Bolts 6 and 7 in parallel, then Bolt 8 on its own" (or without Bolt 8). The AI then runs `aidlc engine state set-construction-iteration stage-major` and `aidlc engine state set-construction-execution swarm`.
- `bolt-plan.md` opens with the same table as v1, one row per Bolt: `| <Bolt number> | <name> | U<n> \`<unit-directory>\` | … |`. v2's Bolts have no Code Generation timebox (removed by the team on 2026-11-05), so the rows carry no "<N> min" and the dashboard shows no Bolt timer.
- Everything else works as in v1: the commit after Bolt 5's sign-off, Functional Design for every remaining Unit before one grouped code-plan approval, the checkpoint routine in the main folder after the merge, "Review each checkpoint" after Bolt 5, and "build them one at a time instead" if the parallel build fails.

**Screen design (Refined Mockups and every Unit that builds a screen)**

Added by the workshop team on 2026-11-03.
- **Diner screens:**
  - Menu, Cart and My orders are tabs in a bar fixed at the bottom of the screen, always in reach of the thumb, never at the top.
  - The current tab is highlighted, and the Cart tab shows the number of items in the cart.
  - The cart summary ("View cart") and "Place order" sit just above that bar.
- **The Menu:**
  - Each item card shows its image on the left, then the name, description and price. A small "+ Add" pill sits at the far right of the card's price row. It looks about 32 px tall but keeps a 44 px touch area.
  - It opens with navigation pills for its categories (Starters, Mains, Desserts, Drinks) in a bar that stays at the top while the diner scrolls.
  - A pill scrolls smoothly to its category, and the pill of the category on screen is filled in.
- **Look and feel:**
  - The screens look smooth and professional: consistent spacing, rounded cards with soft shadows, clear type with aligned prices, frosted sticky bars, and gentle transitions on hover, press and live changes.
  - All motion stops when the device asks for reduced motion.
  - The mockups are never plain wireframes.
- **The built app** matches these mockups, bottom tab bar and category pills included.
- **In v2:**
  - New screens follow these rules and v1's look, unless the team chose a design change.
  - A design change is made once, as a design system in U5 (colours, type scale, spacing, radius, shadows, components), and every changed screen uses it. Screens the team did not choose to change keep v1's look.
  - The bottom tab bar, the sticky category pills, the 44 px touch areas, reduced motion and keyboard access stay, whatever the design change.

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

- The walking skeleton (Unit 1) carries everything the other Units share: the data model, the order API, the live event stream, and the app shell with its navigation.
- Every other Unit's code depends only on the walking skeleton, never on another Unit, so each can be built in parallel after it. The order the team chose for building them (Bolts 2 and 3 together, then Bolt 4) is written as build-order edges in the edge block.
- Where two Units would need each other, Units Generation moves the shared part into the skeleton or pins it down in Contract Design.
- In v2, the finished v1 app is the base every Unit builds on, and U5 `u5-foundation` is v2's walking skeleton: v2's other Units depend only on v1 and U5.
- The skeleton's server must work from any folder, because parallel Bolts are built in worktrees under `.aidlc/worktrees/`, a dot-folder. Express refuses `res.sendFile` with an absolute path that passes through a dot-folder, so the screen routes serve the page with `res.sendFile('index.html', { root: distDir })`, never `res.sendFile(<absolute path>)`. (Added by the workshop team on 2026-11-03, after every page route failed in the parallel Bolts' worktrees.)

## Testing Posture

<!-- Project-specific specialisation. -->

These notes add to the methodology the framework sets; they don't change it.
- **Browser tests:** besides unit and integration tests, every Unit adds Playwright tests in `e2e/<unit>/` for its main flows. The walking skeleton installs Playwright with Chromium.
- **Verification command:** `npm test && npm run test:e2e`.
  - `npm test` writes `test-results/unit.json` and `coverage/coverage-summary.json`.
  - `npm run test:e2e` writes `test-results/e2e.json`.
  - The workshop dashboard reads these files.
- **Mockup match:**
  - Every Unit adds `e2e/<unit>/mockup-match.spec.ts`. For each refined mockup the Unit builds, it sets up the same state and checks that the screen shows the mockup's headings, labels, buttons, messages and status words.
  - It saves the mockup and app screenshots side by side in `test-results/mockup-match/<unit>/`.
  - Parts that a later Unit owns are left out of the comparison and listed.
- **Browsers checked at Build and Test:**
  - Chromium, the installed Google Chrome, and WebKit (Safari's engine).
  - Firefox is not installed or tested.
  - Build and Test also adds a keyboard-only test of the whole journey, for NFR6.
- **Ports and database:** every port and the SQLite database file come from environment variables, so Bolts built in parallel never share either:
  - `PORT`, default 3000: the app the team uses, in the main folder only.
  - `E2E_PORT`, default 3100: the browser tests. Specs that need their own server use `E2E_PORT` + 100 and + 200 (3200 and 3300 by default).
  - `DB_FILE`: the database file.
  - Each parallel Bolt runs its tests with its own `E2E_PORT`: 4100, 5100, 6100 and 7100, in batch order. It also uses its own `DB_FILE` inside its worktree.
- **In v2,** the verification command runs v1's tests and v2's together, so every Bolt also proves v1 still works.
- **A flaky test** is fixed in the test code; a threshold is never lowered.

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER open the app in the browser for the team before the Unit's tests and mockup match have passed (affirmed 2026-10-30)
- NEVER install Firefox for testing; check Chrome and Safari (WebKit) only (affirmed 2026-10-30)
- NEVER lower a coverage threshold or a timed-test limit to make a check pass (affirmed 2026-10-30)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS include, in every Unit's Code Generation plan, Playwright browser tests for the Unit's main flows and a mockup-match spec for every refined mockup the Unit builds (affirmed 2026-10-30)
- ALWAYS run the Unit checkpoint routine in this order before asking the team to sign off a Unit or to try it: (1) run `npm test && npm run test:e2e`, (2) run the mockup match and look at every screenshot pair, fixing any difference the Unit owns, (3) have the code reviewed, (4) share the results, then start the app and open it in the browser, with step-by-step test instructions (affirmed 2026-10-30)
- ALWAYS run the tests yourself; the team never runs tests by hand (affirmed 2026-10-30)
- ALWAYS stop the app on port 3000 before a Unit's build, and start it again only after that Unit's tests pass (affirmed 2026-10-30)
- ALWAYS give each Unit's mockup-match screenshots their own folder, `test-results/mockup-match/<unit>/` (affirmed 2026-10-30)
- ALWAYS read every port and the database file from environment variables (`PORT`, `E2E_PORT`, `DB_FILE`) and give each parallel Bolt its own `E2E_PORT` and `DB_FILE`, so Bolts built at the same time never share a port or a database (affirmed 2026-11-02)
- ALWAYS run the checkpoint routine again in the main folder after parallel Bolts merge back, before the team tries them (affirmed 2026-11-02)
## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
