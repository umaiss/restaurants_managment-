# Story Map — Manager TV Wall

Each story in `inception/user-stories/stories.md` is mapped to the Units in `unit-of-work.md`, which are built from `inception/domain-design/components.md`. Every story traces back to `inception/requirements-analysis/requirements.md`.

| Story | Unit | Directory |
|---|---|---|
| US1.1 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US1.2 | U8 | u8-tv-foundation |
| US2.1 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US2.2 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US3.1 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US3.2 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US3.3 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US4.1 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US4.2 | U8 | u8-tv-foundation |
| US5.1 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |
| US5.2 | U8 | u8-tv-foundation |
| US5.3 | U8; U9 | u8-tv-foundation; u9-tv-wall-screen |

## Rows That Span Both Units

Most stories span both Units. U8 provides the data, the rules, the live updates and a plain screen that shows them. U9 provides the finished look the acceptance criteria describe:
- sizes and layout (US1.1);
- the Slow and Late words and bars (US2.1);
- the empty wording and "Takings hidden" (US2.2, US3.x, US4.1);
- the "Reconnecting…" header (US5.1);
- the requests strip (US5.3).

US1.2, US4.2 and US5.2 are entirely U8's: the sign-in gate, the switch and the session refresh.

## Implementation Order Within Each Unit

- **U8:**
  1. The setting and its upgrade step.
  2. The new repository reads and the shared Sales rule.
  3. The summary module.
  4. The routes and the event.
  5. The navigation link and switch.
  6. The plain page and its data hook.
  7. The tests.
- **U9:**
  1. The layout and the type sizes.
  2. The orders list and its states.
  3. The figure tiles.
  4. The header states, the loading state and the error state.
  5. The requests strip.
  6. The tests, including mockup match.

## Coverage Verification

- All 12 stories are assigned. US5.3 is a Could; it is mapped so the build includes it if time allows.
- Both Units have rows: U8 has 12 and U9 has 9.
