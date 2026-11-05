# Functional Design Questions — u3-kitchen-board

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`

## Q1. [Product Owner] Which orders does the board highlight as "★ New"?

FR6.2 keeps a new order highlighted "until a member of staff moves the order to Preparing". The board mockup highlights #15 but not #14, which is also Pending.

A. Every Pending order, until it moves to Preparing or is cancelled. It reads the same on every staff screen and after a refresh, as FR6.2 says. The board mockup is updated so #14 is highlighted too. (Recommended)
B. Only orders that arrived while this board was open. That matches the mockup as drawn, but a refresh or a second staff screen loses the highlight.
C. Pending orders placed in the last 5 minutes.
D. Not yet defined.
X. Other (please specify)

[Answer]: A
