# Technology Stack: table-order

Versions are the ranges declared in `package.json`; the exact installed versions are pinned in `package-lock.json` (not re-resolved in this scan).

## Languages and runtime

| Item | Version | Notes |
|---|---|---|
| TypeScript | ^5.4.2 | `strict: true`, `noEmit`, target ES2022, bundler module resolution, `jsx: react-jsx` |
| Node.js | 20 or newer (README; built on 22) | ESM package (`"type": "module"`); server runs through `tsx` with no compile step |
| CSS | plain CSS files with custom properties | No preprocessor, no CSS-in-JS library; some screens use inline styles |
| SQL | SQLite dialect | Hand-written SQL in repositories; no ORM or query builder |

## Server

| Library | Version | Purpose |
|---|---|---|
| express | ^4.18.3 | HTTP routing, JSON body parsing, static files |
| better-sqlite3 | ^13.0.0 | Synchronous SQLite with WAL journal and foreign keys |
| tsx | ^4.7.1 (dev) | Runs `src/server/index.ts` in production and `tsx watch` in development |
| Node `crypto` | built in | PIN hashing for constant-time compare, session tokens, ids |

No cookie, session, CORS, validation, logging or SSE library is used: those are a few lines of the app's own code.

## Client

| Library | Version | Purpose |
|---|---|---|
| react, react-dom | ^18.3.1 | UI (StrictMode) |
| react-router-dom | ^6.22.3 | `BrowserRouter`, nested `Routes`, `NavLink` |
| qrcode | ^1.5.4 | QR codes drawn in the browser |
| @fontsource-variable/inter | ^5.3.0 | Self-hosted Inter variable font |
| Browser `EventSource` | built in | Live updates over SSE |
| Browser `localStorage` | built in | Per-device preferences (theme, sound, allergies, cart) through `safeStorage` |

No state-management library, no UI component library and no icon package: the UI kit and SVG icons are in `src/client/components/ui/`.

## Build and dev tooling

| Tool | Version | Purpose |
|---|---|---|
| vite | ^5.1.6 | Client bundle to `dist/`; dev server proxying `/api` and `/sse` to `PORT` |
| @vitejs/plugin-react | ^4.2.1 | JSX and fast refresh |
| concurrently | ^8.2.2 | `npm run dev` runs server and Vite together |

## Testing

| Tool | Version | Purpose |
|---|---|---|
| vitest | ^1.4.0 | Unit and integration tests (`pool: forks`, isolated) |
| @vitest/coverage-v8 | ^1.4.0 | Coverage to `coverage/coverage-summary.json` |
| jsdom | ^29.1.1 | DOM for `src/client/**` tests |
| @testing-library/react | ^16.3.3 | Component tests |
| @testing-library/user-event | ^14.6.8 | Interaction simulation |
| @testing-library/jest-dom | ^7.0.1 | DOM matchers |
| supertest | ^6.3.4 | HTTP tests against the Express app |
| @playwright/test | ^1.42.1 | Browser tests: Chromium by default; installed Google Chrome and WebKit in the cross-browser config; Firefox is never installed or tested |

## Type packages

`@types/better-sqlite3` ^7.6.8, `@types/express` ^4.17.21, `@types/node` ^20.11.30, `@types/qrcode` ^1.5.5, `@types/react` ^18.3.1, `@types/react-dom` ^18.3.0, `@types/supertest` ^6.0.2.

## Runtime configuration (environment)

| Variable | Default | Used by |
|---|---|---|
| `PORT` | 3000 | `getPort()` (falls back to `E2E_PORT`, then 3000); Vite dev proxy |
| `E2E_PORT` | 3100 | Playwright server and base URL |
| `DB_FILE` | `table-order.db` | `getDbFile()`; tests use `:memory:` |
| `STAFF_PIN` | random 4 digits, printed once | `staffAccess.getPin()` |

## Infrastructure

None in the repo: no Dockerfile, IaC, CI pipeline or cloud dependency. The app is designed to run on one machine on the restaurant's local network over plain HTTP.

## Stack constraints for new work

- New server code is TypeScript ESM with `.js` import suffixes (as every existing import)
- Database changes go through a new named step in `upgradeSchema` and must only add
- New styles use tokens only: `src/client/design/__tests__/restyle.test.tsx` fails on any hex, rgb, rgba or hsl value outside `tokens.css`, and `tokens.test.ts` checks both themes define the same tokens, contrast and reduced motion; motion must stop under `prefers-reduced-motion`
- Ports and the database file come from environment variables; parallel Bolts use their own `E2E_PORT` and `DB_FILE`
- Adding an npm dependency is a visible decision: v2 added only `qrcode`
