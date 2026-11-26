---
request_slug: session_activity
date: 2026-11-26
type: evolution
size: ordinary
reference: .sdd/analysis/session_list_improvements.md
---

# Analysis — Live activity of sessions and subagents

## Request

> Voglio vedere cosa sta facendo davvero ogni sessione di Claude, subagent compresi, senza dover chiedere a Claude "stai facendo qualcosa?" e senza dover leggere il terminale. Tre parti:
> 1. Nella lista delle sessioni, sotto ogni sessione: l'ultima frase in cui Claude dice cosa sta facendo (l'ultimo testo dell'assistente) e da quanto tempo è in corso il passo attuale, ad esempio "Sovrascrivo l'intera classe CommonServiceImpl…" · da 3 min. Così mi accorgo di una direzione sbagliata guardando la lista, anche mentre sto lavorando su un'altra sessione.
> 2. Un pannello accanto al terminale (come il git explorer) con l'albero del turno in corso: i passi dell'agente principale e, per ogni subagent, tipo, compito (descrizione), modello, durata, stato (in corso / finito), la sua ultima frase e il tool che sta usando. I subagent in parallelo si vedono uno accanto all'altro. Con un clic su un subagent si apre la sua conversazione, aggiornata in tempo reale.
> 3. Un segnale "fermo o lento?": quando una sessione al lavoro non registra attività da alcuni minuti, la card lo dice, ad esempio "nessuna attività da 8 min · mvn test in corso", così so se intervenire.
> Deve funzionare per le sessioni ospitate e per quelle esterne, solo in lettura, senza rete e senza permessi nuovi.
> Contesto emerso dall'analisi dei miei dati di utilizzo (transcript degli ultimi 3 mesi e cronologia dei prompt da giugno): 134 messaggi scritti a sessioni ancora al lavoro, molti per correggere Claude ("aspetta!! ma che stai facendo!!", "non usare il workflow sdd!"), 90 interruzioni, almeno 6 volte "stai facendo qualcosa?" o "cosa stai facendo?", 49 casi di più di 5 minuti senza attività registrata durante un turno; 532 esecuzioni di subagent (soprattutto sdd-tester e sdd-developer), durata mediana 7 minuti e 37 chiamate a tool, il 10% oltre 33 minuti, uno quasi 16 ore; 115 turni con 2-5 subagent in parallelo. Oggi la card mostra solo che c'è un Agent in corso.
> Note tecniche: per ogni subagent Claude Code scrive `<transcript>/subagents/agent-<id>.jsonl` e `agent-<id>.meta.json` (agentType, description, toolUseId della chiamata che lo ha avviato, pickedEffortModel, finished). Vexel trova già i file dei subagent (src/server/external/transcript-reader.ts, subagentFilesOf), segue già una conversazione in tempo reale via WebSocket (src/server/external/conversation-stream-route.ts) e la mostra con ConversationView. Il formato dei transcript è interno a Claude Code e può cambiare.

## Reference

[session_list_improvements.md](session_list_improvements.md) → a working entry, hosted or external, shows the tool that Claude runs at that moment, for example "Bash: npm test" (line 54). The line shows only the tool calls of the main conversation (line 60). Tool history beyond the current tool is out of scope (line 117). Other base rules:
- An external session shows its conversation read-only and live ([claude_sessions_client.md](claude_sessions_client.md), lines 77-78).
- The request takes the git explorer ([git_explorer.md](git_explorer.md)) as the model for a panel next to the terminal.

Changes:
- An entry at work also shows Claude's latest text and the time of the current step.
- An entry at work signals a long stretch with no activity.
- A new panel shows the tree of the turn, with the subagents and their live conversations.
- The tool history of the turn moves into scope, in the panel only.
- Every other requirement of the reference stays true, the running-tool line included.

## Summary

For every hosted and external session, the user sees what Claude and its subagents are doing without reading the terminal. The list entry shows Claude's latest text, the time of the current step, and a signal after 5 minutes with no activity. A panel next to the terminal shows the tree of the turn and opens the live conversation of each subagent.

## Business goal

