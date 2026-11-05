## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`.

---

## Q1. [Product Owner] Can a customer cancel an order, and up to which status?

A. Yes, while the order is still Pending. Once the kitchen moves it to Preparing it can no longer be cancelled. A cancelled order shows as Cancelled under "My orders" and on the kitchen board, and is left off the bill. (Recommended)
B. No: customers cannot cancel; they ask a member of staff.
C. Yes, up to and including Preparing; only a Completed order cannot be cancelled.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q2. [Product Owner] Can a table be closed while it has orders that are Pending or Preparing?

A. No. "Close table" stays unavailable until every order at the table is Completed or Cancelled, and the bill screen says which orders are still open. (Recommended)
B. Yes, after a warning that names the unfinished orders; they are archived as they are.
C. Yes, with no warning.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q3. [Product Owner] How do staff get into the staff view?

A. No protection: the staff view opens directly. The app runs only on the local machine during the workshop, so anyone with access to that machine is treated as staff. (Recommended)
B. A shared staff PIN, asked for once when the staff view opens.
C. A login with a name and password for each member of staff.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q4. [Product Owner] What happens when an item sells out mid-service?

A. Staff mark the item as sold out (and back again) from the staff view. Diners see it as "Sold out" on the menu and cannot add it. If it is already in a diner's cart, placing the order tells them which item sold out and takes it out of the cart, and the rest of the cart is kept. (Recommended)
B. Nothing in the app: staff tell the diner, and the order goes ahead as normal.
C. As A, and staff can also remove a sold-out item from an order already placed.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Q5. [Product Owner] Is the bill one combined total, or listed per order?

A. Listed per order: each order with its number, items, quantities, prices and subtotal, then one combined total for the table. (Recommended)
B. One combined list: the same item ordered more than once is merged into one line, then one total.
C. One combined total only, with no item lines.
D. Not yet defined.
X. Other (please specify)

[Answer]: A

---

## Assumption Confirmation

The following open points take the recommended choice. Accept them in one reply, or turn any item back into a question.

- A status change reaches the diner within 2 seconds. [assumption]
- Each device keeps its own cart, and "My orders" shows the whole table's orders for the visit. [assumption]
- Order numbers are unique across the restaurant. [assumption]
- A cart line holds 1 to 20 of an item. [assumption]
- A new order stays highlighted until it moves to Preparing. [assumption]
- Statuses only move forward, one step at a time. [assumption]
- A sold-out mark is not menu management. [assumption]
- Prices use one currency, with no tax or service charge. [assumption]
- Archived visits are stored but shown nowhere. [assumption]
- "Close table" is unavailable when a table has no orders. [assumption]
- Status is shown with words or icons, never by colour alone. [assumption]
- The corner-case requirements are recommended defaults. [assumption]

A. Accept assumptions
B. Convert to follow-up questions

[Answer]: A. Accept assumptions
