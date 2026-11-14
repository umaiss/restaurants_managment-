# Units Generation — Questions

Built on `inception/domain-design/components.md` and `decisions.md`, `inception/requirements-analysis/requirements.md` and `inception/user-stories/stories.md`.

Settled without asking:
- One process and one SQLite file, as today (components.md).
- v1's Units U1 to U4 and v2's Units U5 to U7 are done and never planned again, so this work's Units are numbered from U8.
- The first Unit is the walking skeleton: the smallest working slice that runs end to end (project rules).

## Q1. [Architect] How should the TV wall work be split into Units?

Context: the work is small: one new screen, one switch, one setting and one new server read. More Units allow parallel building, but each adds a merge and a checkpoint.

A. Two Units, one after the other:
   - U8 `u8-tv-foundation`, the walking skeleton: the setting, the summary read and its routes, the new live event, the navigation link and switch, and a plain TV wall page wired to live data.
   - U9 `u9-tv-wall-screen`: the finished TV wall exactly as the mockups draw it.

   (Recommended)
B. One Unit for everything: U8 `u8-tv-wall`
C. Three Units:
   - U8 `u8-tv-foundation`, the server parts and a plain page;
   - then U9 `u9-tv-wall-screen` and U10 `u10-tv-takings-switch`, built in parallel.
D. Not yet defined
X. Other (please specify)

[Answer]: A
