---
slug: subagent_panel
date: 2026-11-27
spec: .sdd/analysis/subagent_panel.md
status: validated
---

# Requirements — Turn panel with subagents only

The words "turn", "current turn", "main conversation", "step", "subagent type", "turn panel" and "workflow subagent" have the meaning of `plan-session_activity/requirements.md`, "Words used below".

## Feature: Turn panel with subagents only

| ID | Requirement |
|----|-------------|
| REQ-1 | The turn panel shows no message of the main conversation: no user message, no text of Claude and no tool call. |
| REQ-2 | The turn panel lists the subagents of the current turn in the order in which they started. |
| REQ-3 | A group of subagents that run at the same time takes the place of its first subagent in that order. |
| REQ-4 | While the turn runs, the turn panel keeps the latest started subagent visible, unless the user scrolled up. |
| REQ-5 | A turn with no subagents shows a short message that says so. |
| REQ-6 | When no turn runs, the turn panel still marks the last turn as ended. |
| REQ-7 | Before the first turn of the session, the turn panel still says that there is no turn yet. |

## Assumptions

The first six points are gatekeeper decisions of 2026-11-27. The last one comes from the spec.

- **Start of a subagent (REQ-2, REQ-3, REQ-4).** A subagent starts at the time of its first line. The duration of `plan-session_activity/REQ-34` counts from the same time.
- **"At the same time" (REQ-3).** It keeps the meaning of the gatekeeper decision of 2026-11-26 (`plan-session_activity/requirements.md`, "At the same time"): subagents started by calls in one message form one group. Two subagents started by different messages are two places in the order, also when their runs overlap. One workflow launch stays one group.
- **Order at every level (REQ-2).** The start order also holds inside a group and among the subagents nested under one parent.
- **Subagents from earlier turns (REQ-2).** The subagents that still run from earlier turns keep their own section at the top of the panel (`plan-session_activity/REQ-39`). They started before the current turn, so the start order already puts them first.
- **Latest started subagent (REQ-4).** It is the one with the latest start at any level, a nested one too. When the user scrolls back to the end of the list, the panel follows again, as today.
- **Message for a turn with no subagents (REQ-5).** "No subagents in this turn." It concerns the current turn only. So it also shows when the section of earlier subagents shows cards, and it shows under the "Ended" mark of an ended turn.
- **The panel stays on a turn with no subagents (REQ-5).** As the spec says (section "Assumptions", fourth point).

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text of the UI is in English.
- This plan replaces these requirements of `plan-session_activity`: REQ-29, REQ-30, REQ-31 and REQ-42 leave; REQ-58 keeps the workflow subagents in the panel, at the place set by REQ-2 and REQ-3.
- Every other requirement of `plan-session_activity` stays true. In particular: the fields, states and durations of a subagent (REQ-32 to REQ-36), groups and nesting (REQ-37, REQ-38), background subagents (REQ-39), the subagent conversation (REQ-49 to REQ-55), and the non-functional REQ-43 to REQ-48.
- The panel keeps its place, its name and its open and close action.
- Out of scope, as in the spec: the list entry (latest text, step time, stall signal, running-tool line); the fields of a subagent card and the subagent conversation; past turns; a new name for the panel.
