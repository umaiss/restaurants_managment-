## Sources

- `[desc]` Initial description: Build the Table Order web app based on ideas/table-order/IDEA.md
- `[scope]` Workflow-selected scope: dpl-workshop
- `[memory:M1]` IDEA.md — one responsive web app: customer view at `/table/:id`, staff view at `/staff`; features: order from table, live kitchen board, bill & close; tech: React SPA, Node.js/Express, SQLite, Server-Sent Events; runs locally only

---

## Q1. [Product Owner] What problem are we solving?

The brief says diners order from their table through a web app, and staff see orders live, update their status and close out tables. Which problem statement should the intent carry?

A. Diners wait for staff to take their order and cannot see how it is progressing, while staff juggle orders without one live view of every table. Ordering from the table, a live kitchen board and a one-click bill and close remove the wait and the guesswork. (Recommended)
B. Mainly a staff problem: the kitchen and floor lose track of orders; the diner side is secondary.
C. Mainly a diner problem: diners want to order at their own pace; the staff side is secondary.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q2. [Product Owner] Who uses the app?

The brief describes one responsive web app with two views: a customer view at `/table/:id` (opening `/table/5` stands in for scanning a QR code) and a staff view at `/staff`.

A. Two user groups: diners seated at a table (customer view), and restaurant staff, with floor and kitchen staff sharing the one staff view. (Recommended)
B. Three user groups: diners, floor staff and kitchen staff, each needing its own view.
C. Diners only; the staff view is a supporting tool, not a target user.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q3. [Product Owner] How will we know it worked?

These become the success measures the later stages test against.

A. The brief's checks: a new order appears on the staff board within 2 seconds, highlighted; a status change (Pending, Preparing, Completed) shows on the diner's view; the cart survives a page refresh; closing a table archives the visit and resets the table; the five built screens (Menu, Cart, My Orders, Kitchen Board, Table Bill) match their mockups; and `npm install && npm start` starts everything at http://localhost:3000. (Recommended)
B. Only the live-update check: a new order on the staff board within 2 seconds.
C. A full diner journey (browse, order, see status, get the bill) works end to end, with no specific timings.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q4. [Product Owner] What does this first version leave out?

The workflow plan for this work is already chosen (`dpl-workshop`); this question is only about what the product itself will not do yet.

A. Exactly the brief's out-of-scope list: payments, QR code generation, multi-language, menu management, past-visit history, notifications and cloud deployment. It runs locally only. (Recommended)
B. The brief's list, plus anything beyond the five screens (no extra admin or settings screens).
C. Nothing is left out; the brief's out-of-scope list can be revisited.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q5. [Sponsor] Why are we building this now?

A. It is the workshop exercise: the team builds a realistic app end to end in one session (about 5 hours), with AI-DLC guiding each step. (Recommended)
B. A real restaurant has asked for it.
C. A product opportunity we want to test with restaurants.
D. Not identified.
X. Other (please specify)

[Answer]: A

---

## Q6. [Sponsor] Who decides, and who has a say?

A. The workshop team plays every role. The Product Owner decides scope and the brief's five open questions; the rest of the team reviews and approves each step. (Recommended)
B. A restaurant owner decides; diners and staff only influence.
C. One facilitator decides everything; the team only observes.
D. Not identified.
X. Other (please specify)

[Answer]: A
