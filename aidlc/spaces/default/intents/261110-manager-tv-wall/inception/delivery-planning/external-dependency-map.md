# External Dependency Map — Manager TV Wall

A **Bolt** is one build pass over a piece of the work that ends in something that runs and is signed off.

Neither Bolt depends on anything outside this team and this app. There is no outside API, no data feed, no approval from another team, and no hosting change: everything runs in the existing single Node process with its SQLite file (`inception/units-generation/unit-of-work.md`, `inception/contract-design/contract-summary.md`).

| Item | Owner | Lead time | Bolt it blocks | If it slips |
|---|---|---|---|---|
| A TV to try the finished wall on (43-inch, 1920 by 1080, optional) | Workshop team | None | None: Bolt 9 is tested in a 1920 by 1080 browser window | Test in the browser window only |
