# Scope Document — Table Order Web App

**Based on:** `intent-statement.md` from `ideation/intent-capture/`

## In Scope

All three features from the brief are Must Have. Together they form the complete journey from a diner sitting down to the table being reset for the next guest. [Q1]

| Feature | Priority | Description |
|---|---|---|
| F1 — Order from the table | Must Have | Diner browses menu by category, builds a cart, places an order, and tracks live order status. [Q1] |
| F2 — Live kitchen board | Must Have | Staff see all table cards on one live board; new orders appear within 2 seconds, highlighted; staff update status (Pending → Preparing → Completed). [Q1] |
| F3 — Bill and close table | Must Have | Staff open an itemised bill for a table and close it, archiving the visit and resetting the table. [Q1] |

Everything listed inside these three features is Must Have. No items are downgraded to Should Have or Could Have — the success measures explicitly test the new-order highlight and the cart surviving a page refresh, and the mockups include menu item images. [Q2]

## Out of Scope

The following are excluded from this version, as confirmed at Intent Capture [desc]:

- Payments of any kind
- QR code generation
- Multi-language support
- Menu management (adding, editing or removing items)
- Past-visit history for returning diners
- Push or in-app notifications
- Cloud deployment — the app runs on a local machine only

## Timeline and Deadline

One deadline covers all features: the complete app — built, tested and signed off — is delivered within a single workshop session of approximately 5 hours. No individual feature has its own deadline. [Q3]

## Value Stream

The value stream follows one table visit [assumption]:

1. Diner sits down and opens the customer view at `/table/:id`
2. Diner browses the menu, adds items to the cart, and places an order
3. Order appears on the kitchen board within 2 seconds; staff update its status
4. Diner sees live status changes in "My orders"
5. All orders reach Completed or Cancelled; staff open the table bill and close the table
6. Customer view resets; table is ready for the next diner

## Initial Scope Signal

Workflow-selected scope: `dpl-workshop` [scope]

## Assumptions & Open Questions

- The value stream map follows one table visit, from the diner sitting down to the table being reset. [assumption]
- If the session runs short, the team decides what to cut at the next approval point. Nothing is marked droppable in advance. [assumption]
- The brief's five open questions (order cancellation, closing with pending orders, staff access, sold-out items, bill format) stay open until Requirements Analysis. [assumption]
