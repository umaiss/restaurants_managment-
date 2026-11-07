# Cross-Unit Traceability — Table Order Web App

## Sources

- [desc] Initial description: "Build the Table Order web app based on ideas/table-order/IDEA.md"
- [scope] Workflow-selected scope: `dpl-workshop`
- Output of `aidlc engine sensor-traceability --stage build-and-test`, 2026-11-07 (second run, after Loop-back 1)

## Verdict: PASS (31 of 31 IDs covered, 0 uncovered)

| ID | Built in | Covered |
|---|---|---|
| FR1.1 | U1 `src/server/routes/menu.ts`; U2 `src/client/hooks/useCart.ts` | Yes |
| FR1.2 | U2 `src/client/screens/diner/MenuScreen.tsx` | Yes |
| FR1.3, FR1.4 | U2 `src/client/screens/diner/CartScreen.tsx` | Yes |
| FR1.5 | U2 `src/client/hooks/useCart.ts` | Yes |
| FR1.6, FR1.7, FR1.8 | U2 `src/client/screens/diner/MyOrdersScreen.tsx` | Yes |
| FR1.9 | U2 `src/client/components/diner/TableClosedTakeover.tsx` | Yes |
| FR2.1 | U3 `src/client/screens/staff/KitchenBoardScreen.tsx` | Yes |
| FR2.2 | U3 `src/client/screens/staff/KitchenBoardScreen.tsx` | Yes |
| FR2.3 | U3 `src/client/components/staff/OrderCard.tsx` | Yes |
| FR2.4 | U3 `src/client/components/staff/NewHighlight.tsx` | Yes |
| FR2.5 | U3 `src/client/hooks/useBoardOrders.ts` | Yes |
| FR2.6 | U3 `src/client/hooks/useMenuAvailability.ts` | Yes |
| FR2.7 | U3 `src/client/components/staff/MenuAvailabilityPanel.tsx` | Yes |
| FR3.1, FR3.3 | U4 `src/server/repositories/billingRepo.ts` | Yes |
| FR3.2 | U4 `src/server/__tests__/billing.test.ts` | Yes |
| FR3.4 | U4 `src/server/__tests__/billing-api.test.ts` | Yes |
| FR3.5 | U4 `e2e/u4-bill-and-close/bill-and-close.spec.ts` | Yes |
| FR3.6 | U2 `src/client/views/TableView.tsx` | Yes |
| FR4.1, FR4.2 | U1 `src/server/sse.ts`; U2 `src/client/hooks/useTableSSE.ts` | Yes |
| FR5.1 | U1 `src/client/App.tsx` | Yes |
| FR5.2 | U1 `src/server/db.ts` | Yes |
| NFR1 | U3 `src/client/hooks/useBoardOrders.ts` | Yes |
| NFR2 | U1 `src/server/repositories/orderRepo.ts` | Yes |
| NFR3 | U1 `src/server/index.ts` | Yes |
| NFR4 | U4 `src/server/__tests__/billing-api.test.ts` | Yes |
| NFR5 | U2 `MyOrdersScreen.tsx`; U3 `OrderCard.tsx` | Yes |
| NFR6 | U2 `DinerTabBar.tsx`; U3 `KitchenBoardScreen.tsx` | Yes |

## Uncovered elements

None. The six IDs that were uncovered in the first run (FR3.1 to FR3.5 and NFR4) now have rows in U4's `code-generation/traceability.json`.

## Coverage that holds in use

- FR3.1, FR3.3, FR3.5 and NFR6 from the screens: the table stays on the Kitchen Board until it is closed, so staff can open its bill and close it. `board-bill-link.spec.ts` and `keyboard-journey.spec.ts` pass in Chromium, Chrome and WebKit.

## Where each check ran

- Node and jsdom: unit, component and server tests (322).
- Real browser engines: the browser flows of every Unit, the keyboard journey and the mockup match in Chromium (50 tests); the same flows (without the mockup match) in installed Google Chrome and in WebKit (29 tests each); the timing check in Chromium.
