---
batch: header-footer
feature: Lighter header and footer bar
closed_req: [REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29]
depends: []
---

# Batch header-footer — Lighter header and footer bar

The requirements are in `.sdd/plans/plan-session_list_width/requirements.md`, with the assumptions "Cost label", "Text of an external session", "Footer layout", "Footer height" and "Search and text size controls".

## What this batch builds

- **Footer bar of the open session** → one 40 px row under the terminal or the conversation, with the path, the figures and, on a hosted session, the key hint and the text size controls. SessionView and ConversationView both use it.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, module sessions, beside SessionHeader | Footer bar: 40 px, one row, on surface 1 with a 1 px `--border-subtle` line above. Optional lead text, then the folder path in mono, cut with an ellipsis, with the full path as tooltip. The path shrinks first. An end slot holds items that are never cut. | REQ-19, REQ-21, REQ-22, REQ-25, REQ-28, REQ-29 | — |
| INT-2 | create | frontend, module sessions, beside SessionHeader | Figures of the session summary after the path, as the header chips show them today: context with its warning and error colours, total tokens with the four parts in a tooltip above it on hover and focus, cost with its "incomplete" mark and "estimate at API list prices" as tooltip. A missing figure does not show. | REQ-20, REQ-23, REQ-24, REQ-26, REQ-27 | INT-1 |
| INT-3 | modify | `src/web/sessions/SessionHeader.tsx` | Remove the "/", the path and the context, tokens and cost chips. The header keeps the folder name, the line chip, the state pill, `notice` and the actions. It stays 40 px high on one row from 700 px of main area, and the line chip shrinks first. | REQ-15, REQ-16, REQ-17 | INT-2 |
| INT-4 | modify | `src/web/sessions/SessionHeader.tsx` | The line chip is cut with an ellipsis. It is reachable with Tab and shows its full text in a tooltip, on hover and on keyboard focus. | REQ-18 | INT-3 |
| INT-5 | modify | `src/web/sessions/SessionView.tsx` | Header actions: "Search", "Interrupt" and "Terminate". The TerminalZoomControls leave the header. The hint row becomes the footer: path and figures of `session`, then the Ctrl+Shift+L hint, then the TerminalZoomControls at the right end. | REQ-15, REQ-19, REQ-20, REQ-22, REQ-28, REQ-29 | INT-1, INT-2, INT-3 |
| INT-6 | modify | `src/web/external/ConversationView.tsx` | The header line shows the label or name, not "Open in Another Terminal". Under the content, the footer shows the lead text "Open in Another Terminal · ", then the path and figures of `session`. The "Read-only" chip and "Resume Here" stay in the header. | REQ-16, REQ-19, REQ-20, REQ-21 | INT-1, INT-2, INT-3 |

Notes:

- The summary that SessionView and ConversationView get already carries `usage`: the header shows the figures from it today. The footer reads the same summary, so the figures are computed as today.
- The footer is as high as today's hint row (40 px), so the terminal keeps its number of rows (REQ-28). On an external session the conversation area gets 40 px shorter.

## Human acceptance

### Scenario: The user reads the session details in the footer of a hosted session

- REQ → REQ-15, REQ-17, REQ-19, REQ-20, REQ-22, REQ-28, REQ-29
- Given → a hosted session with some responses runs, and the main area is 700 px wide
- When → the user opens the session
- Then → the header shows on one row only the folder name, the label, the state, "Search", "Interrupt" and "Terminate"
- And → the footer shows the path, the context, the total tokens, the cost, the Ctrl+Shift+L hint and, at its right end, the text size controls

### Scenario: The user sees the token parts and the context warning in the footer

- REQ → REQ-23, REQ-24
- Given → an open session uses 92% of its context
- When → the user moves the focus to the token total with Tab
- Then → a tooltip shows input, output, cache write and cache read
- And → the context value in the footer shows in the error colour

### Scenario: The user opens an external session

- REQ → REQ-16, REQ-19, REQ-20, REQ-21
- Given → a Claude Code session runs in another terminal
- When → the user opens it from the list
- Then → the header shows only the folder name, the label or name, the state, "Read-only" and "Resume Here"
- And → the footer shows "Open in Another Terminal · " with the path, then the context, the total tokens and the cost

### Scenario: Long texts are cut, and their full text stays available

- REQ → REQ-17, REQ-18, REQ-25
- Given → an open session has a very long name and a very long path, and the main area is 700 px wide
- When → the user points at the name in the header
- Then → the header stays on one row, the name ends with "…", and a tooltip shows the full name
- And → the path in the footer also ends with "…", and shows the full path on hover

### Scenario: A new session shows no figures yet

- REQ → REQ-26
- Given → Claude Code has not answered yet in a new hosted session
- When → the user opens the session
- Then → the footer shows the path and no figures, not "0%" or "$0.00"

### Scenario: An ended session keeps its last figures

- REQ → REQ-27
- Given → a hosted session answered at least once, and its footer shows its figures
- When → the user presses "Terminate" and confirms
- Then → the header shows "Ended", and the footer still shows the last figures
