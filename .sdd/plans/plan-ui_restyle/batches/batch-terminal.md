---
batch: terminal
feature: Terminal
closed_req: [REQ-34, REQ-35]
depends: []
---

# Batch terminal

Requirements: `.sdd/plans/plan-ui_restyle/requirements.md`.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/styles.css` (`.session-terminal-panel`) | Set `margin: 16px` instead of `16px 16px 0`. | REQ-34, REQ-35 | — |
| INT-2 | create | e2e tests, session view area | Check that the terminal panel has 16px on all four sides, and that its focus ring stays above the session footer. | REQ-34, REQ-35 | INT-1 |

## Human acceptance

### Scenario: The terminal focus ring stays clear of the footer

- REQ → REQ-34, REQ-35
- Given → a session is open
- When → the user clicks into the terminal
- Then → the terminal panel has the same space on all four sides, and its focus ring does not touch the session footer
