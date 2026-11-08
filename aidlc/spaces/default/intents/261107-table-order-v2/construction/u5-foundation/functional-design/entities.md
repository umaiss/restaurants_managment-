# Entity Model: u5-foundation

The data U5 owns or changes, from the component catalogue (`inception/domain-design/components.md`) and the shared schema contract (`inception/contract-design/contract-summary.md`, contract 5). It lists the changes to v1's entities and the new ones. Logical types only (text, whole number, yes/no, time); the physical tables and columns are decided in Code Generation, within the additive rules in `rules.md` (BR11.1). Unchanged v1 entities (Table, Visit, order counter) are not repeated.

```yaml
entities:
  - name: Category
    change: "v1 entity, one attribute added"
    description: "A group of menu items shown as a pill on the Menu."
    attributes:
      - { name: id, type: text, required: true, unique: true }
      - { name: name, type: text, required: true, max_length: 60 }
      - { name: sort_order, type: whole number, required: true, default: 0 }
      - { name: hidden, type: yes/no, required: true, default: no, note: "NEW. A hidden category and its items are not offered (BR2.1)." }
    constraints: ["A name is required and at most 60 characters"]
    relationships:
      - "Category has many MenuItem (one to many, owned by this side)"

  - name: MenuItem
    change: "v1 entity, three attributes added"
    description: "A dish or drink that can be ordered."
    attributes:
      - { name: id, type: text, required: true, unique: true }
      - { name: category_id, type: text, required: true, references: Category }
      - { name: name, type: text, required: true, max_length: 60 }
      - { name: description, type: text, required: false, default: "" }
      - { name: price_cents, type: whole number, required: true, min: 1, max: 1000000 }
      - { name: image, type: text, required: false, default: "", note: "an emoji or a web address" }
      - { name: available, type: yes/no, required: true, default: yes, note: "sold-out switch, as v1" }
      - { name: hidden, type: yes/no, required: true, default: no, note: "NEW" }
      - { name: station, type: text, required: true, allowed_values: [Grill, Cold, Bar, Desserts], default: Grill, note: "NEW (BR2.2)" }
      - { name: allergens, type: list of text, required: false, allowed_values: [gluten, dairy, eggs, peanuts, tree_nuts, fish, shellfish, soy, sesame], note: "NEW. Not set means unknown; an empty list means none (BR2.3)." }
    constraints: ["price_cents is a whole number of cents"]
    relationships:
      - "MenuItem belongs to one Category"
      - "MenuItem has many OptionGroup"

  - name: OptionGroup
    change: "NEW"
    description: "A set of choices for one item: choose one, choose any, or leave out."
    attributes:
      - { name: id, type: text, required: true, unique: true }
      - { name: item_id, type: text, required: true, references: MenuItem }
      - { name: name, type: text, required: true, max_length: 60 }
      - { name: kind, type: text, required: true, allowed_values: [one, any, leave_out] }
      - { name: required, type: yes/no, required: true, default: no, note: "only meaningful for kind one" }
      - { name: sort_order, type: whole number, required: true, default: 0 }
    constraints: ["A group of kind one allows at most one chosen choice (BR2.4, BR3.1)"]
    relationships:
      - "OptionGroup belongs to one MenuItem"
      - "OptionGroup has many OptionChoice"

  - name: OptionChoice
    change: "NEW"
    description: "One selectable choice, with the change it makes to the price."
    attributes:
      - { name: id, type: text, required: true, unique: true }
      - { name: group_id, type: text, required: true, references: OptionGroup }
      - { name: label, type: text, required: true, max_length: 60 }
      - { name: price_delta_cents, type: whole number, required: true, default: 0, note: "positive, zero or negative" }
      - { name: sort_order, type: whole number, required: true, default: 0 }
    constraints: ["The line price after all chosen choices is never below zero (BR2.4)"]
    relationships:
      - "OptionChoice belongs to one OptionGroup"

  - name: Order
    change: "v1 entity, two attributes added"
    description: "One placement by a diner: its status, time and the estimate it was given."
    attributes:
      - { name: order_number, type: whole number, required: true, unique: true, note: "global and sequential, as v1" }
      - { name: visit_id, type: text, required: true, references: Visit }
      - { name: table_id, type: whole number, required: true, references: Table }
      - { name: status, type: text, required: true, allowed_values: [Pending, Preparing, Completed, Cancelled], default: Pending }
      - { name: placed_by, type: text, required: true, default: diner }
      - { name: placement_key, type: text, required: true }
      - { name: placed_at, type: time, required: true }
      - { name: completed_at, type: time, required: false, note: "NEW. Set when the status becomes Completed; empty on v1-era orders (BR3.6)." }
      - { name: estimate_minutes, type: whole number, required: false, min: 1, note: "NEW. The estimate shown at placement (BR3.5)." }
    constraints: ["The pair (table, visit, placement_key) is unique, as v1 (BR3.7)"]
    relationships:
      - "Order belongs to one Visit"
      - "Order has many OrderLine"
      - "Order has many StationDone"

  - name: OrderLine
    change: "v1 entity (order item), two attributes added"
    description: "One line of an order with its frozen price, station and chosen options."
    attributes:
      - { name: id, type: whole number, required: true, unique: true }
      - { name: order_number, type: whole number, required: true, references: Order }
      - { name: item_id, type: text, required: true, references: MenuItem }
      - { name: quantity, type: whole number, required: true, min: 1, max: 20 }
      - { name: unit_price_cents, type: whole number, required: true, note: "item or special price plus the chosen options, frozen (BR3.2)" }
      - { name: station, type: text, required: true, allowed_values: [Grill, Cold, Bar, Desserts], default: Grill, note: "NEW. Frozen at placement (BR3.3)." }
      - { name: special_id, type: text, required: false, references: ChefSpecial, note: "NEW. Present on a Chef's special line." }
    relationships:
      - "OrderLine belongs to one Order"
      - "OrderLine has many OrderLineOption"

  - name: OrderLineOption
    change: "NEW"
    description: "One chosen option on a line, kept as text so later menu edits never change it."
    attributes:
      - { name: id, type: whole number, required: true, unique: true }
      - { name: order_line_id, type: whole number, required: true, references: OrderLine }
      - { name: label, type: text, required: true }
      - { name: price_delta_cents, type: whole number, required: true, default: 0 }
    relationships:
      - "OrderLineOption belongs to one OrderLine"

  - name: StationDone
    change: "NEW (table created in U5, used by U7)"
    description: "A mark that one station has finished its part of one order."
    attributes:
      - { name: order_number, type: whole number, required: true, references: Order }
      - { name: station, type: text, required: true, allowed_values: [Grill, Cold, Bar, Desserts] }
      - { name: done_at, type: time, required: true }
    constraints: ["One mark per order and station; marking twice changes nothing (BR12.2)"]
    relationships:
      - "StationDone belongs to one Order"

  - name: ChefSpecial
    change: "NEW"
    description: "The limited special with a price, a stock and an end time."
    attributes:
      - { name: id, type: text, required: true, unique: true }
      - { name: item_id, type: text, required: true, references: MenuItem }
      - { name: special_price_cents, type: whole number, required: true, min: 1 }
      - { name: stock_total, type: whole number, required: true, min: 1, max: 999 }
      - { name: stock_left, type: whole number, required: true, min: 0 }
      - { name: ends_at, type: time, required: true }
      - { name: ended_at, type: time, required: false, note: "set when staff end it or a new one replaces it" }
    constraints: ["At most one special has ended_at empty (BR5.1)", "stock_left is reduced only by the guarded step (BR5.3)"]
    relationships:
      - "ChefSpecial is for one MenuItem"

  - name: ServiceCall
    change: "NEW"
    description: "A diner's request for the waiter or the bill."
    attributes:
      - { name: id, type: text, required: true, unique: true }
      - { name: visit_id, type: text, required: true, references: Visit }
      - { name: table_id, type: whole number, required: true, references: Table }
      - { name: kind, type: text, required: true, allowed_values: [waiter, bill] }
      - { name: opened_at, type: time, required: true }
      - { name: responded_at, type: time, required: false }
    constraints: ["At most one request of each kind per visit has responded_at empty (BR6.1)"]
    relationships:
      - "ServiceCall belongs to one Visit"

  - name: DishRating
    change: "NEW"
    description: "One thumbs up or down for one dish in one closed visit."
    attributes:
      - { name: id, type: whole number, required: true, unique: true }
      - { name: visit_id, type: text, required: true, references: Visit }
      - { name: item_id, type: text, required: true, references: MenuItem }
      - { name: thumb, type: text, required: true, allowed_values: [up, down] }
      - { name: rated_at, type: time, required: true }
      - { name: locked, type: yes/no, required: true, default: no, note: "set when the diner presses Done (BR7.2)" }
    constraints: ["One rating per dish per visit (BR7.2)"]
    relationships:
      - "DishRating belongs to one Visit"

  - name: StaffSession
    change: "NEW (in server memory)"
    description: "A signed-in staff browser."
    attributes:
      - { name: token, type: text, required: true, unique: true, note: "random 128-bit value, the cookie's value" }
      - { name: created_at, type: time, required: true }
      - { name: last_action_at, type: time, required: true, note: "refreshed on every staff request (BR1.3)" }
    constraints: ["Held in memory only; a restart ends every session"]

  - name: LoginAttempt
    change: "NEW (in server memory)"
    description: "The count of wrong PIN tries for one client address."
    attributes:
      - { name: client_key, type: text, required: true, unique: true, note: "the connection's address" }
      - { name: failures, type: whole number, required: true, min: 0, max: 5 }
      - { name: locked_until, type: time, required: false }
      - { name: last_try_at, type: time, required: true }
    constraints: ["At most 1,000 entries; entries expire after 10 minutes without a try (BR1.4)"]

  - name: PagePresence
    change: "NEW (in server memory, held by the live-events component)"
    description: "One open diner page for a table, with its last sign of life."
    attributes:
      - { name: page_id, type: text, required: true, unique: true, note: "random value made by the page" }
      - { name: table_id, type: whole number, required: true, references: Table }
      - { name: connected, type: yes/no, required: true }
      - { name: last_seen_at, type: time, required: true }
    constraints: ["A page is present while connected and last_seen_at is within 5 minutes (BR8.2)"]

  - name: ThemePreference
    change: "NEW (client, browser storage)"
    description: "The person's theme choice."
    attributes:
      - { name: mode, type: text, required: false, allowed_values: [light, dark], note: "not set means Follow device" }
  - name: SoundPreference
    change: "NEW (client, browser storage)"
    description: "Whether alert sounds are muted."
    attributes:
      - { name: muted, type: yes/no, required: false, default: no }
  - name: AllergyProfile
    change: "NEW (client, browser storage)"
    description: "The allergens a diner has set."
    attributes:
      - { name: allergens, type: list of text, required: false, allowed_values: [gluten, dairy, eggs, peanuts, tree_nuts, fish, shellfish, soy, sesame] }
```

## Summary

U5 changes four v1 entities (Category, MenuItem, Order and OrderLine each gain a few attributes) and adds ten new entities: seven stored in the database (OptionGroup, OptionChoice, OrderLineOption, StationDone, ChefSpecial, ServiceCall, DishRating) and three held in server memory (StaffSession, LoginAttempt, PagePresence), plus three browser-held preferences. Every change to a stored v1 entity adds an attribute with a default or allowing empty, so a v1 database file keeps all its data.

## Assumptions & Open Questions

- `PagePresence` is held by the live-events component, which the component catalogue lists without an entity; it is added here because Contract Design moved the connection tracking into U5.
- The physical design (table and column names, indexes) follows the shared schema contract and is for Code Generation.
