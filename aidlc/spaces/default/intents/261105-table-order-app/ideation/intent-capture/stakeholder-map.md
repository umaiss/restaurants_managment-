# Stakeholder Map — Table Order Web App

## Sources

- `[desc]` Initial description: Build the Table Order web app based on ideas/table-order/IDEA.md
- `[scope]` Workflow-selected scope: dpl-workshop
- `[Q1]` What problem are we solving? → A (recommended)
- `[Q2]` Who uses the app? → A (recommended)
- `[Q3]` How will we know it worked? → A (recommended)
- `[Q4]` What does this first version leave out? → A (recommended)
- `[Q5]` Why are we building this now? → A (recommended)
- `[Q6]` Who decides, and who has a say? → A (recommended)

---

## Primary Users

### Diners
Seated at a table in the restaurant. They use the customer view (`/table/:id`) to browse the menu, add items to a cart, place orders and check the live status of their orders during the visit. [desc], [Q2]

**Needs:** order at their own pace without waiting for staff; see order progress in real time; have the cart survive a page refresh. [Q1], [Q3]

### Restaurant Staff
Floor and kitchen staff share one staff view (`/staff`). They monitor incoming orders on a live board, move orders through the Pending → Preparing → Completed flow, mark items as sold out, and open a table's bill to close it out at the end of a visit. [desc], [Q2]

**Needs:** one live view of every table's orders; a simple way to update order status and close a table without guesswork. [Q1]

## Decision Makers

### Product Owner
Member of the workshop team. Decides scope and resolves the brief's five open questions: whether customers can cancel orders, whether a table can be closed while orders are pending, how staff access the staff view, what happens when an item sells out mid-service, and how the bill is presented. [Q6]

### Workshop Team (Reviewer / Approver)
Every other member of the workshop team. Reviews and approves each step of the AI-DLC workflow as it completes. [Q6]

## Sponsor

The workshop facilitator, who initiated this exercise as a way for the team to experience building a realistic app end to end using AI-DLC in a single session. [Q5]

## Stakeholders Not Targeted by This Version

The following groups are explicitly out of scope for this release [Q4]:

- **Restaurant managers / owners** — no menu management, reporting or configuration screens. [Q4]
- **Returning diners** — no past-visit history. [Q4]
- **External payment providers** — no payment integration. [Q4]

## Assumptions & Open Questions

None.
