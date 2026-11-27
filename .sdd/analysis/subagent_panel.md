---
request_slug: subagent_panel
date: 2026-11-27
type: evolution
size: narrow
reference: .sdd/analysis/session_activity.md
---

# Analysis — Turn panel with subagents only

## Request

> Rivedi le analisi del Turn Panel (session_activity) in questo senso: nel pannello vanno mostrati solo i subagent, non i messaggi della chat principale. I passi dell'agente principale (testi di Claude e chiamate a tool) duplicano quello che si vede già nel terminale delle sessioni ospitate e nella conversazione di quelle esterne, e nei turni lunghi spingono in basso le card dei subagent, che sono l'unica cosa nuova che il pannello aggiunge.

## Reference

[session_activity.md](session_activity.md), "Turn panel" (lines 71-86). The panel shows the tree of the current turn. The tree lists every step of the main agent in order: each text of Claude, and each tool call with its state (lines 74-75). A subagent appears at the step that started it (line 76). While the turn runs, the latest step stays visible (line 86).

Changes:
- The steps of the main agent leave the panel.
- Subagents follow the order in which they started, not the step that started them.
- Auto-scroll follows the latest subagent, not the latest step.
- A turn with no subagents shows a short message.
- Every other requirement of the reference stays true: subagent fields, states and durations, groups, nesting, background subagents, and the subagent conversation (lines 77-84, 88-92).

## Summary

The turn panel shows only the subagents of the turn. In long turns their cards no longer sit below the steps of the main agent.

## Requirements

### Functional

- The panel must show no message of the main conversation: no user message, no text of Claude, no tool call of the main agent.
- The panel must list the subagents of the current turn in the order in which they started.
- A group of subagents that run at the same time must take the place of its first subagent in that order.
- While the turn runs, the panel must keep the latest started subagent visible, unless the user scrolled up.
- A turn with no subagents must show a short message that says so.
- The panel must still mark a turn that has ended, and say when there is no turn yet.
- Every new text must be in English, like the rest of the UI.

## Assumptions

- This is an evolution, not a fix. The panel does what `session_activity.md` asked, and now the requirement changes. The `session_activity` cycle is merged on `main` (PR #44). The orchestrator made this decision as gatekeeper.
- The panel keeps its place, its name and its open/close action. The request changes only its content.
- The user message that starts a turn does not show either. The request excludes every message of the main chat, not only Claude's.
- A turn with no subagents keeps the panel on that turn. The panel does not go back to an older turn with subagents, because past turns are out of scope in the reference.

## Scope

In scope:
- Removing the main agent's texts and tool calls from the turn panel.
- Subagents in start order, auto-scroll to the latest subagent, and the message for a turn with no subagents.

Out of scope:
- The steps of the main agent in the panel. The terminal of a hosted session and the conversation of an external session already show them.
- The list entry: latest text, step time, stall signal and running-tool line stay as they are.
- The fields of a subagent card and the subagent conversation.
- Past turns, and a new name for the panel.
