# Intent Statement: Table Order v2

## Problem Statement

- The team wants to build Table Order v2, a follow-up to the existing Table Order app. [desc]
- v2 adds five features that v1 left out: Staff PIN, Notifications, Past visits and sales, Menu management and QR codes. [Q1]
- v2 adds six features that most ordering apps do not have: Make it yours, Honest wait time, Allergy shield, Chef's special drop, Live floor map and Kitchen stations. [Q2]
- v2 adds six X-factors, the parts a judge remembers: Animated order tracker, Kitchen ticket timers, Dark mode, "Same again", Call the waiter / Ask for the bill, and Rate your meal. [Q3]

## Target Customer

- Diners: they are told when an order is ready, set their allergies once, see an estimated wait, track their order, re-add a previous order with one tap, rate their dishes, and can switch to dark mode. [Q1] [Q2] [Q3]
- Restaurant staff: they use a PIN-protected staff view, are alerted to new orders, print table QR codes, manage the menu, see past visits and sales, launch Chef's specials, watch a live floor map, and respond to waiter and bill calls. [Q1] [Q2] [Q3]
- Kitchen staff: they see each order's options on the ticket, work from a board per station, and see tickets turn amber, then red, as an order ages. [Q2] [Q3]

## Success Metrics

- Each of the five chosen List A features works as described, which the team can show running: Staff PIN, Notifications, Past visits and sales, Menu management and QR codes. [Q1]
- Each of the six chosen List B features works as described, which the team can show running: Make it yours, Honest wait time, Allergy shield, Chef's special drop, Live floor map and Kitchen stations. [Q2]
- Each of the six chosen X-factors works as described, which the team can show running: Animated order tracker, Kitchen ticket timers, Dark mode, "Same again", Call the waiter / Ask for the bill, and Rate your meal. [Q3]

## Initiative Trigger

- The trigger for this work is not yet known; see the open items under Assumptions & Open Questions. [desc]

## Initial Scope Signal

- Workflow-selected scope: `dpl-workshop`. [scope] (workflow-selected)
- User-confirmed product boundary: none recorded in this stage. The feature picks in Q1, Q2 and Q3 say what is in; nothing is excluded by leaving a feature unpicked. [Q1] [Q2] [Q3]

## Assumptions & Open Questions

- v2 is new work on top of the existing v1 app, and v1's screens, behaviour, tests and data stay as they are unless the team chooses to change them in Scope Definition. [assumption]
- Out of scope for this first version: payments, native mobile apps, cloud deployment, diner accounts, email or SMS, and anything that needs a paid external service. [assumption]
- Success also means `npm test && npm run test:e2e` passes (v1's tests included), every new or changed screen has a mockup-match test, and every new screen looks professional on a small design system. [assumption]
- The work is due Tuesday 10 November 2026, end of day, with a 5-minute demo after the hand-in. [assumption]
- The team picked 17 features in all (5 + 6 + 6) for a hand-in three days away, while the brief says fewer things done well beat many things half done. Scope Definition should confirm the full list or trim it. [assumption]
- Open question: which v1 screens or behaviours change, if any (for example a redesigned Menu), is for Scope Definition. [assumption]
- Open question: whether staff-only actions (Menu management, Chef's special drop, Past visits and sales) sit behind the Staff PIN or open like the v1 staff view is for Requirements Analysis. [assumption]
- Open question: whether the wait estimate and order tracker show minutes or "about right / running late" is for Requirements Analysis. [assumption]
- The initiative trigger is not yet known. [assumption]
