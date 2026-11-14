# User Stories — Story Plan and Questions

Built on `inception/requirements-analysis/requirements.md` and the code knowledge base (`business-overview.md`, `component-inventory.md`).

## Story Plan

- **Personas:** the manager at the pass and the front-of-house staff member (requirements.md, Intent Analysis). Diners appear only as the people the hide-takings setting protects; they get no stories of their own.
- **Format:** "As a [persona], I want [goal], so that [benefit]", INVEST, with Given/When/Then acceptance criteria.
- **Priority:** MoSCoW from the scope document; the Could-have waiter and bill requests (FR9) get a Could story.
- **Settled without asking** (the review's minor points on the requirements, decided with the recommended option and listed in stories.md under Assumptions):
  - at least 8 order rows show at 1920 by 1080 before "+N more" appears; the headline figures win any space conflict;
  - every change shows within 2 seconds for 95% of changes (one rule for FR7.1 and NFR3);
  - "items" means portions; waits are worked out from the server's clock;
  - each figure counts by the day its order was placed (busiest table, top dish, on open tables) or its table was closed (today's takings);
  - the speed target is checked by reading only today's rows;
  - the TV wall's own data reads count as staff activity, which keeps it signed in; the test change this causes is listed.

## Q1. [Product owner] Where do staff flip the "Show takings on the TV" switch?

Context: the product review flagged that the switch's place was only assumed. Your scope says the only v1 or v2 change is the navigation link, so wherever it goes is a choice you make here.

A. In the staff navigation, directly under the new "TV wall" link, and listed as a v1/v2 change next to the link (Recommended)
B. On the existing Sales page, next to today's figures, and listed as a v1/v2 change
C. On a small "TV wall" settings card that the navigation link opens first, with a "Open full screen" button
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] How should the stories be broken down?

A. By what the TV shows: one group for opening the TV wall, one for live orders, one for the money and day figures, one for the hide-takings setting, one for staying live and signed in (Recommended)
B. By persona: one group of stories for the manager, one for front-of-house staff
C. One story per requirement group, FR1 to FR9
D. Not yet defined
X. Other (please specify)

[Answer]: A
