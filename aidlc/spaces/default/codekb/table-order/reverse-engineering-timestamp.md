# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-10
- Commit: 49b31b1cddc50bd3f1bbb4447fcedc24c0d8faf4
- Repo: table-order (project-root repo)
- Breadth: full rescan of `./`
- Depth: Standard
- Intent: manager-tv-wall
- Run by: developer lead working alone (scan and synthesis)
- Mode: read only; no tests, builds or programs were run

Deep reading covered every server production file, the shared helpers, the staff client (session, shell, page registry, live hooks, board, floor, sales, QR, stations), the design system and UI kit, and every root configuration file. The diner screens and feature modules, the menu and special pages, the bill screen and the test suites were opened and classified but read in part; they are listed under `shallow.paths` below for readers. Left out unopened: `node_modules/`, `dist/`, `coverage/`, `test-results/`, the SQLite database files, and AI-DLC's own install.

## Scope of Analysis

```yaml
scope_version: 1
kind: full
intent: manager-tv-wall
fingerprint: e4aa1289cc105d3ff695486ad733cbe5a6b1cfc1
analyzed:
  paths:
    - ./
  components:
    - Server Entry and Route Registry
    - Configuration
    - Database and Schema Upgrade
    - Error Envelope
    - Staff Access
    - Live Event Hub
    - Presence Tracker
    - Order Repository
    - Table Repository
    - Billing Repository
    - Menu Repository
    - Menu Administration
    - Specials Repository
    - Service Call Repository
    - Rating Repository
    - Wait Estimation
    - Kitchen Stations
    - Floor State
    - Sales and Ratings Reports
    - Background Jobs
    - Guarded Stub Router
    - Shared Time and Wait Helpers
    - Client App Router
    - Staff Session and PIN Gate
    - Staff Shell and Page Registry
    - Staff Live Stream Hook
    - Live Read Hook
    - Kitchen Board
    - Floor Map Page
    - Sales Page
    - Menu Management Page
    - Chef Special Page
    - QR Codes Page
    - Station Page
    - Table Bill and Receipt
    - Alerts
    - Design System
    - Diner Table View
    - Diner Feature Modules
    - Unit and Integration Test Suite
    - Browser Test Suite
shallow:
  paths:
    - src/client/screens/diner/
    - src/client/diner/features/
    - src/client/staff/pages/menu/
    - src/client/staff/pages/special/
    - src/client/components/staff/
    - src/client/alerts/
    - src/server/__tests__/
    - e2e/
    - ideas/
    - V2 Scope/
```
