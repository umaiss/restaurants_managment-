# Requirements Analysis — Questions

Built on `ideation/intent-capture/intent-statement.md`, `ideation/scope-definition/scope-document.md` and the code knowledge base in `aidlc/spaces/default/codekb/table-order/` (`business-overview.md`, `architecture.md`, `code-structure.md`). Questions 1 to 3 settle the open points the code scan raised.

## Q1. [Product owner] Which money counts as "today's takings so far" on the TV?

Context: at Scope Definition you chose "same rules as the Sales page". The code scan found that the Sales page only counts tables that have been **closed** today, so on a busy evening the TV would not count the money on tables still eating until they close.

A. Show the closed-table total exactly like the Sales page, and under it a smaller "On open tables" figure for the bills still running (Recommended)
B. Show only the closed-table total, exactly like the Sales page
C. Show one total that adds closed tables and the bills still running
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Developer] How should the TV stay signed in?

Context: a staff sign-in ends after 12 hours without a staff action, when the browser closes, or when the server restarts. A TV that only displays would sign itself out during a long day.

A. The TV page quietly checks in with the server every few minutes, so it stays signed in while it is open; after a server restart or a closed browser it shows the PIN screen as today (Recommended)
B. Leave sign-in as it is: when the TV is signed out, someone enters the PIN again
C. Give the TV its own long-lived access that survives restarts
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q3. [Developer] Where is the hide-takings setting kept?

Context: the app has nowhere to keep this setting yet.

A. One setting for the whole restaurant, saved on the server: switching it on any staff screen changes every TV, and it survives restarts (Recommended)
B. Per TV, saved in that TV's browser: each TV is switched on its own
C. Per TV, and forgotten when the page reloads
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q4. [Designer] Does the TV page show the staff side navigation?

Context: every staff page sits inside the staff shell with a side navigation. On a TV with no touch, the navigation only takes space.

A. No: the TV wall fills the whole screen with no staff navigation; the new navigation link opens it (Recommended)
B. Yes: the TV wall is an ordinary staff page inside the navigation
C. The navigation shows, but collapses after a few seconds
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Which orders appear in the live orders list?

Context: the list is ordered oldest first so the longest wait is always on top.

A. Every open order (Pending or Preparing) across all tables, oldest first; when there are more than fit, the last line says "+N more" (Recommended)
B. Open orders, plus orders completed in the last 5 minutes so staff see what just went out
C. Only orders that have waited longer than the kitchen's "Slow" time (8 minutes)
D. Not yet defined
X. Other (please specify)

[Answer]: A

## Q6. [Designer] What reading condition should the TV be designed and tested for?

Context: your success target says everything can be read "from across the pass" in under 5 seconds. This pins down what that means.

A. A 43-inch landscape TV at 1920 by 1080, read from about 4 metres (Recommended)
B. A 32-inch landscape TV at 1920 by 1080, read from about 2 metres
C. A 55-inch landscape TV at 3840 by 2160, read from about 6 metres
D. Not yet defined
X. Other (please specify)

[Answer]: A
