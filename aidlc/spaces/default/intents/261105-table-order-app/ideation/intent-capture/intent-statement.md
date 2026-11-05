# Intent Statement — Table Order Web App

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

## Problem

Diners wait for staff to take their order and cannot see how it is progressing, while staff juggle orders without one live view of every table. Ordering from the table, a live kitchen board and a one-click bill and close remove the wait and the guesswork. [Q1]

## What We Are Building

One responsive web app with two views [desc], [scope]:

- **Customer view** at `/table/:id` — diners browse the menu, build a cart and place orders from their table; they track the status of every order placed during their visit. [desc]
- **Staff view** at `/staff` — floor and kitchen staff share one live board showing every table's orders; they update order status and open a table's bill to close it out. [desc], [Q2]

The app runs locally only and is started with a single command (`npm install && npm start`). [desc]

## Success Measures

The initiative is successful when all of the following hold [Q3]:

- SM1: A new order appears on the staff board within 2 seconds of being placed, highlighted. [Q3]
- SM2: A status change (Pending → Preparing → Completed) is visible on the diner's view within 2 seconds. [Q3]
- SM3: The cart survives a page refresh. [Q3]
- SM4: Closing a table archives the visit and resets the table for the next diner. [Q3]
- SM5: The five built screens — Menu, Cart, My Orders, Kitchen Board, Table Bill — match their mockups. [Q3]
- SM6: `npm install && npm start` starts the whole app at http://localhost:3000. [Q3]

## Out of Scope

This first version will not include [Q4]:

- Payments of any kind [Q4]
- QR code generation [Q4]
- Multi-language support [Q4]
- Menu management (adding, editing or removing items) [Q4]
- Past-visit history for returning diners [Q4]
- Push or in-app notifications [Q4]
- Cloud deployment — the app runs on a local machine only [Q4]

## Why Now

This is the workshop exercise: the team builds a realistic app end to end in one session of about 5 hours, with AI-DLC guiding each step. [Q5]

## Governance

The workshop team plays every role. The Product Owner decides scope and resolves the brief's five open questions (order cancellation, closing with pending orders, staff access, sold-out items and bill format). The rest of the team reviews and approves each step. [Q6]

## Assumptions & Open Questions

- The brief's five open questions are decided when requirements are written: they are the first questions of Requirements Analysis. [assumption]
- The team follows progress at each step's approval and on the workshop dashboard. There is no separate status report. [assumption]
- SM2's time limit is 2 seconds, the same as SM1's. Requirements Analysis confirms or changes it. [assumption]
- After a table is closed, its customer view shows an empty cart and no orders, ready for the next diner. [assumption]
- The success measures check that the product is delivered and works. They do not measure restaurant outcomes such as waiting time. [assumption]