The user corrects working sessions often, and late. The request reports 134 messages to working sessions, many of them corrections, and 90 interrupts. The user asked "are you doing something?" at least 6 times. A turn had more than 5 minutes with no recorded activity 49 times. Subagents ran 532 times, with a median of 7 minutes and 37 tool calls; 10% ran over 33 minutes. 115 turns ran 2-5 subagents in parallel. Today the entry shows only that an Agent runs. The value is to see a wrong direction or a stuck session from the list, and to decide whether to step in.

## Requirements

### Functional

At work
- A session is at work while it is working, or while at least one of its subagents runs, also after its turn ended.

Latest text on the list entry
- The entry of a session at work, hosted or external, must show the latest text Claude wrote in the current turn.
- The text must come from the main conversation or from a running subagent, whichever wrote last.
- A text from a subagent must start with the subagent type, for example "sdd-developer: Overwriting the whole CommonServiceImpl class…".
- Thinking must not count as text.
- The text must show as plain text without markdown, cut with an ellipsis to at most two lines of the entry.
- The line must end with the time since that text was written, for example "· 3 min", and the time must count up.
- Before the first text of the turn, the entry must show no text line. A text from an earlier turn must never show.
- The line must not show on a session that needs input, has ended, or is not at work.

Stall signal
- When a session at work has no activity for 5 minutes, its entry must show a signal, for example "No activity for 8 min · mvn test running".
- Activity must be any new message, tool call or tool result in the main conversation or in any subagent of the session.
- The signal must name what the session waits for: the running tool with its main argument, or Claude's response when no tool runs.
- A running tool of a subagent must carry the subagent type, for example "sdd-tester: mvn test".
- When several tools run, the signal must name the one that started first and the count of the others, for example "+2".
- The time in the signal must count up while the silence lasts.
- The signal must disappear at the next activity, or when the session is no longer at work.
- A session that needs input must not show the signal.
- The signal must look different from the latest-text line.
- The signal must not change the state of the session, its group or its place in the list.

Turn panel
- The user must be able to open and close a panel next to the session view, as with the git explorer, for hosted and external sessions.
- The panel must show the tree of the current turn. A turn starts with a message that the user sends.
- The tree must list the steps of the main agent in order: each text of Claude, and each tool call with its name and main argument.
- Each tool call must show whether it runs or has finished.
- A subagent must appear in the tree at the step that started it.
- Each subagent must show its type, its task description, its model, its duration, its state, its latest text and the tool it runs now.
- The state must be running, finished or stopped. "Stopped" means the subagent ended before it finished its task, for example after an interrupt.
- The duration must count up while the subagent runs, and show the full run time once it ends.
- The latest text must follow the text rules of the list entry.
- The current tool must show as the running-tool line of the entry does. With no running tool, the field must be empty.
- Subagents that run at the same time must appear side by side, as one group.
- A subagent started by another subagent must appear under its parent.
- A subagent that still runs must stay in the panel after its turn ends, also when a new turn starts.
- When no turn runs, the panel must show the last turn, marked as ended. Before the first turn, it must say that there is no turn yet.
- While the turn runs, the panel must keep the latest step visible, unless the user scrolled up.

Subagent conversation
- A click on a subagent must open its conversation read-only, from its task to its latest step.
- The conversation must show as the conversation of an external session does, and update live while the subagent runs.
- The conversation must be available for running and ended subagents.
- Opening it must not leave the open session, and one action must return to the tree.

Text and format
- Durations must use a short form: "42 s", "3 min", "1 h 05 min".
- Every new text must be in English, like the rest of the UI.

### Non-functional

