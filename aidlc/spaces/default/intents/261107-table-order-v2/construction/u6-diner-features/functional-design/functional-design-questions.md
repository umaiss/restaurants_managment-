# Functional Design Questions: u6-diner-features

U6 is everything the diner sees and does that is new, built on U5. Nearly all of it is settled by the stories, the screens you approved in Refined Mockups, the interaction specification and U5's finished design, so I decided the small points myself and list them under Assumptions in `functional-spec.md`. One point is a real choice for you, because it decides whether U6 changes a server route that U5 already finished.

## Q1. [Architect] Where does the "Rate your meal" screen get the list of dishes once the table is closed?

After Close table, the diner's screen shows each dish from that visit with a thumbs up and a thumbs down. The only order list the server gives a diner today is for the table's open visit, which no longer exists once the table is closed. So the screen needs one of two sources.

A. Add a small, additive option to the existing orders route that returns the dishes of the table's most recently closed visit, so the thumbs show after a reload and on a second phone at the same table (Recommended)
B. No server change: the phone remembers the dishes while the visit is open, so a diner who opens the table page only after it was closed (a fresh scan, a second phone) sees the closed message with no thumbs
C. Not yet defined
X. Other (please specify)

[Answer]: A. Add a small additive option to the existing orders route
