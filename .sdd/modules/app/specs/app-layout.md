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
- the side view → `sessions` or `projects`; `sessions` at page load. It sets the content of the list panel and the `shownView` of the NavigationRail.
- the list panel → a `section` with the label "Session List", in both views. Padding 10 px, on the "session list" role surface (`--role-list`), 1 px `--role-border-subtle` line on the right. One column with a 10 px gap. View `projects` → the ProjectList. View `sessions` →
  - the title row (padding 0 × 6 px, centred, space between) → the `h1` "Sessions" in `.section-label` on the left, the NeedsInputCounter on the right.
  - the SessionList.
- the list panel width → `shownListWidth` of the ListWidthStore width and the window width: the stored width, narrowed so that the main area keeps 700 px, never under 180 px. A window resize computes it again; the stored width does not change.
- the ListPanelEdge on the right border of the list panel, after the list in the Tab order → it gets the shown width and `listWidthLimit` of the window width. A drag move calls the store `preview`; the end of a drag and an arrow key call `commit`.
- the main area (`main`) → takes the rest of the width, with the `.vx-dot-grid` background.

Shows:
- the rail badge always, in both views. The counter and the list in the `sessions` view. All three stay also while a session is open. All follow LiveSessionStore (`useLiveSessions`). The rail badge gets `countNeedsInput` of the list. The list also gets its load status, and the order of `useSessionOrder` for the live sessions and their status. Its `onReorder` is the `move` of the same hook.
- no open session → the EmptyState in the main area.
- an open hosted session → its SessionView, with the summary (folder, label, state) of that session from LiveSessionStore. No summary while the store does not list it yet. The SessionView and the ConversationView also get the whole session list.
- an open session, hosted or external, that the store listed and then no longer lists (dismissed, or resumed in the client) → no open session: the EmptyState. After a resume in the client, the main area shows the new hosted session.
- an open external session → its ConversationView with its summary, in place of the SessionView.
- an open session, hosted or external, that the list no longer has when LiveSessionStore goes from `error` to `ready` (a reload after a reconnection) → it stays open, with its last summary and the state `ended`. If the list has it again later, the view uses the listed summary.
- the NeedsInputSnackbar of `useNeedsInputSnackbar`, when it gives a session → fixed at the bottom right of the window, whatever the main area shows.
- the ShortMessageToast of `useShortMessage`, at the bottom right of the window; above the NeedsInputSnackbar while that shows.
- the NewerVersionNotice, while it has a version and the user has not closed it in this page. The version is the last `newer` result of the user's check in the SettingsDialog, else the one of `useNewerVersion`. The session list does not wait for it.
- the SettingsDialog, while it is open. It is a dialog over the page: the open SessionView or ConversationView stays mounted under it, with its size, its scroll position and its session running.

Actions:
- "New Session" in the EmptyState, or "New Claude Code Session" in the rail → opens FolderChooser. The top bar has no "New Session".
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- "Resume" in the rail, or "Resume Session" in the EmptyState → opens ResumeDialog.
- ResumeDialog resumes a session → the dialog closes and the resumed session becomes the open one.
- ResumeDialog cancelled → the dialog closes; the open session does not change.
- ProjectList `onChoose(project)` → opens SessionNameDialog for that project.
- SessionNameDialog starts a session → the dialog closes and the new session becomes the open one. The side view does not change.
- SessionNameDialog cancelled → the dialog closes; the open session does not change. The focus goes back to the project row (Dialog).
- "Resume" on an ended entry of SessionList (`onResumed`) → the new hosted session becomes the open one.
- click on a SessionList entry → that session becomes the open one. The other sessions keep running.
- "Projects" in the rail → the side view becomes `projects`, and ProjectListStore `load()` runs on the page store. The ProjectList shows with an empty search, at each press, also when the view is already `projects`. Then the focus moves to the first project row, with the focus ring also after a mouse click. With no row on screen, the focus does not move.
- "Sessions" in the rail, or Ctrl+Shift+L in the terminal of the open SessionView → the side view becomes `sessions`. Then the focus moves to a list entry:

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
- the SettingsButton at the bottom of the NavigationRail (`onOpenSettings`) → opens the SettingsDialog on the "Appearance" menu. The popup closes ("[Esc]", "Close", Esc) → it goes; the focus goes back to where it was before it opened (Dialog). The side view, the open session and the list scroll do not change.
- "Close Update Notice" → the notice goes, and nothing else changes. The closed state lives only in this page: a reload or a new tab shows it again.
- a `newer` result of the user's check in the SettingsDialog (`onNewerVersion`) → the notice shows that version and its closed state is cleared, so it shows again, also when the launch check found nothing. It stays under the popup and is visible when the popup closes.
- the PlanUsageButton of the TopBar → opens the PlanUsagePopover, or closes it when it is open. The popover shows the state of `usePlanUsage(open)`: the figures load once when it opens and are not refreshed while it is open. Its close button and Esc close it. It is not a dialog: the open session, its terminal focus and scroll, and any open dialog stay as they are.

Shortcuts (useShortcutKeys, while the page is mounted):
- `focus-list` (Alt+L) → as "Sessions" in the rail: the `sessions` view, then the focus on a list entry.
- `focus-main-view` (Alt+C) → the focus goes to the main view: the terminal of the open SessionView, or the message area of the open ConversationView. No open session → nothing.
- `open-session` → sessionToOpen with the live sessions, the order of `useSessionOrder`, the open session and the target:
  - a session other than the open one → it becomes the open one, hosted or external as for a list click.
  - the open session → nothing changes.
  - none, target `next-needs-input` → the open session does not change, and the toast shows "No session needs input".
  - none, any other target → nothing.
