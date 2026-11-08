# Delivery Planning Questions

A **Bolt** is one build pass over a piece of the work, ending in something that runs. v2 has three Units (U5 foundation, U6 diner features, U7 staff and kitchen features), so three Bolts: Bolt 5 builds U5, Bolt 6 builds U6 and Bolt 7 builds U7 (v1 used Bolts 1 to 4). The dependency graph from Units Generation says U6 and U7 each need only U5, so the graph allows U5 first, then U6 and U7 at the same time. The **walking skeleton** is the first Unit, built as the smallest working end-to-end slice before the rest: here that is U5. Two decisions are left.

## Q1. [Delivery lead] How should the three Bolts be built?

The project's plan for v2 is to build Bolt 5 first and on its own in the main folder, then Bolts 6 and 7 at the same time, each in its own separate copy of the project, once Bolt 5 is signed off and committed. There is no Bolt 8 because nothing needs both U6 and U7. This answer sets how Construction runs.

A. Build Bolt 5 on its own, then Bolts 6 and 7 in parallel (Recommended)
B. Build them one at a time: Bolt 5, then Bolt 6, then Bolt 7; slower, but only one piece of work in progress at once
C. Not yet defined
X. Other (please specify)

[Answer]: A. Build Bolt 5 on its own, then Bolts 6 and 7 in parallel

## Q2. [Delivery lead] The hand-in is Tuesday 10 November, and U5 is the largest Unit. What should we do if time runs short?

Your scope ranking put 6 features as Must, 6 as Should and 5 as Could. This decides what gives way first.

A. Build each Unit's Must items first, then Should, then Could, and if time runs out cut the Could items first; every Bolt still has to pass its tests before sign-off (Recommended)
B. Build every feature in a Unit before its sign-off, with no ranking inside a Unit
C. Not yet defined
X. Other (please specify)

[Answer]: B. Build every feature in a Unit before its sign-off
