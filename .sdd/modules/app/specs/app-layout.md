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
- the list panel → a `section` with the label "Session List". Padding 10 px, `--bg-surface-1`, 1 px `--border-subtle` line on the right. One column with a 10 px gap:
  - the title row (padding 0 × 6 px, centred, space between) → the `h1` "Sessions" in `.section-label` on the left, the NeedsInputCounter on the right.
  - the SessionList.
- the list panel width → `shownListWidth` of the ListWidthStore width and the window width: the stored width, narrowed so that the main area keeps 700 px, never under 180 px. A window resize computes it again; the stored width does not change.
- the ListPanelEdge on the right border of the list panel, after the list in the Tab order → it gets the shown width and `listWidthLimit` of the window width. A drag move calls the store `preview`; the end of a drag and an arrow key call `commit`.
- the main area (`main`) → takes the rest of the width, with the `.vx-dot-grid` background.

Shows:
- the rail badge, the counter and the list, always, also while a session is open. All follow LiveSessionStore (`useLiveSessions`). The rail badge gets `countNeedsInput` of the list. The list also gets its load status, and the order of `useSessionOrder` for the live sessions and their status. Its `onReorder` is the `move` of the same hook.
- no open session → the EmptyState in the main area.
- an open hosted session → its SessionView, with the summary (folder, label, state) of that session from LiveSessionStore. No summary while the store does not list it yet. The SessionView and the ConversationView also get the whole session list.
- an open hosted session that the store listed and then no longer lists (dismissed, or resumed from its entry) → no open session: the EmptyState.
- an open external session → its ConversationView with its summary, in place of the SessionView. It stays open when the entry leaves the list, with the last summary the list gave.
- an open session, hosted or external, that the list no longer has when LiveSessionStore goes from `error` to `ready` (a reload after a reconnection) → it stays open, with its last summary and the state `ended`. If the list has it again later, the view uses the listed summary.
- the NeedsInputSnackbar of `useNeedsInputSnackbar`, when it gives a session → fixed at the bottom right of the window, whatever the main area shows.
- the ShortMessageToast of `useShortMessage`, at the bottom centre of the window.
- the ShortcutsPanel, while it is open. It is a dialog over the page: the open SessionView or ConversationView stays mounted under it, with its size, its scroll position and its session running.

Actions:
- "New Session" in the top bar or in the EmptyState, or "New Claude Code Session" in the rail → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- "Resume" in the rail, or "Resume Session" in the EmptyState → opens ResumeDialog.
- ResumeDialog resumes a session → the dialog closes and the resumed session becomes the open one.
- ResumeDialog cancelled → the dialog closes; the open session does not change.
- "Resume" on an ended entry of SessionList (`onResumed`) → the new hosted session becomes the open one.
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
- the ShortcutsButton of the TopBar → opens the ShortcutsPanel, or closes it when it is open.
- the panel closes ("[Esc]", "Close", Esc) → it goes; the focus goes back where it was before it opened (Dialog).
- the PlanUsageButton of the TopBar → opens the PlanUsagePopover, or closes it when it is open. The popover shows the state of `usePlanUsage(open)`: the figures load once when it opens and are not refreshed while it is open. Its close button and Esc close it. It is not a dialog: the open session, its terminal focus and scroll, and any open dialog stay as they are.

Shortcuts (useShortcutKeys, while the page is mounted):
- `focus-list` (Alt+L) → the focus moves to a list entry, with the same rule as "Sessions" in the rail.
- `focus-main-view` (Alt+C) → the focus goes to the main view: the terminal of the open SessionView, or the message area of the open ConversationView. No open session → nothing.
- `open-session` → sessionToOpen with the live sessions, the order of `useSessionOrder`, the open session and the target:
  - a session other than the open one → it becomes the open one, hosted or external as for a list click.
  - the open session → nothing changes.
  - none, target `next-needs-input` → the open session does not change, and the toast shows "No session needs input".
  - none, any other target → nothing.
