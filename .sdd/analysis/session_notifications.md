---
request_slug: session_notifications
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/desktop_app.md
---

# Analysis — System notifications and tray signal for waiting sessions

## Request

> Notifiche di sistema e icona del tray che segnalano le sessioni in attesa, nell'app desktop. Sostituiscono l'hook notify.sh che oggi sta in ~/.claude/settings.json (Stop e Notification con notify-send), che verrà tolto: quindi devono coprire sia le sessioni ospitate dal client sia quelle esterne che girano nei terminali. Regole: notifica quando una sessione passa a "needs input" (urgente, resta a schermo finché l'utente non la chiude, dice cosa serve, ad esempio il permesso per un tool); notifica quando un turno finisce (da working a idle) con l'inizio della risposta finale di Claude; notifica quando una sessione ospitata termina senza che l'utente l'abbia fermata. Nessuna notifica di sistema quando la finestra dell'app è in primo piano, perché lì c'è già lo snackbar. Una sola notifica per sessione: la nuova sostituisce la precedente; più eventi ravvicinati si raggruppano in una notifica sola. Clic sulla notifica: mostra la finestra e apre quella sessione. Tray: l'icona cambia quando almeno una sessione è in attesa, il tooltip dice quante sono, e il menu ha una voce per aprire ciascuna sessione in attesa.

## Reference

[desktop_app.md](desktop_app.md) → the desktop app with its own window, the backend it starts, and a tray icon that reopens the window or quits. It left operating system notifications and a needs-input count on the tray icon out of scope (line 84). Inside the page, a snackbar already announces a session that starts to need input ([claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md), lines 55-56).

Changes:
- The desktop app shows system notifications for hosted and external sessions.
- The tray icon signals the sessions that need input, with a count and one menu entry for each.
- These replace the user's `notify.sh` hook.
- Every other requirement of the reference stays true.

## Summary

The desktop app tells the user, with system notifications and its tray icon, when a hosted or external session needs input, finishes a turn, or ends by itself. It replaces the `notify.sh` hook for every Claude Code session on the machine.

## Requirements

### Functional

Events that notify
- A notification must appear when a hosted or external session enters "needs input".
- A notification must appear when a turn of a hosted or external session ends and the session goes from working to idle.
- A notification must appear when a hosted session ends and the user did not stop it.
- A turn that the user interrupts must not notify, because the `Stop` hook it replaces does not fire on a user interrupt either ([Claude Code hooks](https://code.claude.com/docs/en/hooks)).
- No notification must appear while the desktop app window has the focus.
- Notifications must appear while the window is in the background, minimized, or closed to the tray.
- State changes that happened before the desktop app started must not notify.
- The same state change must never notify twice.

Content
- A notification about one session must name it by its project folder and its label, as the list does.
- The needs-input notification must say what is needed, with the wording of the needs-input card of the list, for example the permission for a named tool.
- When the client does not know what is needed, the needs-input notification must say that the session needs input.
- The turn-end notification must show the start of Claude's final response of that turn, as plain text without markdown, at most 100 characters.
- When that final response has no text, the turn-end notification must say that Claude finished.
- The session-end notification must say that the session ended, and whether it ended with an error.
- Every notification text must be in English, like the rest of the UI.

Urgency and lifetime
- The needs-input notification must be urgent and stay on screen until the user closes it.
- The turn-end and session-end notifications must be normal notifications that the desktop hides after its usual time.
- A needs-input notification must disappear when its session no longer needs input, like the snackbar.
- The notification of a session must disappear when the user opens that session in the app.

Replacement and grouping
- Each session must have at most one notification at a time.
- A new notification of a session must replace the previous one in place.
- Events of several sessions within 5 seconds of the first one must alert the user once, with one notification that says how many sessions and names them.
- The first event must notify at once, and the later events within the 5 seconds must merge into its notification.
- A grouped notification must be urgent when at least one of its sessions needs input.

Click
- A click on a notification must show the desktop app window, in front, and open that session.
- A click on a grouped notification must open the session of the latest event.
- When that session is no longer in the list, the click must only show the window.

Tray
- The tray icon must take an attention look while at least one session needs input, hosted or external.
- The tray icon must return to its normal look when no session needs input.
- The tray tooltip must say how many sessions need input, with correct singular and plural.
- The tray menu must have one entry for each session that needs input, named as in the list.
- A click on such an entry must show the window, in front, and open that session.
- The menu entries must be ordered by when the session started to need input, the longest waiting first.
- The tray icon, tooltip and menu must update by themselves, also while the window has the focus.
- The existing reopen and quit actions of the tray must stay as they are.

### Non-functional

- A notification must appear within 5 seconds of the state change, for hosted and external sessions, grouping included.
- The attention icon must be easy to tell from the normal icon at tray size, on light and dark panels.

## Assumptions

- This is an evolution, not a fix. The reference left notifications and the tray count out of scope on purpose. The orchestrator decided this.
- In the tray, a waiting session is a session in "needs input". Idle is the resting state of most sessions, so counting it would keep the icon almost always in attention. The page already counts "N needs input" the same way. The orchestrator decided this.
- The grouping rule applies across sessions. Inside one session, the replacement rule already covers repeated events. The orchestrator decided this.
- "In primo piano" means that the app window has the keyboard focus. A visible window without focus does not block notifications.
- "Stays on screen until the user closes it" means that it does not expire by time. A need that is gone removes it, as for the snackbar.
- The user stops a hosted session with Terminate, by quitting the app, or with an exit command in its terminal. None of these notify.
- Only the desktop app shows notifications. The client open in a browser shows none, and a focused browser page does not block them.

## Risks

- External sessions now depend only on the client's reading of internal Claude Code files. If that reading misses or delays a "needs input", the user gets no alert. The hook was called by Claude Code directly.
- With the hook removed, no notification appears while the desktop app is not running. The app does not start at login ([desktop_app.md](desktop_app.md), line 83).
- Until the hook is removed, an event can notify twice: once from the hook and once from the app.
- A Linux notification server may ignore urgency or click actions. The specification makes actions optional and lets a server ignore hints ([spec 0.6](https://galago-project.org/specs/notification/0.6/notification-spec-0.6.txt), [spec 1.2, urgency](https://specifications.freedesktop.org/notification-spec/1.2/ar01s07.html)). On such a desktop the click opens nothing, or the urgent notification expires.
- The needs-input notification also fires when the user sits at that terminal and answers at once. The permission notification of Claude Code waits about six seconds without typing ([Claude Code hooks](https://code.claude.com/docs/en/hooks)).
- The excerpt of Claude's response can show code or private text on screen, for example during screen sharing.

## Scope

In scope:
- Notifications for needs input and turn end of hosted and external sessions, and for the unexpected end of hosted sessions.
- One notification per session, grouping of bursts across sessions, and click to open.
- The tray attention icon, the count in the tooltip, and one menu entry for each session that needs input.

Out of scope:
- Removing the `notify.sh` hook from `~/.claude/settings.json`. It is done outside the product, once this cycle is merged.
- Notifications from the client open in a browser.
- Answering a permission or replying from a notification or from the tray menu.
- Settings to turn notifications on or off, and custom sounds.
- A notification when an external session ends.
- Repeated reminders for a session that keeps waiting.
- Changes to the snackbar, or new snackbars for turn end and session end.
- Starting the desktop app at login.