- The client must not write to any session, transcript or Claude Code file.
- The feature must use no network.
- The feature must need no new permission: no change to Claude Code settings and no new system permission.
- The entry, the signal and the panel must update within 2 seconds of a new event, for hosted and external sessions.
- A missing or unknown field in Claude Code's data must hide that field only. The rest of the feature must keep working.
- A subagent with thousands of steps, or a run of 16 hours, must not slow down the list or the panel.
- The panel must stay usable with 20 subagents running at once, the default limit of Claude Code ([sub-agents](https://code.claude.com/docs/en/sub-agents)).
- The panel and the subagent conversation must be usable with the keyboard, with visible focus.
- The feature must work in the browser page and in the desktop window.

## Assumptions

- This is an evolution, not a fix. The reference left tool history out of scope on purpose (line 117). The human decided this.
- The entry shows subagent text too, because the request says "subagent compresi". Its example sentence is the kind of text a developer subagent writes.
- With subagents in parallel, the latest text wins on the entry. The panel shows every subagent.
- The text line and the signal show only on a session at work, because "the current step" exists only there. A needs-input entry already says what is needed.
- "The current step" is the time since the text shown was written. The request ties the time to that sentence.
- The stall threshold is 5 minutes, fixed, with no setting. It matches the user's own measure and two third-party tools (Market trends).
- Activity is read from the transcripts, not from the terminal. Hosted and external sessions then follow the same rule.
- Steps that run when a background subagent completes belong to the turn of the last user message.
- A subagent can start subagents, up to three levels below the main conversation ([sub-agents](https://code.claude.com/docs/en/sub-agents)). So the tree nests them.
- By default a subagent started from the main conversation runs in the background ([sub-agents](https://code.claude.com/docs/en/sub-agents)). So it can still run after its turn ends.
- The panel keeps the last turn when no turn runs. A session is idle most of the time, and an empty panel would show nothing useful.
- The model is the one Claude Code records for the subagent.
- The data comes from the transcripts and the subagent metadata that Claude Code already writes, and that the client already finds (request, technical notes).

## Market trends

- Claude Code shows nested subagents as a tree in a panel below its prompt, and `/tasks` lists running subagents ([sub-agents](https://code.claude.com/docs/en/sub-agents)). This works only inside the terminal of each session.
- A third-party blog reports a short status line beside each background agent, refreshed about every 30 seconds ([dsebastien.net](https://www.dsebastien.net/claude-code-agent-progress-summaries/)).
- A feature request asked for a list of subagents with description, status, elapsed time and current tool. It was closed as not planned ([issue 48246](https://github.com/anthropics/claude-code/issues/48246)).
- Some third-party monitors use hooks, which need a change to the settings ([agents-observe](https://raw.githubusercontent.com/simple10/agents-observe/main/README.md), [disler](https://docsearch.algolia.com/mcp/docs/repo/disler/claude-code-hooks-multi-agent-observability)). Others only read the local files under `~/.claude` ([ur-dashboard](https://dev.to/thestack_ai/i-run-5-claude-code-agents-at-once-i-had-no-idea-what-they-were-doing-273p)).
- Two third-party tools call a working session stalled after 5 minutes without a transcript change ([Agent Island](https://dev.to/tristan666666/how-agent-island-detects-claude-code-and-codex-session-state-2p93), [claudelab](https://claudelab.net/en/articles/claude-code/claude-code-agents-view-background-session-heartbeat-stall-detection)).

What this means for the request:
- Users ask for the same fields that the panel shows, and Claude Code shows them only one terminal at a time.
- Reading the local files is the only approach of these tools that needs no new permission.

## Risks

- The transcript and subagent metadata formats are internal to Claude Code. A new version can hide fields or break the feature.
- Claude Code may record a response only when it is complete. A long response or long thinking then shows as no activity.
- A subagent killed without a record of its end can show as running for ever.
- The latest text can show private content or secrets in the list, for example during screen sharing.
- The signal can push the user to interrupt a long but healthy command, such as a full test run.

## Scope

In scope:
- Latest text and step time on the entry of every session at work, hosted or external.
- Stall signal on the entry after 5 minutes with no activity.
- A turn panel with the main steps, the nested subagents and their details.
- The live, read-only conversation of each subagent.

Out of scope:
- Changes to the running-tool line of the entry. It keeps main-conversation tools only.
- Changes to session states, groups and order.
- Notifications, sounds or tray signals for a stall, and a setting for its threshold.
- Actions on a subagent from the client, such as stop, message or restart.
- Turns before the last one, and a history of past turns.
- Tokens and cost per subagent.
