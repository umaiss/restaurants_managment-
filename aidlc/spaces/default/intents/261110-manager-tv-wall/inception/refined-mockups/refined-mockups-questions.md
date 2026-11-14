# Refined Mockups — Questions

Built on `inception/user-stories/stories.md` and `inception/requirements-analysis/requirements.md`. There were no rough mockups in this plan, so the mockups are designed straight from the stories and requirements. They follow the app's current look (the Paprika design system in `src/client/design/tokens.css`, dark by default) and the project's screen-design rules.

Settled without asking (from earlier answers): full screen with no staff navigation (requirements Q4); a 43-inch 1920 by 1080 TV at about 4 metres (requirements Q6); takings hidden by default; switch in the staff navigation under "TV wall" (stories Q1); at least 8 order rows, and the headline figures keep their size.

## Q1. [Designer] How is the TV wall laid out?

Context: it must show the oldest wait, today's takings and on open tables, the busiest table, the top dish and at least 8 order rows at once on a 1920 by 1080 screen.

A. Two columns: the live orders list on the left (about 60% of the width), and a column of big figure tiles on the right (oldest wait at the top, then takings and on open tables, then busiest table and top dish) (Recommended)
B. A row of four big figure tiles across the top, and the live orders list full width below it
C. Orders as a grid of cards like the Kitchen Board, with the figures in a strip along the bottom
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Designer] Should the mockups include the Could-have waiter and bill requests?

Context: the requests are a Could-have. Showing them in a mockup lets the build include them if time allows.

A. Yes: a slim "Requests" strip under the orders list, shown only when a table is calling, with "+N more" when there are many (Recommended)
B. No: leave them out of the mockups and this version
C. Yes, as a full panel that replaces the busiest table and top dish tiles while a table is calling
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Designer] What does the takings switch in the staff navigation look like?

Context: it sits directly under the "TV wall" link and must show its current state.

A. A small on/off switch labelled "Show takings on TV", with the word "On" or "Off" beside it (Recommended)
B. A text line "Takings on TV: Hidden" with a "Show" link that changes to "Hide"
C. An eye icon button next to the "TV wall" link, open when shown and crossed out when hidden
D. Not yet defined
X. Other (please specify)

[Answer]: A
