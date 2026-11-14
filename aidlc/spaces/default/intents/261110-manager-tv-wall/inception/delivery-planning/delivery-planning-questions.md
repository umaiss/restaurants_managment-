# Delivery Planning — Questions

Built on the Units in `inception/units-generation/unit-of-work.md` and `unit-of-work-dependency.md`, the contracts in `inception/contract-design/contract-summary.md`, and the requirements, stories, mockups and components before them.

A **Bolt** is one build pass over a piece of the work that ends in something that runs and is signed off. This work has one Bolt per Unit: Bolt 8 builds U8, and Bolt 9 builds U9.

Settled without asking:
- **Walking skeleton first.** The walking skeleton is the smallest working end-to-end slice. Project rules and the Units step put U8 first, and U9 depends on U8.
- **No parallel build.** There is only one valid order, so the Bolts run one after the other.
- **No outside dependencies.** Everything is inside this app.
- **What to tackle early.** Moving the Sales money rule is the riskiest change, and its regression test comes first in U8 (Units Generation review).
- **No timer.** Bolts carry no timebox, as in v2.

## Q1. [Delivery lead] How should Construction run through the two Bolts?

Context: either Bolt 8 is designed, built, tested and signed off before Bolt 9's design starts, or both Bolts are designed first and then built.

A. One Bolt at a time. Bolt 8 is designed, built, tested and signed off by you; then Bolt 9 goes through the same steps, so U9's design can use what U8's build taught us. You review each checkpoint (Recommended)
B. Design both Bolts first (Functional Design for U8 and U9), approve one combined code plan, then build U8 and U9 one after the other
C. One Bolt at a time, but after you sign off Bolt 8, Bolt 9 runs to its checkpoint without stopping for each step
D. Not yet defined
X. Other (please specify)

[Answer]: A
