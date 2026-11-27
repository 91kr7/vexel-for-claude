---
request_slug: subagent_panel
date: 2026-11-27
type: evolution
size: narrow
reference: .sdd/analysis/session_activity.md
---

# Analysis — Turn panel with subagents only, as a list

## Request

> Rivedi le analisi del Turn Panel (session_activity) in questo senso: nel pannello vanno mostrati solo i subagent, non i messaggi della chat principale. I passi dell'agente principale (testi di Claude e chiamate a tool) duplicano quello che si vede già nel terminale delle sessioni ospitate e nella conversazione di quelle esterne, e nei turni lunghi spingono in basso le card dei subagent, che sono l'unica cosa nuova che il pannello aggiunge.

> Riapri il piano precedente (.sdd/analysis/subagent_panel.md, .sdd/plans/plan-subagent_panel/) e aggiungi questa evoluzione: nel Turn Panel i subagent vanno resi come lista, non come card affiancate. Una riga a tutta larghezza per subagent, in ordine di avvio dall'alto in basso; i subagent annidati rientrati sotto il padre, come un albero; i subagent lanciati insieme (stesso gruppo) uniti da un segno visivo sulla sinistra, uno sotto l'altro invece che affiancati. Ogni riga mostra gli stessi campi di oggi (tipo, task, modello, stato, durata, ultimo testo, tool in esecuzione) e un clic apre la conversazione del subagent come adesso. Motivo: il pannello sta accanto al terminale ed è stretto; con 2-3 subagent in parallelo le colonne da 180 px tagliano task e ultimo testo, gli annidati si stringono ancora di più dentro la card, l'ordine di avvio si legge a zig-zag e con i workflow (10+ agenti) la griglia diventa un mosaico difficile da scorrere. Cambia REQ-37 di session_activity ("side by side" → uno sotto l'altro, uniti come gruppo).

## Reference

[session_activity.md](session_activity.md), "Turn panel" (lines 71-86). The panel shows the tree of the current turn. The tree lists every step of the main agent in order: each text of Claude, and each tool call with its state (lines 74-75). A subagent appears at the step that started it (line 76). While the turn runs, the latest step stays visible (line 86).

Changes:
- The steps of the main agent leave the panel.
- Subagents follow the order in which they started, not the step that started them.
- Auto-scroll follows the latest subagent, not the latest step.
- A turn with no subagents shows a short message.
- Each subagent shows as a full-width row instead of a card, with the same fields and the same click (lines 77, 89).
- A group shows one below the other, joined by a mark on the left, not side by side (line 82; the request calls it REQ-37).
- A nested subagent shows indented under its parent (line 83).
- Every other requirement of the reference stays true: subagent fields, states and durations, background subagents, and the subagent conversation (lines 77-81, 84, 88-92).

## Summary

The turn panel shows only the subagents of the turn, one full-width row each. Nesting shows as an indent, and a group as rows joined by a mark on the left.

## Requirements

### Functional

- The panel must show no message of the main conversation: no user message, no text of Claude, no tool call of the main agent.
- The panel must list the subagents of the current turn from top to bottom, in the order in which they started.
- A group of subagents that run at the same time must take the place of its first subagent in that order.
- Each subagent must take its own row, as wide as the panel minus the indent of its level.
- A subagent started by another subagent must appear under its parent, indented by one level, in start order among its siblings.
- The subagents of a group must appear one below the other, joined on the left by a mark at their nesting level.
- The subagents nested under a member of a group must not look like members of that group.
- A group of one subagent must have no mark.
- The panel must never need horizontal scrolling, also with three levels of nesting.
- While the turn runs, the panel must keep the latest started subagent visible, unless the user scrolled up.
- A turn with no subagents must show a short message that says so.
- The panel must still mark a turn that has ended, and say when there is no turn yet.
- Every new text must be in English, like the rest of the UI.

## Assumptions

- This is an evolution, not a fix. The panel does what `session_activity.md` asked, and now the requirement changes. The `session_activity` cycle is merged on `main` (PR #44). The orchestrator made this decision as gatekeeper.
- The panel keeps its place, its name and its open/close action. The request changes only its content.
- The user message that starts a turn does not show either. The request excludes every message of the main chat, not only Claude's.
- A turn with no subagents keeps the panel on that turn. The panel does not go back to an older turn with subagents, because past turns are out of scope in the reference.
- A row is one full-width entry per subagent and may take several lines. The seven fields do not fit on one line of a narrow panel.
- A group keeps the definition already in use. This request changes only how a group is drawn.
- The latest text keeps its two-line limit (session_activity.md line 80). The row gives it more width, not more lines.

## Scope

In scope:
- Removing the main agent's texts and tool calls from the turn panel.
- Subagents in start order, auto-scroll to the latest subagent, and the message for a turn with no subagents.
- Subagents as full-width rows, with nesting by indent and groups joined by a mark on the left.

Out of scope:
- The steps of the main agent in the panel. The terminal of a hosted session and the conversation of an external session already show them.
- The list entry: latest text, step time, stall signal and running-tool line stay as they are.
- The fields of a subagent and the subagent conversation.
- Past turns, a new name for the panel, and its width.
