# Cross-Unit Traceability: Table Order v2

The final coverage gate across all Units, from `aidlc engine sensor-traceability --stage build-and-test`. It traces every requirement (FR and NFR) through the acceptance criteria of its story to the Unit and files that build it. A criterion that a Unit does not build is marked `N/A` there with the owning Unit named (U5 foundation, U6 diner features, U7 staff and kitchen features), so every criterion is built by at least one Unit.

**Verdict: pass with 2 uncovered requirements that no Unit builds: `NFR5` (browsers) and `NFR6` (tests).** They are verified by this stage itself, in rows `NFR5-BROWSERS` and `NFR6-TESTS` of the Target Verification Matrix in `build-and-test-summary.md`, so the tool lists them as uncovered by a Unit; this is surfaced for the approval gate rather than hidden.

## Coverage by requirement group

| Requirements | Story | Built by | Per-Unit traceability | Verdict |
|---|---|---|---|---|
| FR1.1 to FR1.4 | US1.1 A professional look | U5 (design system, the five v1 screens), U6 and U7 (their new screens) | each Unit's `code-generation/traceability.json` | Covered |
| FR2.1 to FR2.4 | US2.1 Dark mode | U5 (themes, switch, saved choice), U6 (the Settings control) | same | Covered |
| FR3.1 to FR3.6 | US3.1 Staff PIN | U5 | same | Covered |
| FR4.1 to FR4.4 | US4.1 Told when ready | U5 (shared alert logic), U6 (diner banner), U7 (staff alert) | same | Covered |
| FR5.1 to FR5.5 | US5.1 Past visits and sales | U5 (Completed time), U7 (page and routes) | same | Covered |
| FR6.1 to FR6.6 | US6.1 Manage the menu | U5 (hidden items), U7 (staff editing), U6 (cart refresh notice) | same | Covered |
| FR7.1 to FR7.3 | US7.1 QR codes | U7 | same | Covered |
| FR8.1 to FR8.6 | US8.1 Make it yours | U5 (options, frozen price), U6 (sheet, cart lines), U7 (ticket, bill, editing) | same | Covered |
| FR9.1 to FR9.5 | US9.1 Honest wait time | U5 (estimate), U6 (display) | same | Covered |
| FR10.1 to FR10.5 | US10.1 Allergy shield | U5 (data), U6 (chips, marks, warning), U7 (editing) | same | Covered |
| FR11.1 to FR11.5 | US11.1 Chef's special | U5 (engine), U6 (card), U7 (page) | same | Covered |
| FR12.1 to FR12.4 | US12.1 Floor map | U7 | same | Covered |
| FR13.1 to FR13.5 | US13.1 Kitchen stations | U5 (station on lines, done marks), U7 (boards, done, completion) | same | Covered |
| FR14.1 to FR14.4 | US14.1 Order tracker | U6 | same | Covered |
| FR15.1 to FR15.4 | US15.1 Ticket timers | U7 | same | Covered |
| FR16.1 to FR16.3 | US16.1 Same again | U6 | same | Covered |
| FR17.1 to FR17.5 | US17.1 Call the waiter / bill | U5 (engine), U6 (card), U7 (pulse, Respond) | same | Covered |
| FR18.1 to FR18.4 | US18.1 Rate your meal | U5 (engine), U6 (thumbs, plus the closed-visit read), U7 (best and worst) | same | Covered |
| FR19.1 to FR19.5 | US19.1 v1 keeps working | U5 (upgrade, seed, events, page route), U7 (new staff pages from any folder) | same | Covered |
| NFR1 to NFR4, NFR7, NFR8 | (cross-cutting) | traced through the acceptance criteria of the stories above, and verified in the matrix | `build-and-test-summary.md` | Covered |
| NFR5, NFR6 | (verified by this stage) | no Unit builds them | rows `NFR5-BROWSERS`, `NFR6-TESTS` | **Uncovered by a Unit: verified here, Met** |

## Owning Unit and target files

The Unit, the acceptance criterion, and the file that builds or tests it are listed per ID in each Unit's `traceability.json`:

- `construction/u5-foundation/code-generation/traceability.json`
- `construction/u6-diner-features/code-generation/traceability.json`
- `construction/u7-staff-kitchen-features/code-generation/traceability.json`

Each was checked with the traceability tool when the Unit was built (no gaps, no orphans, every `OK` target an existing file), and the tool output behind this document has no uncovered acceptance criterion, functional requirement or story.

## Uncovered elements (for the approval gate)

| ID | Why | Where it is verified |
|---|---|---|
| NFR5 | A browser-support target: it is a property of the whole app, not something a Unit builds | `NFR5-BROWSERS`: 170 browser tests in Chromium; 212 passed (2 skipped on purpose) in Google Chrome and WebKit |
| NFR6 | A test-suite target: it is verified by running the project's check, not by building a feature | `NFR6-TESTS`: `npm test && npm run test:e2e` exit 0; mockup-match specs for every Unit; no limit lowered |
