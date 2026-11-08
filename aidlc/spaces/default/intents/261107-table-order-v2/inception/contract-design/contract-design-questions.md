# Contract Design Questions

The contracts are the agreements the three Units must keep so U6 and U7 can be built at the same time without seeing each other's code: the new and changed routes, the live events, the new tables and columns, the staff session, the design system and the shared file seams. v1's routes and fields are never removed or renamed (Protecting v1); the only v1 behaviour that changes is the staff guard, which is on the "Changes to v1" list. These two decisions shape the contracts.

## Q1. [Architect] How does the browser prove to the server that the person is staff?

The Staff PIN must be checked on every staff request, including the staff live stream. A browser's live-stream connection cannot add custom headers, so the proof has to be something the browser sends on its own.

A. A cookie the server sets when the PIN is correct, which page scripts cannot read; the browser sends it automatically on every request and on the live stream (Recommended)
B. A token the page keeps and sends in a header on each request, and in the address for the live stream
C. Not yet defined
X. Other (please specify)

[Answer]: A. A cookie the server sets, which page scripts cannot read

## Q2. [Architect] What happens to v1's tests that call staff actions without signing in?

With the staff guard, those calls (moving an order to Preparing as staff, the sold-out toggle, Close table, the bill, the staff live stream) are refused with 401 unless they carry a staff session. This is a chosen change to v1, so v1's tests may need updating, and each one is listed in the Unit's `code-summary.md` under "v1 tests changed".

A. Update those v1 tests to sign in first with a test PIN set in the test setup, and list each under "v1 tests changed" (Recommended)
B. Add a switch that turns the guard off when the tests run; v1's tests stay untouched, but the app would have a code path that skips the PIN check
C. Not yet defined
X. Other (please specify)

[Answer]: A. Update those v1 tests to sign in first, and list each under "v1 tests changed"
