---
batch: history-search
feature: Search in the session history
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17
depends: —
---

# Batch — Search in the session history

This batch creates no component. It adds a search bar to the ResumeDialog ("Resume Session"). The filter runs in the browser on the list that the dialog already loads. The server does not change.

## Texts fixed by this plan

Explicit assumption, gatekeeper decision of 2026-11-06. Capitals follow the English UI plan: Title Case for names and buttons, sentence case for hints and sentences.

| Element | Text |
|---------|------|
| Search bar placeholder | Search by label or folder |
| Search bar accessible name | Search Past Sessions |
| Clear button accessible name and tooltip | Clear Search |
| Empty state when nothing matches | No sessions match "&lt;search text&gt;". |

## Decisions

- **The bar is always there.** It shows from the moment the dialog opens, also while the list loads and when there are no past sessions. So the focus can go to it on open (REQ-2). The current loading and "No sessions to resume." states do not change.
- **A hidden selection is cleared.** When the filter hides the selected session, no session stays selected and "Resume" is disabled. A hidden session is never resumed by mistake. Explicit assumption, gatekeeper decision of 2026-11-06.
- **Style.** The bar uses the dialog field look of WebEntry (`.field-input`, as `#new-sess-dir`), with a search icon on the left. The mock's search bar of the main session list gives the icon and the placeholder colour. Its status pills and "/" key badge stay out.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/icons/Icons.tsx` | Add the Lucide `SearchIcon` and `XIcon`, decorative, in the same form as the other icons. | REQ-1, REQ-9, REQ-17 | — |
| INT-2 | modify | `src/web/history/ResumeDialog.tsx` | Add the search bar above the scrolling area, with the search icon, placeholder and accessible name above. It starts empty and takes the focus on mount (`autoFocus`), so every opening starts empty and focused. | REQ-1, REQ-2, REQ-11, REQ-13, REQ-17 | INT-1 |
| INT-3 | modify | `src/web/history/ResumeDialog.tsx` | Filter the loaded groups at each keystroke, in memory, with no debounce and no request. Keep a session when its label or its group folder contains the search text, ignoring case. Drop empty groups and keep the order. Empty text → full list. | REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-10, REQ-16 | INT-2 |
| INT-4 | modify | `src/web/history/ResumeDialog.tsx` | When groups exist but none matches, show a compact AreaState `empty` with the history icon and the text above, in place of the radiogroup. | REQ-8, REQ-13 | INT-3 |
| INT-5 | modify | `src/web/history/ResumeDialog.tsx` | Add the "Clear Search" icon button (`XIcon`) at the right end of the bar, only while it has text. A click empties the text and puts the focus back in the bar. | REQ-9, REQ-13 | INT-2 |
| INT-6 | modify | `src/web/history/ResumeDialog.tsx` | Enter in the bar prevents its default, so the Dialog does not run "Resume". Esc is not stopped by the bar, so the Dialog closes. Use a text input, so the browser does not clear a search field on Esc. | REQ-14, REQ-15 | INT-2 |
| INT-7 | modify | `src/web/history/ResumeDialog.tsx` | When the filter hides the selected session, clear the selection. Selecting and resuming a visible session keeps the current path, RunningElsewhereWarning included. | REQ-12 | INT-3 |
| INT-8 | modify | `src/web/styles.css` | Lay out the bar: the field look of `.field-input`, the icon inside on the left in `--text-muted`, the clear button inside on the right. | REQ-17 | — |

The developer updates the ResumeDialog and IconSet specs and the history index to match.

## Human acceptance

### Scenario: The user finds past sessions by typing part of their label

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-13, REQ-16, REQ-17
- Given → the machine has some hundreds of past sessions in several folders, and a few labels in two folders contain "Login"
- And → the user has just opened "Resume Session": an empty bar "Search by label or folder" sits above the list
- When → the user types "login" at once, without clicking
- Then → while the user types, the list shows only the sessions whose label contains "Login", under their two folder headings, in the order of the full list
- And → the bar has the look of the other dialog fields, and the list reacts with no visible delay

### Scenario: The user finds the sessions of one project by its folder

- REQ → REQ-3, REQ-10
- Given → "Resume Session" is open, the bar is empty and the full list shows
- When → the user types a part of one folder path that no label contains
- Then → the list shows all the sessions of that folder, and no other folder

### Scenario: Nothing matches the search text

- REQ → REQ-8, REQ-13
- Given → "Resume Session" is open with some past sessions
- When → the user types "zzqx"
- Then → the list is gone, and the dialog shows "No sessions match "zzqx"."
- And → the bar shows the button "Clear Search" at its right end

### Scenario: The user clears the search

- REQ → REQ-9, REQ-10, REQ-13
- Given → "Resume Session" shows the empty state for "zzqx"
- When → the user clicks "Clear Search"
- Then → the bar is empty with the cursor in it, and the full list is back

### Scenario: The user resumes a session from a filtered list

- REQ → REQ-12
- Given → the user typed "login" and selected one of the sessions shown
- When → the user clicks "Resume"
- Then → the session opens in the client, as from the full list

### Scenario: Enter in the search bar resumes nothing

- REQ → REQ-15
- Given → the user selected a session in a filtered list, then clicked back into the bar
- When → the user presses Enter
- Then → no session opens, and the dialog stays open with the same list

### Scenario: Esc closes the dialog while searching

- REQ → REQ-14
- Given → the bar has the focus and contains "login"
- When → the user presses Esc
- Then → the dialog closes

### Scenario: The search starts empty at each opening

- REQ → REQ-11
- Given → the user closed "Resume Session" with "login" in the bar
- When → the user opens "Resume Session" again
- Then → the bar is empty and the full list shows
