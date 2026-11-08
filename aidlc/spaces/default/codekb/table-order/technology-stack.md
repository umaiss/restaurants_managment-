# Technology Stack

Versions are the ranges declared in `package.json`; the lock file was not read, so installed patch versions may be newer.

## Languages and Runtime

| Item | Detail |
|---|---|
| TypeScript | ^5.4.2, `strict: true`, target ES2022, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit` (type check only) |
| Node.js | version not pinned (no `engines`, no `.nvmrc`); `@types/node` ^20.11.30; code uses global `crypto.randomUUID()` and ESM (`"type": "module"`) |
| Module system | ESM everywhere; server imports use `.js` extensions on TS files |
| Database | SQLite file via better-sqlite3 (WAL mode); `:memory:` for tests |

## Runtime Dependencies

| Package | Range | Use |
|---|---|---|
| express | ^4.18.3 | HTTP server, routing, static files |
| better-sqlite3 | ^13.0.0 | synchronous SQLite driver (native module) |
| react, react-dom | ^18.3.1 | UI (StrictMode in `main.tsx`) |
| react-router-dom | ^6.22.3 | client routing (`BrowserRouter`, `Routes`, `Link`, `useParams`, `useNavigate`) |

## Development and Test Dependencies

| Package | Range | Use |
|---|---|---|
| vite | ^5.1.6 | dev server and production bundle (`dist/`) |
| @vitejs/plugin-react | ^4.2.1 | React transform |
| tsx | ^4.7.1 | runs the server from TypeScript, watch mode in `dev` |
| concurrently | ^8.2.2 | runs server and Vite together in `dev` |
| typescript | ^5.4.2 | type checking |
| vitest | ^1.4.0 | unit test runner |
| @vitest/coverage-v8 | ^1.4.0 | coverage |
| jsdom | ^29.1.1 | browser-like environment for component tests |
| @testing-library/react ^16.3.3, user-event ^14.6.8, jest-dom ^7.0.1 | | component testing |
| supertest | ^6.3.4 | HTTP-level API tests against the exported `app` |
| @playwright/test | ^1.42.1 | browser tests |
| @types/* (better-sqlite3, express, node, react, react-dom, supertest) | | typings |

Not present: any CSS framework or preprocessor, CSS-in-JS library, UI kit, icon library, state manager, data-fetching library, form library, QR-code library, chart library, i18n library, ORM, migration tool, linter or formatter, authentication library.

## Build, Run and Test Commands

| Command | What it does |
|---|---|
| `npm start` | `tsx src/server/index.ts` (serves API, SSE and the built client from `dist/`) |
| `npm run dev` | server with watch plus Vite dev server (Vite proxies `/api` and `/sse` to `localhost:3000`) |
| `npm run build` | `vite build` to `dist/` (emptied first) |
| `npm test` | `vitest run` with verbose and JSON reporters, writes `test-results/unit.json` and, through `--coverage`, `coverage/` (v8, `text` and `json-summary`) |
| `npm run test:e2e` | `playwright test --reporter=json --output=test-results/e2e.json` |
| `npm run preview` | `vite preview` |
| Verification command | `npm test && npm run test:e2e` |
| Cross-browser run | `npx playwright test --config playwright.cross-browser.config.ts` (Chrome and WebKit; JSON to `test-results/cross-browser.json`) |
| Unit-scoped run | `npx vitest run --reporter=verbose <paths>` (see `unit-test-instructions.md`) |

`test:e2e` needs a current `dist/` (run `npm run build` first); the Playwright web server does not build.

## Environment Variables

| Variable | Default | Read in | Meaning |
|---|---|---|---|
| `PORT` | 3000 | `src/server/index.ts` (`PORT ?? E2E_PORT ?? 3000`) | app port, main folder only |
| `E2E_PORT` | 3100 | `playwright.config.ts`, `index.ts` fallback | browser-test port (specs needing their own server use +100 and +200); parallel Bolts use 4100, 5100, 6100, 7100 |
| `DB_FILE` | `table-order.db` | `src/server/db.ts` | SQLite file path; `:memory:` in tests; each parallel Bolt uses its own file in its worktree |
| `CI` | unset | `playwright.config.ts` | enables `forbidOnly` and 2 retries |

Avoid exporting `PORT` globally: it would take precedence over `E2E_PORT` during test runs (noted in `.env.example`). The app does not load `.env` files itself (no dotenv); values come from the shell.

## Browsers

Playwright default: Chromium (Desktop Chrome). Cross-browser config: installed Google Chrome and WebKit (Desktop Safari). Firefox is not installed or tested (team rule).

## Hosting and Deployment

No Dockerfile, CI pipeline, infrastructure code or cloud config in the repo. The app is run locally with `npm start` after `npm run build`. Single process, single node (the SSE hub is in memory).
