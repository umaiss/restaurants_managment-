# Team Allocation — Manager TV Wall

A **Bolt** is one build pass over a piece of the work that ends in something that runs and is signed off. A **mob** is the group that builds a Bolt together. This plan has no Team Formation stage, so there is one mob for both Bolts. The AI developer builds, and the workshop team decides and signs off (`ideation/intent-capture/stakeholder-map.md`).

| Bolt | Unit | Builds | Decides and signs off |
|---|---|---|---|
| 8 | U8 `u8-tv-foundation` (from `inception/units-generation/unit-of-work.md`) | AI developer (`aidlc-developer-agent`) | Workshop team |
| 9 | U9 `u9-tv-wall-screen` | AI developer (`aidlc-developer-agent`) | Workshop team |

- Code reviews at each checkpoint are done by a separate AI reviewer.
- The team runs no tests by hand. The AI runs them and shares the results before asking for sign-off (project rules).
- With a single mob, no Program Board (a cross-team plan of who builds what when) is needed.
