# Domain Design — Questions

Built on `inception/requirements-analysis/requirements.md`, `inception/user-stories/stories.md` and the code knowledge base (`architecture.md`, `component-inventory.md`).

Settled without asking (earlier answers or the existing code):
- The setting lives on the server for the whole restaurant (requirements Q3).
- The TV wall is a staff page outside the staff shell (requirements Q4).
- The switch sits in the staff navigation (stories Q1).
- Every live change reaches screens through the one shared staff live stream (architecture.md).
- The TV wall's own reads count as staff activity (stories, assumptions).

## Q1. [Architect] Where does the TV wall get its figures from?

Context: the figures already partly exist in different places. The Kitchen Board loads each table's orders separately, and the Sales page reads every past day each time. This choice decides how much new server code is written and how fast the TV is with a long history (NFR6).

A. One new server read, "TV wall summary", that works out everything for today in a single answer (open orders, takings, on open tables, busiest table, top dish, requests, the setting and the server's time). The TV re-reads it whenever a live event says something changed. It reuses the Sales page's money rules but reads only today's rows (Recommended)
B. The TV page calls the existing reads (Sales page, each table's orders, floor map) and works the figures out in the browser
C. The server pushes the whole summary inside every live event, so the TV never reads on its own
D. Not yet defined
X. Other (please specify)

[Answer]: A
