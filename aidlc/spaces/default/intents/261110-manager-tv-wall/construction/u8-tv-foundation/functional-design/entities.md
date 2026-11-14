# Entities — U8 `u8-tv-foundation`

U8's data, from `inception/units-generation/unit-of-work.md`, the component catalogue `inception/domain-design/components.md`, and the contracts in `inception/contract-design/contract-summary.md` (C1, C2, C5). Only one entity is stored: the TV setting. The summary is a read model built on each request from existing data (orders, visits, order lines, items, service calls), which stays owned by v1 and v2.

```yaml
entities:
  - name: TvSetting
    kind: stored entity
    description: The restaurant-wide "Show takings on TV" setting. One row at most.
    owner: TvSettings
    attributes:
      - name: key
        type: text
        required: true
        unique: true
        allowed_values: [show_takings]
      - name: value
        type: boolean
        required: true
        default: false
        constraints: "false = takings hidden, true = takings shown"
      - name: updated_at
        type: timestamp
        required: false
        default: null
        constraints: "set on every change that changes the value; null until first changed"
    entity_constraints:
      - "A missing row reads exactly like value false (BR1.1)."
    relationships: []

  - name: TvSummary
    kind: read model (value object, not stored)
    description: Everything the TV wall shows, built on the server for the server-local day.
    owner: TvWallSummary
    attributes:
      - name: server_time
        type: timestamp
        required: true
      - name: day
        type: date
        required: true
        constraints: "server-local calendar day of server_time"
      - name: show_takings
        type: boolean
        required: true
      - name: orders
        type: list of OpenOrderView
        required: true
        constraints: "may be empty"
      - name: takings
        type: TakingsView
        required: false
        constraints: "present if and only if show_takings is true"
      - name: busiest_table
        type: BusiestTableView
        required: false
        constraints: "null when no non-cancelled order was placed today"
      - name: top_dish
        type: TopDishView
        required: false
        constraints: "null when no portion was ordered today"
      - name: requests
        type: list of OpenRequestView
        required: true
    relationships:
      - "contains 0..n OpenOrderView"
      - "contains 0..1 TakingsView"
      - "contains 0..1 BusiestTableView"
      - "contains 0..1 TopDishView"
      - "contains 0..n OpenRequestView"

  - name: OpenOrderView
    kind: value object
    attributes:
      - { name: order_number, type: integer, required: true, min: 1 }
      - { name: table_id, type: integer, required: true, min: 1 }
      - { name: status, type: enum, required: true, allowed_values: [Pending, Preparing] }
      - { name: placed_at, type: timestamp, required: true }
      - { name: portions, type: integer, required: true, min: 0 }
    references:
      - "Order (owned by OrderRepository, v1) by order_number"

  - name: TakingsView
    kind: value object
    attributes:
      - { name: closed_cents, type: integer, required: true, min: 0 }
      - { name: open_cents, type: integer, required: true, min: 0 }

  - name: BusiestTableView
    kind: value object
    attributes:
      - { name: table_id, type: integer, required: true }
      - { name: orders, type: integer, required: true, min: 1 }

  - name: TopDishView
    kind: value object
    attributes:
      - { name: item_id, type: text, required: true }
      - { name: name, type: text, required: true }
      - { name: portions, type: integer, required: true, min: 1 }
    references:
      - "MenuItem (owned by MenuCatalog, v1/v2) by item_id; the name is read live, as everywhere else in the app"

  - name: OpenRequestView
    kind: value object
    attributes:
      - { name: call_id, type: text, required: true }
      - { name: table_id, type: integer, required: true }
      - { name: kind, type: enum, required: true, allowed_values: [waiter, bill] }
      - { name: opened_at, type: timestamp, required: true }
    references:
      - "ServiceCall (owned by ServiceCallRepository, v2) by call_id"
```

## Summary

- **TvSetting** is the only new stored fact. It lives in a new `tv_settings` table, added by an additive upgrade step. A missing row means hidden.
- **TvSummary** and its parts are built fresh on every read and never stored. Money is in whole cents. When takings are hidden, the `takings` part is absent.
- Orders, visits, order lines, items and service calls are read through new functions on their existing repositories. Their tables are not changed.
