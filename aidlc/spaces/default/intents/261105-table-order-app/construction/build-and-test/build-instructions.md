# Build Instructions — Table Order Web App

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`
- Unit test instructions of U1 `u1-walking-skeleton`, U2 `u2-diner-screens`, U3 `u3-kitchen-board` and U4 `u4-bill-and-close` (`construction/<unit>/code-generation/unit-test-instructions.md`)

## Prerequisites

- Node.js 20 or newer (checked with 22.21.1) and npm
- Browsers for the browser tests: Playwright's Chromium and WebKit, and the installed Google Chrome. Firefox is not installed or tested. [team: project.md > Testing Posture]

## Install

```bash
npm install
npx playwright install chromium webkit
```

## Environment variables

Every port and the database file come from environment variables. [team: project.md > Testing Posture]

| Variable | Default | Used for |
|---|---|---|
| `PORT` | 3000 | the app the team uses, in the main folder only |
| `E2E_PORT` | 3100 | the browser tests (the Bolts built in parallel used 4100, 5100, 6100 and 7100) |
| `DB_FILE` | `table-order.db` | the SQLite file; the browser tests use `:memory:` |

## Build

```bash
npm run build
```

Builds the client into `dist/` (Vite). The server runs from source with `tsx`, so it has no build step. Verify the build: the command ends with `built in …ms` and `dist/index.html` exists.

## Type check

```bash
npx tsc --noEmit -p .
```

Must print no errors. It covers `src/`, `e2e/` and the config files. `src/test-types.d.ts` gives TypeScript the jest-dom matcher types the tests use.

## Run the app

```bash
npm start
```

Opens `http://localhost:3000`. Diner screens are at `/table/<1..10>`, the Kitchen Board at `/staff`, a table's bill at `/staff/tables/<n>`. Stop whatever already listens on port 3000 first.

## Troubleshooting

- **A browser test cannot start its server:** another process holds `E2E_PORT` (3100 by default). Stop it or set another `E2E_PORT`.
- **A page route answers 404 in a worktree:** the server must serve the page with `res.sendFile('index.html', { root: distDir })`; it already does. Build first so `dist/` exists.
- **WebKit never focuses a button with Tab:** Safari on a Mac moves between buttons with Option+Tab unless the system setting "Press Tab to highlight each item" is on. The keyboard spec uses Option+Tab in WebKit.
- **`test-results/e2e.json` is a folder:** `npm run test:e2e` passes `--output=test-results/e2e.json`, which Playwright reads as the artifacts folder; the JSON report goes to the terminal.
