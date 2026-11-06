---
batch: rename
feature: Rename
closed_req: [REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39]
depends: [dismiss-resume]
---

# Batch rename — Rename

REQ ids refer to `plan-session_list_improvements/requirements.md`. "Name" is the client-only name, as defined there.

## What this batch builds

- **Session name store** → the names the user gives, by session key, saved in a file of the client's own data folder.
- **Rename route** → sets or clears the name of a hosted or external session.
- **Name editor** → the text field that edits the name in place of the label of a list entry.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Name store: `get(key)`, `set(key, name)`, `move(from, to)`, change listeners. `set` trims, removes the name when empty, refuses more than 200 characters. Saved to a JSON file in the data folder and loaded at start. | REQ-31, REQ-32, REQ-33, REQ-35 | — |
| INT-2 | modify | `src/server/sessions/session-state-tracker.ts` | `label` of a summary = the name of the session key when set: the Claude Code session id, else the hosted id. A name change notifies the summary with a new cause `{ type: "name" }`. | REQ-26, REQ-27, REQ-28, REQ-36, REQ-37 | INT-1 |
| INT-3 | modify | `src/server/sessions/session-state-tracker.ts` | When the Claude Code session id of a session is set or changes, a name under the old key moves to the new key (INT-1 `move`). | REQ-36 | INT-2 |
| INT-4 | modify | `src/server/external/external-session-scanner.ts` | `label` of an entry = the name of its id when set. A name change of a listed id notifies `{ type: "session", session }` at once, outside the scan. | REQ-25, REQ-27, REQ-28, REQ-37 | INT-1 |
| INT-5 | modify | `src/server/history/past-session-list-route.ts` | `label` of a past session = its name when set, else today's label. The history search then matches the name, with no change to ResumeDialog. | REQ-29, REQ-30 | INT-1 |
| INT-6 | create | backend, sessions area | Route `PUT /api/sessions/:id/name`, body `{ name }`, for a hosted or an external id. `204` after INT-1 `set`. `404` for an unknown id. `400` for a name over 200 characters after trimming. | REQ-25, REQ-31, REQ-32, REQ-33 | INT-1 |
| INT-7 | modify | `src/server/main.ts` | Create the name store in the data folder (decision below). Pass it to the tracker, the scanner and PastSessionListRoute. Register the INT-6 route. | REQ-25, REQ-35 | INT-2, INT-4, INT-5, INT-6 |
| INT-8 | modify | `playwright.config.ts` | Enabling: start the e2e server with `AI_CLIENT_DATA_DIR` on a temporary folder, so e2e tests never touch the user's names. | — | INT-7 |
| INT-9 | create | frontend, sessions area | Name editor: field "Session Name", starts with the current label selected, at most 200 characters. Enter → INT-6 (unchanged text sends nothing). Esc or blur → cancel. Failure → ErrorMessage "Could not rename the session.", field stays open. | REQ-31, REQ-32, REQ-33, REQ-34, REQ-39 | INT-6 |
| INT-10 | modify | `src/web/sessions/SessionList.tsx` | A "Rename" button on every entry, rows and the needs-input card, beside the entry button, with the focus ring. It shows INT-9 in place of the label. The entry stays in its place. | REQ-25, REQ-38, REQ-39 | INT-9 |

## Decisions

- **The server applies the name to `label`.** Every place of REQ-26 to REQ-29 already reads the `label` that the server gives: list entry, SessionHeader of a hosted session, AttentionMonitor events and needs-input list (notifications and tray), history list and its search. So the desktop app, AttentionMonitor, NotificationTexts, TrayIcon, LiveSessionStore and ResumeDialog do not change.
- **Live update (REQ-37).** A name change goes out through the existing `session` frames to every page, the desktop window included. AttentionMonitor already updates its needs-input list when a label changes, so the tray menu updates too.
- **Key of a name.** The Claude Code session id, which `--resume` keeps. All resume paths (list "Resume", history, "Resume Here") start the new hosted session with `resumedFrom.sessionId`, so the name follows at once (REQ-36). A hosted session with no known id yet uses its hosted id, and INT-3 moves the name when the id becomes known. INT-3 also covers a Claude Code that gives a resumed session a new id.
- **Data folder.** `AI_CLIENT_DATA_DIR` when set, else `$XDG_DATA_HOME/ai-client`, default `~/.local/share/ai-client`. The folder is outside `~/.claude`. The client writes nothing to Claude Code files.
- **Blur cancels.** Only Enter saves a name (REQ-34). Leaving the field with the mouse or Tab discards the edit.
- **Stop confirmation (REQ-26).** It shows the folder name, not the label (StopSessionButton spec). So there is no label there to replace, and it does not change. Gatekeeper decision of 2026-11-06. REQ-26 is tested on the list entry and the session header.
- **External session header.** It shows "Open in Another Terminal", not the label (ConversationView spec). It does not change.
- **Tests (knowledge base `electron-e2e-separate`).** Vitest for INT-1 to INT-6. Notifications and tray (REQ-27, REQ-28) → Vitest on AttentionMonitor with a named tracker and scanner: events and the needs-input list carry the name, and the list changes on rename. Then `notificationTexts` and `trayMenuTemplate` with that label. Playwright e2e in the browser for the list, header and history paths. No Electron e2e: no desktop file changes.

## Human acceptance

### Scenario: The user names a session from the list

- REQ → REQ-25, REQ-26, REQ-34, REQ-38, REQ-39
- Given → a hosted session is open, and its entry shows the start of its first prompt
- When → the user presses "Rename" on its entry with the keyboard, types "Release fix" and presses Enter
- Then → the entry and the session header show "Release fix", and the entry keeps its place in its group

### Scenario: The name reaches notifications and the tray

- REQ → REQ-27, REQ-28, REQ-37
- Given → the desktop app runs and the user named a session "Release fix"
- When → that session needs input
- Then → the notification title shows "<folder> · Release fix"
- And → the tray menu entry of that session shows "<folder> · Release fix"

### Scenario: The name shows in the resume history

- REQ → REQ-29, REQ-30
- Given → the user named a session "Release fix", and the session has ended
- When → the user opens "Resume Session" and types "release"
- Then → the history dialog shows the session as "Release fix"

### Scenario: An empty name brings back the default label

- REQ → REQ-31
- Given → a session named "Release fix"
- When → the user renames it to a name of spaces only and presses Enter
- Then → the entry shows the start of the first prompt again

### Scenario: Spaces and length

- REQ → REQ-32, REQ-33
- Given → the name editor of a session is open
- When → the user types "  Nightly build  " followed by more text, beyond 200 characters, and presses Enter
- Then → the field stops at 200 characters, and the name shows without the spaces at the start and end

### Scenario: Esc cancels the edit

- REQ → REQ-34
- Given → the user typed a new name in the editor of a session named "Release fix"
- When → the user presses Esc
- Then → the entry still shows "Release fix"

### Scenario: The name survives reload, restart and resume

- REQ → REQ-35, REQ-36
- Given → the user named a session "Release fix", and the session has ended
- When → the user restarts the client and resumes the session from the history
- Then → the resumed session shows "Release fix" in the list and in its header

### Scenario: Every open page gets the new name

- REQ → REQ-37
- Given → the client is open in two browser tabs
- When → the user renames a session in the first tab
- Then → the second tab shows the new name without a reload

### Scenario: An external session gets a name

- REQ → REQ-25
- Given → a session runs in another terminal and its entry is in the list
- When → the user renames its entry to "Terminal job"
- Then → the external entry shows "Terminal job"
