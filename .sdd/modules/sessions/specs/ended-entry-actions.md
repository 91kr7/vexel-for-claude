---
module: sessions
component: EndedEntryActions
type: UI component
---

# EndedEntryActions

**Purpose** → the "Resume" and "Dismiss" actions of the list entry of an ended hosted session.

## Contract

Description:
- two small icon buttons at the top right of the entry, over its state name, on `--bg-surface-2`. They sit beside the entry button, not inside it. An error shows under the entry.

Props:
- `sessionId` → the id of the ended hosted session.
- `resumable` → `true` shows "Resume".
- `onResumed(id)` → called with the id of the new hosted session after a resume. Optional.

Shows:
- "Resume" (history icon), only when `resumable`, then "Dismiss" (x icon). 20 px square buttons, 4 px radius, 14 px icons in `--text-muted`. Hover → `--bg-surface-3` and `--text-primary`.
- each button has the accessible name and the tooltip (`title`) "Resume" or "Dismiss".
- the buttons are hidden (opacity 0) until the pointer is over the entry or the focus inside the entry is visible from the keyboard. They stay shown while a request runs or the warning is open.
- while a request runs → both buttons have `aria-disabled="true"` and a click sends nothing more. The pressed one shows the Spinner in place of its icon and has `aria-busy="true"`.
- an ErrorMessage under the entry after a failed request. A new request clears it.

Actions:
- "Dismiss" → `POST /api/sessions/:id/dismiss`, no confirmation.
  - `204` → nothing more: the entry leaves the list by the `session-removed` event.
  - any other answer, or a network error → "Could not dismiss the session.".
- "Resume" → `POST /api/sessions/:id/resume` with body `{}`.
  - `201` → `onResumed(id)` with the new id.
  - `409` `running_elsewhere` → opens RunningElsewhereWarning. "Resume Anyway" sends the request again with `{ "force": true }`. "Cancel" closes the warning and sends nothing.
  - `404` `session_not_found` → "The session no longer exists.".
  - `404` `folder_not_found` → "The project folder does not exist.".
  - any other answer, or a network error → "Could not resume the session.".
- Tab reaches "Resume" then "Dismiss" after the entry button. Enter or Space presses them. The focused button shows the focus ring.

## Rules and invariants

- On a failed Resume the entry stays where it is.
- The warning opens over the whole page, outside the list entry, so a drag of the entry cannot start from it.

## Dependencies

- ErrorMessage, ProgressIndicator (`Spinner`), IconSet (module app)
- RunningElsewhereWarning (module history)
- DismissSessionRoute, ResumeEndedSessionRoute

## Requirements served

- `plan-session_list_improvements/REQ-4`, `plan-session_list_improvements/REQ-8`, `plan-session_list_improvements/REQ-9`, `plan-session_list_improvements/REQ-12`, `plan-session_list_improvements/REQ-13`
