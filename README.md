# Table Order

A restaurant ordering app. Diners scan a QR code at their table, browse the menu on their phone and order; the kitchen sees the orders live on a board; front-of-house staff manage the menu, tables, specials and sales.

This is **version 2**. It builds on the signed-off version 1 (menu, cart, orders, kitchen board, bill and close table) and adds 17 features and a new look on every screen. It runs as one Node process with one SQLite file, so there is nothing else to install or host.

## What it does

**For diners** (open `/table/<number>`, for example `/table/5`):

- Browse the menu and add dishes; choose options on a dish (size, extras, "no onions") with the price updating as you choose
- Set your allergies once; unsafe dishes are marked and you get a warning before you order
- See an honest wait estimate before ordering, and a three-step order tracker (Pending, Preparing, Completed) with "Running late" when an order is overdue
- Get a banner, a buzz and a short sound when your order is ready (the sound can be muted)
- "Same again" re-adds a past order; "Call the waiter" and "Ask for the bill" buttons
- A Chef's special card with a countdown; rate your dishes with a thumb after the table is closed
- Light or dark theme, following your device or your choice

**For staff** (open `/staff`; a 4-digit PIN is needed):

- Kitchen Board with a tab per station (Grill, Cold, Bar, Desserts) and "done" buttons; an order completes when every station is done
- Ticket timers (amber then red, with the words "Slow" and "Late"), a new-order alert, and tables that pulse when a diner calls
- Live floor map (Empty, Browsing, Waiting, Eating, Needs the bill)
- Menu management: add, edit and hide items and categories, options, allergens and stations; changes reach open menus within about 2 seconds
- Chef's special page, past visits and sales (best sellers, average time, best and worst rated), QR codes for every table (printable), and the bill with option lines

## Quick start

You need Node.js 20 or newer (it was built on Node 22) and npm.

```
npm ci
npm run build
npm start
```

Then open:

- Staff: http://localhost:3000/staff
- A diner's table: http://localhost:3000/table/5

**The staff PIN.** Set `STAFF_PIN` to a 4-digit number to choose it (for example `STAFF_PIN=2468 npm start`). If you do not, the server makes a random PIN when it starts and prints it once in the terminal (`Staff PIN (STAFF_PIN is not set): ...`). Five wrong tries from one address lock that address for a minute. A staff sign-in ends when the browser closes, after 12 hours without use, or when you sign out.

**Run `npm run build` before `npm start`**, and again after changing the code: the server serves the built pages in `dist/`. For development with live reload, `npm run dev` starts the server and Vite together.

## Settings

Nothing is written in the code; the app reads the environment (`.env.example` lists the names).

| Setting | Default | What it does |
|---|---|---|
| `PORT` | 3000 | The port of the app |
| `DB_FILE` | `table-order.db` | The SQLite database file (created on first start) |
| `STAFF_PIN` | random | The 4-digit staff PIN |
| `E2E_PORT` | 3100 | The port of the browser tests' own server |

The first start on an empty database loads sample data: 10 tables, 4 categories and 12 dishes (some with options, allergens and stations). A database file from version 1 is upgraded in place on first start: new tables and columns are added, nothing is removed, and starting twice changes nothing.

## Tests

| What | Command |
|---|---|
| Everything the project checks | `npm test && npm run test:e2e` |
| Unit and integration tests, with coverage | `npm test` |
| Browser tests (Chromium) | `npm run test:e2e` |
| The same browser tests in Google Chrome and WebKit | `npx playwright test --config playwright.cross-browser.config.ts` |
| Type check | `npx tsc --noEmit` |

The browser tests start their own server on `E2E_PORT` with an in-memory database, and they serve the built pages, so **run `npm run build` first**. They need the Playwright browsers installed (`npx playwright install chromium webkit`, and Google Chrome for the Chrome run). Firefox is not tested.

Current results: 1,485 unit and integration tests pass (about 94.6% line coverage), 170 browser tests pass in Chromium, and 212 pass in Chrome and WebKit (2 are skipped on purpose).

## Project layout

```
src/server/      Express API, SQLite, live events (Server-Sent Events), staff sign-in
src/client/      React app: diner screens, staff screens, design system and shared components
src/shared/      Small helpers used by both sides (time, wait estimate)
e2e/             Playwright browser tests (one folder per build unit, plus build-and-test)
aidlc/           The design and decision records of the build (see below)
ideas/           The briefs the app was built from (version 1 and version 2)
```

The stack is React and TypeScript on the front end (built with Vite), Node and Express with better-sqlite3 on the back end, and Vitest and Playwright for tests. The only package added in version 2 is `qrcode`, which draws the table QR codes in the browser with no outside service.

## How it was built

The app was built with the AI-DLC method, in stages, each approved by a person. The records of every stage (requirements, user stories, mockups, design, contracts, code plans, reviews and test results) are in `aidlc/spaces/default/intents/`:

- `261105-table-order-app/` is version 1
- `261107-table-order-v2/` is version 2; its `construction/build-and-test/` folder holds the final test results and the build instructions

## Known limits

- Item names on old order lines are read from the menu as it is now, so renaming an item later changes how old orders show it (prices are frozen)
- A cancelled ticket on the Kitchen Board shows when it was placed but no running timer
- The staff sign-in is held in server memory, so restarting the server asks staff for the PIN again
- The QR codes hold the address the staff page was opened on; open the staff page by the restaurant's network address, not `localhost`, so phones can reach it
- There is no deployment setup: the app is meant to run on one machine on the restaurant's network
