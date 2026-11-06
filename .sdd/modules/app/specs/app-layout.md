---
module: app
component: AppLayout
type: UI page
---

# AppLayout

**Purpose** → the page: top bar, navigation rail, list panel and main area with the open session. It copies "MAIN VEXEL APPLICATION SHELL" of `.sdd/mockups/studio-dark/mock.html`, without the outer margin and the rounded frame.

## Contract

Description:
- the page fills the window edge to edge, on `--bg-surface-1`. From top: the TopBar, then one row with the NavigationRail, the list panel and the main area.
- the list panel → a `section` with the label "Session List". 224 px wide, padding 10 px, `--bg-surface-1`, 1 px `--border-subtle` line on the right. One column with a 10 px gap:
  - the title row (padding 0 × 6 px, centred, space between) → the `h1` "Sessions" in `.section-label` on the left, the NeedsInputCounter on the right.
  - the SessionList.
- the main area (`main`) → takes the rest of the width, with the `.vx-dot-grid` background.

Shows:
- the rail badge, the counter and the list, always, also while a session is open. All follow LiveSessionStore (`useLiveSessions`). The rail badge gets `countNeedsInput` of the list. The list also gets its load status, and the order of `useSessionOrder` for the live sessions and their status. Its `onReorder` is the `move` of the same hook.
- no open session → the EmptyState in the main area.
- an open hosted session → its SessionView, with the summary (folder, label, state) of that session from LiveSessionStore. No summary while the store does not list it yet.
- an open external session → its ConversationView with its summary, in place of the SessionView. It stays open when the entry leaves the list, with the last summary the list gave.
- the NeedsInputSnackbar of `useNeedsInputSnackbar`, when it gives a session → fixed at the bottom right of the window, whatever the main area shows.

Actions:
- "New Session" in the top bar or in the EmptyState, or "New Claude Code Session" in the rail → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- "Resume" in the rail, or "Resume Session" in the EmptyState → opens ResumeDialog.
- ResumeDialog resumes a session → the dialog closes and the resumed session becomes the open one.
- ResumeDialog cancelled → the dialog closes; the open session does not change.
- click on a SessionList entry → that session becomes the open one. The other sessions keep running.
- "Sessions" in the rail, or Ctrl+Shift+L in the terminal of the open SessionView → the focus moves to a list entry:

```
if the list has the open session's entry → that entry
else if the list has an enabled entry → the first one
else → "New Claude Code Session" in the rail
```

  The focused element shows the focus ring, also after a mouse click.
- "Open" in the snackbar → that session becomes the open one, hosted or external as for a list click. The snackbar disappears.
- ConversationView resumes the session ("Resume Here") → the new hosted session becomes the open one.
- "open this session" from the desktop app (useDesktopBridge) → when LiveSessionStore lists the session, it becomes the open one, hosted or external as for a list click. Else nothing changes.
- each change of the open session is reported to the desktop app (useDesktopBridge).

## Rules and invariants

- the top bar, the rail and the head of the list panel stay in place. Only the SessionList scrolls, when its entries do not fit.
- at 1440 × 900 px → top bar 48 px high, rail 52 px wide, list panel 224 px wide.
- from 1280 px to 3840 px of window width → no horizontal scroll and no overlapping elements, except the snackbar, which may cover the corner of the main area.
- the list panel has no brand, no "New Session" and no "Resume Session" button.

## Dependencies

- TopBar, NavigationRail, NeedsInputSnackbar, EmptyState, WebEntry, useDesktopBridge
- FolderChooser (module folders)
- ResumeDialog (module history)
- SessionView, SessionList, NeedsInputCounter, LiveSessionStore, SessionOrderStore (module sessions)
- ConversationView (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-17`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-35`
- `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-8`, `plan-claude_sessions_client-ui_redesign/REQ-9`, `plan-claude_sessions_client-ui_redesign/REQ-10`, `plan-claude_sessions_client-ui_redesign/REQ-14`, `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-15`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-21`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-9`
- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`, `plan-session_notifications/REQ-20`
