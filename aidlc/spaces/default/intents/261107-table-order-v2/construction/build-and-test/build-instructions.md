# Build Instructions: Table Order v2

How to install, build, start and verify the whole app (v1, U5, U6 and U7 together). It is one Node process (Express) with one SQLite file and one page bundle, so there is one thing to build and one thing to run.

## Prerequisites

- Node.js 20 or newer and npm (the project was built and tested on Node 22).
- A browser for trying the app. For the browser tests: the Playwright browsers installed on this machine (Chromium, the installed Google Chrome, and WebKit). Firefox is not installed and not tested.

## Dependency installation

Run from the project's main folder:

```
npm ci
```

`npm ci` installs exactly what `package-lock.json` lists. v2 adds one package to v1's: `qrcode` (1.5.4) and its type definitions `@types/qrcode` (1.5.5), which draw the table QR codes in the browser with no outside service. After pulling or merging work that changes `package.json`, run `npm ci` again, or the Unit tests that import the new package fail with "Failed to resolve import".

## Environment setup

Nothing is written in code: every port, the database file and the staff PIN come from the environment. A `.env.example` shows the names; the app reads the real environment, so set them in the shell or your process manager.

| Setting | Default | What it does |
|---|---|---|
| `PORT` | 3000 | The port of the app you use (`npm start`). |
| `E2E_PORT` | 3100 | The port of the browser tests' own server. Specs that need another server use `E2E_PORT` plus 100 and plus 200. Parallel builds each use their own (4100, 5100 and so on). |
| `DB_FILE` | `table-order.db` | The SQLite file. Browser tests use `:memory:`. |
| `STAFF_PIN` | (random) | The 4-digit staff PIN. When it is missing or not 4 digits, the server makes a random one at start and prints it once on the console. The tests set it to 4242 in their own setup. |

A database file made by v1 is upgraded in place the first time v2 starts on it: new tables and columns are added, the sample items get their stations, allergens and the burger and pizza options once, and nothing is removed. Starting twice changes nothing.

## Build

```
npm run build
```

This runs `vite build` and writes the page bundle to `dist/` (a single HTML file, one JavaScript file and one stylesheet). The server serves `dist/` (pages are served with `res.sendFile('index.html', { root: distDir })`, so the app also works from a hidden folder such as a git worktree).

**The browser tests serve `dist/`, so run the build before them.** A test run on a stale `dist/` fails with many unrelated errors (the screens it expects are not in the bundle).

## Build verification

1. `npx tsc --noEmit` prints nothing.
2. `npm run build` ends with `built in ...` and lists `dist/index.html`, one `.css` and one `.js` file.
3. `npm test` exits 0 (all unit and integration tests, with the coverage report in `coverage/`).
4. `npm run test:e2e` exits 0 (all browser tests; it starts its own server on `E2E_PORT` with an in-memory database).

The project's approved check is `npm test && npm run test:e2e`.

## Start the app

```
npm start
```

It prints `Staff PIN (STAFF_PIN is not set): <4 digits>` (only when no PIN was set) and `Table Order running on http://localhost:3000`. Open `/staff` for the staff screens (the PIN screen shows first) and `/table/<n>` for a diner's table (for example `/table/5`). Stop any other app on the same port first.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Unit tests fail with `Failed to resolve import "qrcode"` | The package is not installed in this folder yet: run `npm ci`. |
| Many browser tests fail at once, or a new screen is missing | `dist/` is stale: run `npm run build`, then run the tests again. |
| `Error: listen EADDRINUSE` | Something already uses the port: stop it, or set another `PORT` (app) or `E2E_PORT` (tests). |
| The staff PIN screen says "Too many tries" | Five wrong PINs from one address lock it for 60 seconds; wait, or restart the server (counts are in memory). |
| A browser test fails only when run after others | Each spec resets the tables it uses; if you add a spec, reset its tables first (`resetTable` in `e2e/helpers`). |
| A page route answers with the page where an API answer was expected | A new route was mounted after the page catch-all in `src/server/index.ts`; routes belong in `src/server/routes/registry.ts`, which is mounted before it. |
| `better-sqlite3` fails to load after changing Node versions | Run `npm rebuild better-sqlite3` (or `npm ci`) so it is rebuilt for the Node version in use. |