- focus after an open by shortcut → it follows the open path of a click. In addition, when the focus was in the main view before the open, the new main view gets it.
- `new-session` (Alt+N) → opens FolderChooser, as "New Session" does.
- `resume-history` (Alt+H) → opens ResumeDialog, as "Resume" in the rail does.
- `toggle-theme` (Alt+A) → switches the theme (ThemeStore `toggle`), as the "Theme" section of the SettingsDialog does.
- `open-shortcut-settings` (Alt+S) → opens the SettingsDialog on the "Shortcuts" menu. With the popup open, Alt+S does nothing (useShortcutKeys).
- `session-command` (Alt+E, Alt+R, Alt+Shift+Q, Alt+Shift+W) → sent to ShortcutChannel. The component that owns the action runs it; with no owner on the page, nothing happens.

## Rules and invariants

- the top bar, the rail and the head of the list panel stay in place. Only the SessionList, or the rows of the ProjectList, scroll when they do not fit.
- at 1440 × 900 px with no saved width → top bar 38 px high, rail 52 px wide, list panel 260 px wide.
- the first frame already shows the stored width: no jump at start or after a reload.
- from 1280 px to 3840 px of window width → no horizontal scroll and no overlapping elements, except the snackbar and the NewerVersionNotice, which may cover part of the main area.
- the list panel has no brand, no "New Session", no "Resume Session" and no settings button.
- a change of the main view (another session, a session opened from the EmptyState, or back to the EmptyState) → cross-fade. The old view fades out (`--motion-duration-exit`) while the new one fades in (`--motion-duration-enter`), both in the same place and at the same size. SessionView, ConversationView and EmptyState are all covered. The old view stays mounted, with its state, until the end of the fade; then it goes. No cross-fade at page load, and none with reduced motion: the new view replaces the old one at once.
- the leaving view takes no input: no click, no keyboard focus, hidden from assistive technology. If it holds the focus, it loses it. It gets no `focusRef`: `focus-main-view` reaches only the new view.
- a new change during a cross-fade ends it: the views on screen go at once and only the last selected view shows, with no fade. Going back to the leaving view during the fade keeps that view, with its state.
- the PlanUsagePopover, the snackbar, the NewerVersionNotice and the toast are mounted through ExitPresence: when one closes, it plays its exit effect before it goes. Opening it again during the exit shows a new one at once.

## Dependencies

- TopBar, SettingsDialog, PlanUsagePopover, PlanUsageStore, NewerVersionNotice, useNewerVersion, NavigationRail, NeedsInputSnackbar, EmptyState, WebEntry, ExitPresence (`motionDurationMs`), MotionTokens, useDesktopBridge, ListWidthStore, ListPanelEdge
- useShortcutKeys, ShortcutMap, ShortcutChannel, ShortMessageToast, ThemeStore
- ExitPresence
- FolderChooser, ProjectList, ProjectListStore, SessionNameDialog (module folders)
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
- `plan-keyboard_shortcuts/REQ-1`, `plan-keyboard_shortcuts/REQ-3`, `plan-keyboard_shortcuts/REQ-4`, `plan-keyboard_shortcuts/REQ-5`, `plan-keyboard_shortcuts/REQ-6`, `plan-keyboard_shortcuts/REQ-7`, `plan-keyboard_shortcuts/REQ-8`, `plan-keyboard_shortcuts/REQ-9`, `plan-keyboard_shortcuts/REQ-10`, `plan-keyboard_shortcuts/REQ-11`, `plan-keyboard_shortcuts/REQ-12`, `plan-keyboard_shortcuts/REQ-13`, `plan-keyboard_shortcuts/REQ-21`, `plan-keyboard_shortcuts/REQ-30`, `plan-keyboard_shortcuts/REQ-31`, `plan-keyboard_shortcuts/REQ-43`
- `plan-git_explorer/REQ-25`
- `plan-ui_transitions/REQ-4`, `plan-ui_transitions/REQ-10`, `plan-ui_transitions/REQ-11`, `plan-ui_transitions/REQ-26`, `plan-ui_transitions/REQ-28`
- `plan-recent_projects/REQ-2`, `plan-recent_projects/REQ-8`, `plan-recent_projects/REQ-11`, `plan-recent_projects/REQ-14`, `plan-recent_projects/REQ-17`, `plan-recent_projects/REQ-21`
- `plan-project_list_actions/REQ-7`
- `plan-update_check/REQ-4`, `plan-update_check/REQ-7`, `plan-update_check/REQ-8`, `plan-update_check/REQ-10`
- `plan-wsl_support/REQ-9`, `plan-wsl_support/REQ-13`
- `plan-ui_restyle/REQ-1`, `plan-ui_restyle/REQ-2`, `plan-ui_restyle/REQ-3`
- `plan-settings_dialog/REQ-1`, `plan-settings_dialog/REQ-4`, `plan-settings_dialog/REQ-9`, `plan-settings_dialog/REQ-18`, `plan-settings_dialog/REQ-24`, `plan-settings_dialog/REQ-25`, `plan-settings_dialog/REQ-49`, `plan-settings_dialog/REQ-53`
- `plan-dark_blue_theme/REQ-1`, `plan-dark_blue_theme/REQ-2`, `plan-dark_blue_theme/REQ-16`