- focus after an open by shortcut → it follows the open path of a click. In addition, when the focus was in the main view before the open, the new main view gets it.
- `new-session` (Alt+N) → opens FolderChooser, as "New Session" does.
- `resume-history` (Alt+H) → opens ResumeDialog, as "Resume" in the rail does.
- `toggle-theme` (Alt+A) → switches the theme, as the ThemeSwitch does (ThemeStore `toggle`).
- `toggle-shortcuts-panel` (Alt+S) → opens the ShortcutsPanel, or closes it when it is open, as the ShortcutsButton does.
- `session-command` (Alt+E, Alt+R, Alt+Shift+Q, Alt+Shift+W) → sent to ShortcutChannel. The component that owns the action runs it; with no owner on the page, nothing happens.

## Rules and invariants

- the top bar, the rail and the head of the list panel stay in place. Only the SessionList scrolls, when its entries do not fit.
- at 1440 × 900 px with no saved width → top bar 48 px high, rail 52 px wide, list panel 224 px wide.
- the first frame already shows the stored width: no jump at start or after a reload.
- from 1280 px to 3840 px of window width → no horizontal scroll and no overlapping elements, except the snackbar, which may cover the corner of the main area.
- the list panel has no brand, no "New Session" and no "Resume Session" button.

## Dependencies

- TopBar, ShortcutsPanel, PlanUsagePopover, PlanUsageStore, NavigationRail, NeedsInputSnackbar, EmptyState, WebEntry, useDesktopBridge, ListWidthStore, ListPanelEdge
- useShortcutKeys, ShortcutMap, ShortcutChannel, ShortMessageToast, ThemeStore
- FolderChooser (module folders)
- ResumeDialog (module history)
- SessionView, SessionList, NeedsInputCounter, LiveSessionStore, SessionOrderStore, sessionToOpen (module sessions)
- ConversationView (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-17`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-35`, `plan-claude_sessions_client/REQ-51`, `plan-claude_sessions_client/REQ-53`
- `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-8`, `plan-claude_sessions_client-ui_redesign/REQ-9`, `plan-claude_sessions_client-ui_redesign/REQ-10`, `plan-claude_sessions_client-ui_redesign/REQ-14`, `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-15`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-21`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-9`
- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`, `plan-session_notifications/REQ-20`
- `plan-session_list_improvements/REQ-7`, `plan-session_list_improvements/REQ-10`
- `plan-session_list_width/REQ-3`, `plan-session_list_width/REQ-4`, `plan-session_list_width/REQ-5`, `plan-session_list_width/REQ-6`, `plan-session_list_width/REQ-9`, `plan-session_list_width/REQ-11`
- `plan-usage_limits/REQ-3`, `plan-usage_limits/REQ-4`
- `plan-keyboard_shortcuts/REQ-1`, `plan-keyboard_shortcuts/REQ-3`, `plan-keyboard_shortcuts/REQ-4`, `plan-keyboard_shortcuts/REQ-5`, `plan-keyboard_shortcuts/REQ-6`, `plan-keyboard_shortcuts/REQ-7`, `plan-keyboard_shortcuts/REQ-8`, `plan-keyboard_shortcuts/REQ-9`, `plan-keyboard_shortcuts/REQ-10`, `plan-keyboard_shortcuts/REQ-11`, `plan-keyboard_shortcuts/REQ-12`, `plan-keyboard_shortcuts/REQ-13`, `plan-keyboard_shortcuts/REQ-21`, `plan-keyboard_shortcuts/REQ-24`, `plan-keyboard_shortcuts/REQ-25`, `plan-keyboard_shortcuts/REQ-29`, `plan-keyboard_shortcuts/REQ-30`, `plan-keyboard_shortcuts/REQ-31`, `plan-keyboard_shortcuts/REQ-43`
- `plan-git_explorer/REQ-25`
