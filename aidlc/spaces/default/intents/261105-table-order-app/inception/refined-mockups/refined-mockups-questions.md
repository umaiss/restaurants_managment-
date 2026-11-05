## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

---

## Q1. [Designer] What look and feel should the app have?

A. Warm and calm: an off-white background, dark text, one terracotta accent color for main actions, rounded cards and large touch targets. Status colors (amber Pending, blue Preparing, green Completed, grey Cancelled) always come with a word and an icon. (Recommended)
B. Dark: a dark background on every screen, like a kitchen display, with bright status colors.
C. Plain: black and white with one blue accent and no decoration.
D. Not yet defined.
X. Other (please specify)

[Answer]: B

---

## Q2. [Product Owner] Which currency do prices show?

The brief says nothing about it; every price on all five screens shows it.

A. US dollars, for example `$4.50`. (Recommended)
B. British pounds, for example `£4.50`.
C. Euros, for example `€4.50`.
D. Pakistani rupees, for example `Rs 450`.
X. Other (please specify)

[Answer]: A

---

## Q3. [Designer] Where do staff mark items as sold out?

Sold-out marking (Requirements Q4) is not one of the brief's five screens.

A. A "Menu availability" panel on the Kitchen Board screen, opened from a button in its header. It lists the 12 items with a Sold out switch each, so the app keeps its five screens. (Recommended)
B. A sixth screen, "Menu availability", linked from the Kitchen Board.
C. A switch next to each item on the Table Bill screen.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Assumption Confirmation

The following open points take the recommended choice. Accept them in one reply, or turn any item back into a question.

- Item images are emoji tiles. [assumption]
- The bill is its own page at `/staff/tables/:id`. [assumption]
- The mockups' seed menu becomes the app's seed data. [assumption]
- Order numbers are shown as "#15". [assumption]
- Icons always sit next to words. [assumption]

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: A. Accept assumptions
