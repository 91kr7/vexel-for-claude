---
module: app
component: AppLayout
type: UI page
---

# AppLayout

**Purpose** → the page: the navigation rail, the list panel and the main area with the open session, as board "Sessione ospitata".

## Contract

Description:
- three columns that fill the window, on `--surface`. There is no separate header bar.
- the NavigationRail (left, 96 px).
- the list panel → a `section` with the label "Elenco sessioni". Flex basis 340 px, at most 400 px wide, 12 px margin above and below, padding 20 px 12 px, 28 px radius, `--sc-low` background. One column with a 4 px gap:
  - the brand row (padding 0 12 px 4 px, aligned on the text baseline, 8 px gap) → "Vexel" (`.brand`, 28/34 px, `--primary`) and "for Claude" (`.label-l`, `--on-surface-variant`).
  - the title row (padding 0 12 px 12 px, centred, space between) → the `h1` "Sessioni" (`.headline-s`, no margin) on the left, the NeedsInputCounter on the right.
  - the SessionList.
- the main area (`main`) → takes the rest of the width (flex basis 560 px). One column, 12 px gap, padding 12 px 16 px 16 px 16 px.

Shows:
- the rail badge, the counter and the list, always, also while a session is open. All follow LiveSessionStore (`useLiveSessions`). The rail badge gets `countNeedsInput` of the list. The list also gets its load status.
- no open session → the EmptyState in the main area.
- an open hosted session → its SessionView, with the summary (folder, label, state) of that session from LiveSessionStore. No summary while the store does not list it yet.
- an open external session → its ConversationView with its summary, in place of the SessionView. It stays open when the entry leaves the list, with the last summary the list gave.
- the NeedsInputSnackbar of `useNeedsInputSnackbar`, when it gives a session → at the bottom right of the main area: 24 px from its right edge, 16 px from its bottom edge, above the content.

Actions:
- "Nuova sessione", in the rail or in the EmptyState → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- "Riprendi" in the rail, or "Riprendi sessione" in the EmptyState → opens ResumeDialog.
- ResumeDialog resumes a session → the dialog closes and the resumed session becomes the open one.
- ResumeDialog cancelled → the dialog closes; the open session does not change.
- click on a SessionList entry → that session becomes the open one. The other sessions keep running.
- "Sessioni" in the rail, or Ctrl+Shift+L in the terminal of the open SessionView → the focus moves to a list entry:

```
if the list has the open session's entry → that entry
else if the list has an enabled entry → the first one
else → "Nuova sessione" in the rail
```

  The focused element shows the focus ring, also after a mouse click.
- "Apri" in the snackbar → that session becomes the open one, hosted or external as for a list click. The snackbar disappears.
- ConversationView resumes the session ("Riprendi qui") → the new hosted session becomes the open one.

## Rules and invariants

- the rail and the head of the list panel stay in place. Only the SessionList scrolls, when its entries do not fit.
- from 1280 px to 3840 px of window width → no horizontal scroll and no overlapping elements.
- the list panel has no "Nuova sessione" or "Riprendi sessione" button.

## Dependencies

- NavigationRail, NeedsInputSnackbar, EmptyState
- FolderChooser (module folders)
- ResumeDialog (module history)
- SessionView, SessionList, NeedsInputCounter, LiveSessionStore (module sessions)
- ConversationView (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-17`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-35`
- `plan-claude_sessions_client-ui_redesign/REQ-8`, `plan-claude_sessions_client-ui_redesign/REQ-9`, `plan-claude_sessions_client-ui_redesign/REQ-10`, `plan-claude_sessions_client-ui_redesign/REQ-14`, `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-10`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-15`
