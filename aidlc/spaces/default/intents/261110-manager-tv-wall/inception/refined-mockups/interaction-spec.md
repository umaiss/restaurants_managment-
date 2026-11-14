# Interaction Specification — Manager TV Wall

Behaviour for the screens in `mockups.md`, taken from `inception/user-stories/stories.md` and `inception/requirements-analysis/requirements.md`. The TV wall takes no input at all (FR1.3). The only interactive parts are the navigation link and the switch.

## User flows

```
Flow: Put the TV wall on the TV
Persona: Maria (P1)
Trigger: start of service
Steps:
  1. Any staff page -> chooses "TV wall" in the staff navigation -> TV wall opens full screen at /staff/tv
  2. (TV not signed in) /staff/tv -> PIN screen -> correct PIN -> TV wall
Success outcome: the TV shows the TV wall and keeps itself up to date and signed in
Error paths:
  - wrong PIN -> existing PIN-screen message and lockout -> enter the right PIN
  - server restarted -> PIN screen on the TV -> enter the PIN once
```

```
Flow: Show or hide the takings
Persona: Maria (P1)
Trigger: the TV can be seen by diners, or the manager wants the figures up
Steps:
  1. Any staff page -> switches "Show takings on TV" -> the switch changes and the On/Off word follows at once
  2. Every open TV wall -> within 2 s shows the amounts, or "Takings hidden"
  3. Every other open staff page -> its switch shows the new state within 2 s
Success outcome: all TVs and all switches agree
Error paths:
  - the change is refused (signed out) -> the switch returns to its previous position and the PIN screen appears
  - the server does not answer -> the switch returns to its previous position and the existing "Server did not answer, Try again" message shows
```

## Components

### TV wall screen

| Field | Value |
|---|---|
| Component | TvWallScreen |
| Description | Full-screen, input-free view of open orders and today's figures |
| Category | layout / display |

| State | Description | Trigger |
|---|---|---|
| loading | Header shows the app name; the tiles and the list show the skeleton shapes of the design system, with no numbers | first open, and every re-read after a reconnect |
| populated | As `tv-wall-busy.html` | data loaded |
| empty | As `tv-wall-empty.html` | no orders today |
| takings hidden | As `tv-wall-hidden.html` | setting off (the default) |
| reconnecting | As `tv-wall-reconnecting.html`; figures stay, the header shows "Reconnecting… last update HH:MM" | live connection lost |
| error | When the first read fails, the screen reads "Can't reach the restaurant server. Trying again…" and retries every 10 s | first read fails |
| signed out | Staff PIN screen (unchanged) | any read answers "not signed in" |

| Behaviour | Rule |
|---|---|
| Ordering | Oldest placed first; same second → lower order number first (AC2.1.1) |
| Wait | Whole minutes since placement, from the server's clock offset; recounted every 15 s without an event (AC2.2.3, FR7.3) |
| Wait labels | none below 8 min; "Slow" from 8 min; "Late" from 15 min (AC2.1.3) |
| Overflow | When the open orders do not fit, the last visible row reads "+N more" (AC2.1.4) |
| Oldest wait tile | Same minutes and label as the top row; red outline when "Late"; "No open orders" when empty |
| Takings tile | "Today's takings" and "On open tables" in the staff money format; $0.00 when zero; "Takings hidden" in both places when the setting is off |
| Busiest table / top dish | Ties: lower table number, then the name first in the alphabet; "No orders yet" and "No dishes yet" when empty |
| Requests strip (Could) | Shown only while a table has an open request; "Table N — Waiter" or "Table N — Bill", oldest first; "+N more" when they do not fit on one line |
| Live updates | Order placed, status change, cancel, table closed, request opened or answered, setting changed: within 2 s for 95% of changes (AC5.1.1) |
| Reconnect | Keep the figures, show "Reconnecting…", re-read everything when back (AC5.1.2) |
| Staying signed in | The TV's own reads count as staff activity, so 12 hours idle never signs it out (AC5.2.1) |
| Day rollover | At local midnight the figures restart for the new day on the next minute's recount |
| Motion | Changed rows and tiles fade in 220 ms; nothing moves when reduced motion is requested |

| Breakpoint | Behaviour |
|---|---|
| 1920 by 1080 and larger | As designed; larger screens keep the layout and grow the gaps |
| 1280 to 1919 wide | Same two columns; the figures column is 40% of the width; still at least 32 px text, fewer rows, "+N more" covers the rest |
| below 1280 wide | Not a supported TV size; the columns stack (figures first) so the page still works on a laptop |

| Requirement | Implementation |
|---|---|
| ARIA role | `main` with two labelled regions: "Open orders" (`h1`) and "Today's figures" (`aside`) |
| Keyboard interaction | None needed; nothing on the screen can be focused |
| Label / aria-label | Tile labels are visible text above each figure |
| Contrast ratio | WCAG AA in dark and light (see `accessibility-checklist.md`) |
| Screen reader | The header status is a `role="status"` live region ("Live" / "Reconnecting…"). The list is not a live region, to avoid a flood of announcements |
| Focus management | Not applicable |

### Navigation link "TV wall"

| Field | Value |
|---|---|
| Component | Staff navigation entry (new row in the existing page registry) |
| Description | Opens the TV wall full screen |
| Category | navigation |

| State | Description | Trigger |
|---|---|---|
| default / hover / focus | As the other navigation links | — |
| current | Never shown as current: the TV wall has no navigation | — |

| Requirement | Implementation |
|---|---|
| Keyboard interaction | Tab to focus, Enter to follow |
| Label | Visible text "TV wall" with the 📺 icon |
| Contrast / target | As the existing links; at least 44 px tall |

### Switch "Show takings on TV"

| Field | Value |
|---|---|
| Component | TvTakingsSwitch |
| Description | Turns the restaurant-wide takings setting on or off |
| Category | input |

| State | Description | Trigger |
|---|---|---|
| off (default) | Knob left, word "Off" | setting off |
| on | Knob right in accent colour, word "On" | setting on |
| saving | Shows the new position at once; returns to the old one if the save fails | toggled |
| focus | 3 px accent outline | Tab |
| disabled | Not used | — |

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| checked | boolean | yes | false | Current setting, kept in step with the live staff stream |

| Requirement | Implementation |
|---|---|
| ARIA role | `switch` with `aria-checked`, labelled by the visible text "Show takings on TV" |
| Keyboard interaction | Tab to focus, Space or Enter to toggle |
| Screen reader | Announces "Show takings on TV, switch, off/on" |
| Contrast / target | Knob and track at least 3:1 against the navigation; row at least 44 px tall |

## Errors the person can see

| Condition | Where | Message | Recovery |
|---|---|---|---|
| First read fails | TV wall | "Can't reach the restaurant server. Trying again…" | Retries every 10 s on its own |
| Live connection lost | TV wall header | "Reconnecting… last update HH:MM" | Re-reads on reconnect |
| Signed out | TV wall | Staff PIN screen | Enter the PIN |
| Switch save failed | Navigation | Switch returns to its old position; the existing "Server did not answer, Try again" banner | Toggle again |
