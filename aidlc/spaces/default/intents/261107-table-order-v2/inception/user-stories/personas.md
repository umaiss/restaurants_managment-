# Personas: Table Order v2

Three personas, as chosen in the story plan (Q1). They come from the actors in `aidlc/spaces/default/codekb/table-order/business-overview.md` (diner, kitchen and floor staff, staff at the till) and the stakeholders in the intent statement.

## Priority Ranking

1. Diner (the person who orders; most features serve them)
2. Kitchen staff (the person who makes the food; their board decides when an order is ready)
3. Front-of-house staff (the person who runs the room and the till)

## P1. Dina the Diner

| Field | Detail |
|---|---|
| Role | A guest at a table, ordering from their own phone |
| Goals | Order without waiting for a waiter; know what is in the food and how long it will take; get help or the bill at the right moment |
| Pain points | Not knowing how long food will take; worrying about allergies; having to flag down a waiter; ordering the same thing again by hand |
| Tech comfort | Medium: comfortable with a phone, not with settings |
| Frequency | Once or twice a week, for about an hour per visit |
| Where they work | `/table/:id`: the Menu, Cart and My orders tabs |

## P2. Kai the Kitchen cook

| Field | Detail |
|---|---|
| Role | Cooks at the kitchen board, at one station (Grill, Cold, Bar or Desserts) or across all of them |
| Goals | See exactly what to make, with every option, in the order it was placed; know which tickets are getting late; mark their part done |
| Pain points | Missing a "no onions"; not knowing which orders have waited too long; seeing dishes that belong to another station |
| Tech comfort | Medium: uses a wall-mounted or counter screen with gloved hands |
| Frequency | Every shift |
| Where they work | `/staff`: the Kitchen Board, with the All stations view and a board per station |

## P3. Frankie from front of house

| Field | Detail |
|---|---|
| Role | Waiter, host or the person at the till; also looks after the menu, specials and the day's sales |
| Goals | Know where each table stands; answer calls quickly; bill and close tables; change the menu and launch specials without a developer; see how the day went |
| Pain points | An open staff screen anyone could use; not knowing which table needs them; menu changes that need a restart; no sales history |
| Tech comfort | Medium to high |
| Frequency | Every shift |
| Where they work | `/staff` and `/staff/tables/:id`, and the new staff pages |

## Relationships

- Dina places orders that Kai cooks and Frankie bills and closes.
- Dina's calls for the waiter or the bill reach Frankie, and show on Kai's board too.
- Frankie's menu changes, options, allergens, stations and specials change what Dina sees and what Kai cooks.
