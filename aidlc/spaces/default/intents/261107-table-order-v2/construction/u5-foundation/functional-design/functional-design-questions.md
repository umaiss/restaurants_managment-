# Functional Design Questions: u5-foundation

U5 is the foundation Unit: everything U6 and U7 share. Most of its design is settled by the requirements, the stories, the component catalogue and the contracts. The contract review also raised open points that I settle myself, as assumptions, in `functional-spec.md` and `rules.md` (the estimate formula, the station-done transition, the rating lock, the staff menu read route, placement edge cases). Two points are a real choice for you.

## Q1. [Architect] How does the server know a diner page is still open, for the floor map's "Browsing" state?

A browser's live-stream connection cannot send anything back, so a phone that goes to sleep can stay counted as connected. Your earlier answer was that a page quiet for 5 minutes stops counting; this decides how that works.

A. Each open diner page calls a small route about once a minute ("I'm still here"), so a page quiet for 5 minutes stops counting, as you chose (Recommended)
B. No heartbeat: a page counts while its live connection is open, and is dropped when a send to it fails or after 30 minutes; there is no 5-minute quiet limit
C. Not yet defined
X. Other (please specify)

[Answer]: A. A heartbeat route about once a minute

## Q2. [Architect] How long should a staff sign-in last on a screen that is left on, such as a kitchen tablet?

A session already ends when the browser closes or the server restarts. This decides whether it also ends after being left alone, and what staff see when it ends.

A. It ends after 12 hours without any staff action, and any refused request sends the screen back to the PIN screen (Recommended)
B. It never ends on its own: only closing the browser, signing out or restarting the server ends it, and a refused request still sends the screen back to the PIN screen
C. Not yet defined
X. Other (please specify)

[Answer]: A. It ends after 12 hours without any staff action
