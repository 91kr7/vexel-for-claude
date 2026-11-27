---
slug: subagent_panel
date: 2026-11-27
spec: .sdd/analysis/subagent_panel.md
status: validated
---

# Requirements — Turn panel with subagents only, as a list

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

## Feature: Subagents as a list

| ID | Requirement |
|----|-------------|
| REQ-8 | Each subagent takes its own row, as wide as the turn panel minus the indent of its level. |
| REQ-9 | A subagent started by another subagent shows under the row of its parent, indented by one level more. |
| REQ-10 | The subagents of a group show one below the other, joined on the left by a mark at their level. |
| REQ-11 | The subagents nested under a member of a group do not look like members of that group. |
| REQ-12 | A group of one subagent has no mark. |
| REQ-13 | The turn panel never needs horizontal scrolling, also with three levels of nesting. |

## Assumptions

### Turn panel with subagents only

The first six points are gatekeeper decisions of 2026-11-27. The last one comes from the spec.

- **Start of a subagent (REQ-2, REQ-3, REQ-4).** A subagent starts at the time of its first line. The duration of `plan-session_activity/REQ-34` counts from the same time.
- **"At the same time" (REQ-3).** It keeps the meaning of the gatekeeper decision of 2026-11-26 (`plan-session_activity/requirements.md`, "At the same time"): subagents started by calls in one message form one group. Two subagents started by different messages are two places in the order, also when their runs overlap. One workflow launch stays one group.
- **Order at every level (REQ-2).** The start order also holds inside a group and among the subagents nested under one parent.
- **Subagents from earlier turns (REQ-2).** The subagents that still run from earlier turns keep their own section at the top of the panel (`plan-session_activity/REQ-39`). They started before the current turn, so the start order already puts them first.
- **Latest started subagent (REQ-4).** It is the one with the latest start at any level, a nested one too. When the user scrolls back to the end of the list, the panel follows again, as today.
- **Message for a turn with no subagents (REQ-5).** "No subagents in this turn." It concerns the current turn only. So it also shows when the section of earlier subagents shows subagents, and it shows under the "Ended" mark of an ended turn.
- **The panel stays on a turn with no subagents (REQ-5).** As the spec says (section "Assumptions", fourth point).

### Subagents as a list

Planner defaults, accepted by the gatekeeper on 2026-11-27. The last two points are gatekeeper decisions of the same day. The row and the group follow the spec (section "Assumptions", points five to seven).

- **Level (REQ-8, REQ-9, REQ-10, REQ-13).** A subagent that no subagent started is at level 0. A subagent started by a subagent of level n is at level n + 1. "Three levels of nesting" means rows down to level 3.
- **Row (REQ-8).** One entry per subagent, in the place of its card. It may take several lines. It keeps the fields and the click of the card (`plan-session_activity/REQ-32` to `REQ-36`, `REQ-49`). The latest text keeps its limit of two lines. The section of earlier turns shows rows too.
- **Width (REQ-8, REQ-13).** The width of the turn panel does not change (spec, "Out of scope"). REQ-8 and REQ-13 hold at every width the panel can take today. The indent of a level includes its mark.
- **Under its parent (REQ-9).** The nested rows come after the row of their parent and before the next row at the level of the parent, as in a tree. Among them, the start order of REQ-2 holds ("Order at every level").
- **Group and member (REQ-10, REQ-11, REQ-12).** A group keeps the meaning of REQ-3, "At the same time". Only its drawing changes. Its members are its own subagents, not the subagents nested under them.
- **Mark of a group (REQ-10, REQ-11).** One vertical line at the left of the group's level, from the first member row to the last one. When a member has nested rows, the line runs on beside them, down to the next member. Each member row has a short tick on the line. A nested row has no tick on it and starts one level further right. Reason: the tick makes REQ-11 checkable.
- **Any depth (REQ-9, REQ-13).** Every level adds the same indent. A row never needs more width than it gets: its texts wrap or end with an ellipsis. Three levels is the case to test. Reason: an indent that stops growing would break REQ-9.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text of the UI is in English.
- This plan replaces these requirements of `plan-session_activity`: REQ-29, REQ-30, REQ-31 and REQ-42 leave; REQ-58 keeps the workflow subagents in the panel, at the place set by REQ-2 and REQ-3; REQ-37 keeps its groups, but they show as REQ-10 sets, not side by side.
- Every other requirement of `plan-session_activity` stays true. In particular: the fields, states and durations of a subagent (REQ-32 to REQ-36), nesting (REQ-38, shown as REQ-9 sets), background subagents (REQ-39), the subagent conversation (REQ-49 to REQ-55), and the non-functional REQ-43 to REQ-48.
- The panel keeps its place, its name and its open and close action.
- Out of scope, as in the spec: the list entry (latest text, step time, stall signal, running-tool line); the fields of a subagent and the subagent conversation; past turns; a new name for the panel and its width.
