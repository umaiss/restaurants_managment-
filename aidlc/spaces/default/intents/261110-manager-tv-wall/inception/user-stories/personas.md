# Personas — Manager TV Wall

Based on `inception/requirements-analysis/requirements.md` (Intent Analysis) and the staff users in `aidlc/spaces/default/codekb/table-order/business-overview.md`.

## P1 — Maria, the manager at the pass (primary)

- **Role:** runs the floor during service; signed in to the staff app with the shared staff PIN (the app has no separate manager role).
- **Goals:**
  - know at a glance whether the kitchen is keeping up (oldest wait, slow and late orders);
  - know how the day is going (takings, busiest table, top dish) without opening the Sales page;
  - keep revenue out of diners' sight.
- **Pain points:** has to open the Kitchen Board, the floor map and the Sales page one by one on a phone in the middle of service.
- **Context:** stands at the pass, about 4 metres from a 43-inch wall TV; hands are usually busy.
- **Tech comfort:** medium.
- **Frequency:** every service, glancing at the TV dozens of times an hour.

## P2 — Sam, front-of-house staff at the pass (secondary)

- **Role:** serves tables and collects dishes at the pass; signed in to the staff app with the same PIN.
- **Goals:**
  - see which orders have waited longest so they can chase the kitchen or tell a table;
  - see waiter and bill requests without checking a phone (if the Could-have story ships).
- **Pain points:** finds out an order is late only when a diner asks.
- **Context:** passes the TV many times a service, reading it while walking.
- **Tech comfort:** medium.
- **Frequency:** every shift.

## Affected party (no stories of their own)

- **Diners:** must never see the restaurant's takings on the TV; they are protected by the hide-takings default (requirements.md FR6).

## Priority

1. P1 Maria: the TV wall is built around her questions.
2. P2 Sam: shares the live-orders view and benefits from it directly.
