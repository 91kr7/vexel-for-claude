---
status: validated
---

# Batches — Fixed order of sessions in the session list

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [fixed-order](batches/batch-fixed-order.md) | Fixed order | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5 | — | certified | Sessions keep their place while they work |
| [drag-reorder](batches/batch-drag-reorder.md) | Reorder by drag and drop | REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | fixed-order | todo | The user moves a session with drag and drop |

Execution order: `fixed-order`, then `drag-reorder`.

## Assumptions and decisions

- **Two batches.** The spec has two features. Drag and drop needs an order that stays fixed, so `drag-reorder` comes after `fixed-order`.
- **Frontend only.** The order lives in the browser (gatekeeper decision, see `requirements.md`). No route and no server code change.
- **Two new components**, both in `batch-fixed-order`: the order rule and the session order store. The rule is a pure function, so it is tested without a browser. The store holds the state and `localStorage`. SessionList stays a component driven by props.
- **Shared group rule.** The order rule uses the group rule of `groupSessions`. One rule decides the group, so the order and the list never disagree.
- **No new dependency.** Drag and drop uses the native HTML5 API. Playwright drives it in chromium.
- **"Resume Here" gives a new entry.** The spec's assumption does not match the client (see `requirements.md`, "Resume Here"). The plan follows the client: no intervention keeps a place across "Resume Here". Keeping it would need a link between the external id and the new hosted id, which no REQ asks for. Explicit assumption, gatekeeper decision of 2026-11-06. It is not a departure: "Resume Here" always moves the session from "In Other Terminals" to "Running", and a session that changes group goes at the end of its new group (REQ-3).
- **Placement details** of each batch (storage, loading, landing place, drag feedback) are in the "Decisions" section of its batch file.

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT, and every REQ closes in the batch that serves it.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-fixed-order/INT-1`, `INT-2`, `INT-3`, `INT-4`, `INT-5` | fixed-order |
| REQ-2 | `batch-fixed-order/INT-1`, `INT-2`, `INT-3` | fixed-order |
| REQ-3 | `batch-fixed-order/INT-1`, `INT-2`, `INT-3` | fixed-order |
| REQ-4 | `batch-fixed-order/INT-1`, `INT-2`, `INT-3` | fixed-order |
| REQ-5 | `batch-fixed-order/INT-3`, `INT-4` | fixed-order |
| REQ-6 | `batch-drag-reorder/INT-1`, `INT-2`, `INT-5` | drag-reorder |
| REQ-7 | `batch-drag-reorder/INT-1`, `INT-2` | drag-reorder |
| REQ-8 | `batch-drag-reorder/INT-1` | drag-reorder |
| REQ-9 | `batch-drag-reorder/INT-1`, `INT-5` | drag-reorder |
| REQ-10 | `batch-drag-reorder/INT-3`, `INT-4` | drag-reorder |

Every INT of both batches serves at least one REQ. There is no enabling-only intervention.
