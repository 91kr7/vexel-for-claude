---
batch: fixed-order
feature: Fixed order
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5
depends: —
---

# Batch — Fixed order

Inside each group of the session list, sessions stop moving by themselves. The state groups and their order do not change. The work is in the browser only. The server does not change.

## What this batch builds

- **Order rule** (frontend, sessions area) → computes the new order of each group from the previous order and the current sessions.
- **Session order store** (frontend, sessions area) → keeps the order of the page, and saves it in the browser so that it survives a reload.

## Decisions

- **The order** is one list of session ids per group, by group id of `groupSessions` (`needs-input`, `running`, `external`, `ended`).
- **Storage** is the browser `localStorage`. With no saved order, or a saved value that cannot be read, the store starts from an empty order. The order rule then puts each group in latest-activity order, as today. From then on that order is fixed.
- **Loading.** The store applies the rule only after the first session list has arrived (LiveSessionStore status `ready`). An empty list during loading must not delete the saved order.
- **Return to a group.** A session that left a group dropped out of its list. If it comes back, it is new there and goes at the end (REQ-3).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/session-order.ts` | Export the rule that gives the group of one session, so INT-2 uses the same rule. `groupSessions` takes the order and lists each group in that order, not latest activity first. A session missing from the order goes at the end, latest activity first. | REQ-1, REQ-2, REQ-3, REQ-4 | — |
| INT-2 | create | frontend, sessions area | Order rule, a pure function: previous order + current sessions → new order. A session still in the same group keeps its place. A new session, or one that changed group, goes at the end, latest activity first. A missing session drops out. | REQ-1, REQ-2, REQ-3, REQ-4 | INT-1 |
| INT-3 | create | frontend, sessions area | Session order store: reads the saved order at page load and applies INT-2 to each new session list. It saves every change in `localStorage`. It applies nothing before the first list arrives. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5 | INT-2 |
| INT-4 | modify | `src/web/AppLayout.tsx` | Feed the session order store of INT-3 with the live sessions and their status, and pass its order to SessionList. | REQ-1, REQ-5 | INT-3, INT-5 |
| INT-5 | modify | `src/web/sessions/SessionList.tsx` | Take the order as a new prop and pass it to `groupSessions`. Nothing else changes. | REQ-1 | INT-1 |

The developer updates the specs of `groupSessions`, SessionList and AppLayout, writes the specs of the two new components, and updates the sessions index.

## Human acceptance

### Scenario: Sessions keep their place while they work

- REQ → REQ-1
- Given → the group "Running" shows three hosted sessions A, B, C, in this order
- When → the user opens C and sends it a message, so C works and gets new messages
- Then → the group "Running" still shows A, B, C, in this order, while C works and when it stops

### Scenario: A new session appears at the end of its group

- REQ → REQ-2
- Given → the group "Running" shows A, B, C
- When → the user starts a new session D
- Then → the group "Running" shows A, B, C, D

### Scenario: A session that changes group goes to the end of the new group

- REQ → REQ-3, REQ-4
- Given → the group "Running" shows A, B, C, and the group "Needs Input" shows E
- When → the user sends B a prompt that makes Claude ask for a permission
- Then → "Needs Input" shows E, B, and "Running" shows A, C

### Scenario: A session that comes back to a group goes to the end

- REQ → REQ-3
- Given → "Needs Input" shows E, B, and "Running" shows A, C
- When → the user answers the permission request of B
- Then → "Running" shows A, C, B

### Scenario: The order survives a reload

- REQ → REQ-5
- Given → the group "Running" shows A, C, B, and the latest activity is on B
- When → the user reloads the page
- Then → the group "Running" still shows A, C, B
