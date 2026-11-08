# External Dependency Map: Table Order v2

Things outside the team that could hold a Bolt up (a **Bolt** is one build pass over a piece of the work, ending in something that runs; the Bolts are in `bolt-plan.md`). v2 is built entirely by the team and the AI developer, runs on one machine and needs no outside service, so this map is short.

| Item | Owner | Lead time | Bolt it blocks | If it slips |
|---|---|---|---|---|
| Node.js, npm and the packages already in `package.json` | The team's machine | Already installed | All | Nothing new is installed except what a Unit's plan names (for example a QR code library for U7); the plan names it before it is installed |
| Playwright with Chromium (installed from v1) and the installed Google Chrome | The team's machine | Already installed | All | Browser tests cannot run until fixed |
| WebKit (Safari's engine) for the Playwright checks | The team's machine | One download, needed only at Build and Test, not in Bolts 5 to 7 | Build and Test | Safari checks wait; the Chrome checks still run |
| A phone on the same network, to scan QR codes | The team | Minutes | None (demo only) | The QR page can be shown and printed without a phone |
| The hand-in (a zip and screenshots to the organisers by Tuesday 10 November 2026) | The team | Tuesday, end of day | None | See `risk-and-sequencing-rationale.md`, risk 1 |

No outside APIs, data windows, approvals or other teams' hand-offs are involved. Payments, email, SMS, cloud deployment and paid outside services are out of scope.

## Assumptions & Open Questions

- A QR code library is the only new package the plan expects; Bolt 7's code plan names it and asks the team before it is installed.
- WebKit is installed at Build and Test, as the team's rules say Chrome and WebKit are checked and Firefox is not.
