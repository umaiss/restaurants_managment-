**Reviewer:** aidlc-architecture-reviewer-agent
**Stage:** functional-design
**Unit:** u4-bill-and-close
**Iteration:** 1
**Date:** 2026-11-05T10:33:24Z
**Review artifact:** functional-spec.md

### Review

**Verdict:** READY

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/functional-design/functional-spec.md > Keyboard and accessibility (NFR6) vs Screen S2 — Table Bill / Close table button state | The accessibility section says the Close table button uses `disabled` (excluded from tab order), but the button state table above it says `aria-disabled` for the two disabled states. These are different HTML attributes with different behaviour: `disabled` removes the element from tab order and prevents click, while `aria-disabled` keeps it in tab order but signals it semantically. The spec cannot specify both; only one can be implemented. | Pick one and apply it consistently. Given the spec's stated intent ("excluded from tab order when disabled"), `disabled` is the correct attribute; remove `aria-disabled` from the button state table, or update the accessibility section to match whichever attribute is chosen. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/functional-design/functional-spec.md > Frontend component outline > ConfirmModal | The component outline shows `ConfirmModal — shared from U2`. The project rule states every Unit's code depends only on the walking skeleton, never on another Unit. U2 is a sibling Unit, not the skeleton. If U4 imports from U2, the two Units are coupled, which violates the stated independence that allows each to be built and merged separately. | Either move `ConfirmModal` into U1 (the walking skeleton) so all Units share it from there, or implement a self-contained modal inline in U4 without importing from U2. The choice should be reflected in the Code Generation plan. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261105-table-order-app/construction/u4-bill-and-close/functional-design/entities.md > Entities owned by other components > getCurrentVisit | The entities file notes that `getCurrentVisit(tableId)` is used by `billingRepo.ts` to resolve the active visit before calling `getOrdersForVisit(tableId, visitId)`, but it is explicitly flagged as not named in the shared contracts. Without a contract entry for `getCurrentVisit`, a developer implementing U4 must guess the method signature, return shape, and error behaviour (for example, what it returns when the table is closed or has no visit). | Add `getCurrentVisit(tableId)` to the shared contracts (contract-summary.md), or document its signature, return shape, and error cases in this functional design as a local contract addendum so a developer has a complete, unambiguous specification. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (none listed for this stage) | — | No automated validation tools were declared for the functional-design stage; review is based on artifact inspection only. |

### Summary

The U4 functional design is well-structured and internally consistent on the core billing and close-guard logic. The three findings are Minor: a `disabled`/`aria-disabled` contradiction in the accessibility section, a cross-unit component dependency on U2's `ConfirmModal` that breaks the skeleton-only dependency rule, and an uncontracted in-process call (`getCurrentVisit`) that leaves an implementer without a full specification. None blocks implementation, but all three should be resolved before the Code Generation plan is written.
