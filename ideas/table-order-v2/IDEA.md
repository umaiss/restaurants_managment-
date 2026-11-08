# Table Order v2: the follow-up exercise

## Intent
Your team built Table Order v1 in the workshop: diners order from the table,
the kitchen sees orders live, and staff bill and close tables. Now turn it into
a product a restaurant would choose over its competitors: bring back features
we left out, add something no other ordering app has, and make it look
professional.

This is new work on top of the existing app. The v1 code is already in this
folder, so after Scope Definition a Reverse Engineering stage reads it and
writes a code knowledge base that every later stage builds on.

## v1 stays as it is unless you choose to change it
- v1's screens, behaviour and tests stay exactly as you signed them off.
- In Scope Definition you decide which v1 screens or behaviours to change (for
  example, a redesigned Menu). Only those change; everything else is left
  alone.
- v1's tests keep passing. v1's data is kept: the database only gains new
  tables and fields.
- v1's documents and mockups are never edited. v2 writes its own.

## What every team must deliver
1. **At least 2 features from List A** (left out of v1).
2. **At least 2 features from List B** (features most ordering apps don't have).
3. **At least 2 X-factors from List C**, or ones your team invents.
4. **A more professional look** for every new screen, built on a small design
   system. Your team decides which v1 screens get the new look too.
5. **New planning work for all of it**: new user stories with Given/When/Then
   acceptance criteria, new Units and Bolts, refined mockups, and a Code
   Generation plan per Unit.
6. **Green tests**: `npm test && npm run test:e2e` passes, v1's tests included,
   with a mockup-match spec for every new or changed screen.
7. **Your work handed in by Tuesday 10 November 2026, end of day**, and a
   5-minute demo (see Handing in your work).

Your team picks the features in Intent Capture and confirms them in Scope
Definition. Pick fewer things done well over many things half done.

## List A: left out of v1
- **QR codes:** a staff page that prints a QR code for every table, linking
  to `/table/:id`.
- **Multi-language:** a language switcher on the diner screens, with English
  and at least one other language. A right-to-left language counts double.
- **Menu management:** staff add, edit and hide items, categories, prices
  and images; changes reach open menus live.
- **Past visits and sales:** closed visits by day, with totals, best-selling
  items and average time from order to Completed.
- **Notifications:** the diner is told when an order is ready (in-app banner,
  sound or vibration), and staff are alerted to new orders.
- **Staff PIN:** the staff view asks for a PIN (v1 opens it with no
  protection).

## List B: features most ordering apps don't have
- **Shared table cart:** several phones at one table share one live cart.
  Each person sees who added what, and anyone can place the order.
- **Make it yours:** items have options (spice level, no onions, extra
  cheese, size) that change the price and show on the kitchen ticket.
- **Allergy shield:** the diner sets their allergies once; unsafe dishes are
  marked on the menu, and the cart warns before an unsafe order is placed.
- **Kitchen stations:** each item belongs to a station (Grill, Cold, Bar,
  Desserts); each station has its own board, and an order is Completed when
  every station has finished its part.
- **Live floor map:** staff see the restaurant floor with every table coloured
  by what is happening there (empty, browsing, waiting, eating, needs the
  bill), updated live.
- **Chef's special drop:** staff launch a limited special with a countdown and
  a stock count; it appears live on every open menu and disappears when it
  sells out or time runs out.
- **Honest wait time:** the diner sees an estimated wait, worked out from how
  long today's orders have taken and how busy the kitchen is right now.

## List C: X-factor
- **Call the waiter / Ask for the bill** buttons that make the table's card
  pulse on the kitchen board and floor map until staff respond.
- **Kitchen ticket timers** that turn amber, then red, as an order ages.
- **Animated order tracker** for the diner: Pending → Preparing → Completed
  as a progress bar with the estimated wait.
- **"Same again"** on My orders: one tap re-adds a previous order's drinks or
  items to the cart.
- **Manager TV wall:** a big-screen view for the pass, showing live orders,
  today's takings so far, the busiest table and the top dish.
- **Dark mode** that follows the device setting, with a manual toggle.
- **Rate your meal:** a one-tap rating per dish after the table is closed,
  shown to staff as today's best- and worst-rated dishes.

## Design
- New and changed screens are high-fidelity standalone HTML mockups with an
  `index.html` linking them all. No wireframes, no Figma.
- Start from a small design system: colours, type scale, spacing, radius,
  shadows and components, written down once and used by every new or changed
  screen.
- Keep what v1 got right: the bottom tab bar, the sticky category pills, the
  44 px touch areas, reduced-motion support and keyboard access.
- The built app matches the new mockups, checked by the mockup-match specs.

## Units and Bolts
- v1's four Units (U1 to U4) and Bolts (1 to 4) are done. New work gets new
  Units, numbered from U5, one Bolt per Unit.
- **Bolt 5** (U5 `u5-foundation`): what the other new Units share (database
  changes, new API routes and live events, new tabs or links, the design
  system), built first and on its own.
- **Bolts 6 and 7** (U6, U7): the features and the X-factor, built in parallel
  in their own worktrees once Bolt 5 is signed off.
- **Bolt 8** (U8, only if needed): work that needs both U6 and U7.
- New Units use only v1 and U5, never each other, so they can be built in
  parallel.
- No Bolt has a time limit: build each one until its features work and its
  tests pass.

## Open questions (to be decided by the Product Owner)
1. Which features from Lists A, B and C are in?
2. Which v1 screens or behaviours should change, if any?
3. For a feature that needs staff-only actions (menu management, specials,
   sales): does it sit behind the staff PIN, or open like the v1 staff view?
4. For multi-language: which second language, and who translates the menu?
5. For the wait time or the order tracker: is the estimate shown as minutes,
   or as "about right / running late"?

## Out of scope
Payments, native mobile apps, cloud deployment, diner accounts, email or SMS,
anything that needs a paid external service.

## Tech & data
Same stack as v1: React SPA, Node.js/Express, SQLite, Server-Sent Events.
Every port and the database file still come from `PORT`, `E2E_PORT` and
`DB_FILE`. Parallel Bolts use `E2E_PORT` 4100 and 5100 and their own `DB_FILE`.
Runs locally only: `npm install && npm start`, at http://localhost:3000.

## Handing in your work
**Due: Tuesday 10 November 2026, end of day.**

Keep the dashboard running while you work (`../tools/dashboard.sh`, or
`..\tools\dashboard.cmd` on Windows), so its figures are counted.

Email **one zip file** to **waqas.f@dplit.com**:
- **Subject:** `Workshop V2 - <your team name>`
- **In the email:** your team name and the names of everyone in the team.
- **In the zip:** your **full code** (the whole `table-order` project, made
  with the commands in step 6 of the setup guide), plus these screenshots.
  Screenshots alone are not enough: a zip without the code is not a
  complete hand-in.
  1. **The app (the system):** every new or changed screen, including your
     X-factors.
  2. **Dashboard, v1 view:** click **v1** at the top of the dashboard.
  3. **Dashboard, v2 view:** at the final sign-off, with the delivery strip,
     tests and coverage showing.

`V2 Scope/V2-SETUP.md` (step 6) says how to take the screenshots and make
the zip.

**Prizes:**
- 🥇 **Winning team:** 25,000 points for each team member.
- 🥈 **Runners-up:** 10,000 points for each team member.

**Demo:** after the hand-in, a 5-minute demo will be scheduled with each team
by the end of next week (Friday 13 November 2026). Be ready to show your new
features and your X-factors running, and both dashboard views.
