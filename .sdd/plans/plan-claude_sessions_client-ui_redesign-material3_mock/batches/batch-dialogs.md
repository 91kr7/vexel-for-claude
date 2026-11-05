---
batch: dialogs
feature: Dialogs
closed_req: [REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52]
depends: [session-list]
---

# Batch — Dialogs

The new-session dialog with "Recenti", the stop confirmation, the resume history and the running-elsewhere warning.

Constraint → every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true. This includes Enter, Esc, the focus trap, the loading, busy and error states, and the folder browser of the new-session dialog.

## Visual reference

Board file → `.sdd/mockups/vexel-material3/proposta-dialoghi.html`:
- `div role="dialog"` → the new-session dialog: icon, title, description, field "Cartella del progetto", "Recenti" radio rows, "Annulla", "Avvia sessione". The resume history copies this layout.
- `div role="alertdialog"` → the stop confirmation: icon in a 48 px circle, title, text, "Annulla" (focused), "Termina". The running-elsewhere warning copies this layout in amber.
- the first `div aria-hidden="true"` → the scrim behind every dialog.

## What this batch builds

- No new component. It redraws the four dialogs on the board frames and adds "Recenti" to the new-session dialog.
- To the developer: the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute. Board: `proposta-dialoghi.html`.

## Decisions for this batch

- **"Recenti" source** → the `folder` of each group of `GET /api/past-sessions`, in the order of the route. That order is already one group per folder, most recent first. No server change.
- **"Recenti" list** (gatekeeper decision) → each folder once, no maximum. Each row looks like a board radio row: Avatar (36 px), folder name, full path in mono, radio. When the list is empty or does not load, "Recenti" does not show. The dialog still works.
- **Choosing a recent folder** → it becomes the current folder, as a click on a subfolder does. The field and the folder listing update. The row whose folder is in the field is checked.
- **Folder browser** → it stays below "Recenti", under the heading "Cartelle", in the style of the "Recenti" heading. Its rows look like the "Recenti" rows, with a folder icon in place of the Avatar and no radio. The dialog body between the field and the buttons scrolls as one area.
- **Field** → it keeps the absolute path. Paths are shown in full: "~/…" in the board is sample data.
- **Stop confirmation text** → title "Terminare la sessione?". Text: "**<folder name>** sta ancora lavorando. Il turno in corso verrà interrotto; potrai riprendere la conversazione dalla cronologia." It still opens only when the session is working. "Annulla" has the focus, so Enter cancels.
- **Warning tones** → error tone for the stop confirmation (`--error-container` circle, "Termina" in `--error`). Amber tone for the running-elsewhere warning (`--attn-container` circle, "Riprendi comunque" in `--attn`). The warning keeps its texts.
- **Resume history** → history icon, title "Riprendi sessione", one heading per folder in the "Recenti" style, one radio row per session: Avatar, label, date and time. The selected row uses the checked style of the board. "In esecuzione in un terminale" becomes an amber chip in the row.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/dialogs/Dialog.tsx` | Board frame: 32 % black scrim, 28 px radius, 520 px max width, 24 px padding, icon on top, centred title and description, actions on the right. IDENTICAL to the board `role="dialog"`. | REQ-44, REQ-49, REQ-51, REQ-52 | — |
| INT-2 | modify | `src/web/dialogs/WarningDialog.tsx` | Stop-confirmation frame: 360 px max width, icon in a 48 px circle, text buttons. An error tone and an amber tone. "Annulla" keeps the focus. IDENTICAL to the board `role="alertdialog"`. | REQ-47, REQ-48, REQ-50, REQ-51, REQ-52 | INT-1 |
| INT-3 | modify | `src/web/sessions/StopSessionButton.tsx` | The confirmation uses the error tone, the power icon, the board title and the text with the folder name in bold. SessionView passes the folder name. | REQ-47, REQ-48, REQ-52 | INT-2 |
| INT-4 | modify | `src/web/history/RunningElsewhereWarning.tsx` | Use the amber tone of the warning frame. Texts and buttons do not change. | REQ-50 | INT-2 |
| INT-5 | modify | `src/web/folders/FolderChooser.tsx` | Folder-plus icon, title, description "Scegli il progetto in cui avviare Claude Code.", outlined field "Cartella del progetto" with the folder icon and a mono value. IDENTICAL to the board. | REQ-44, REQ-52 | INT-1, INT-10 |
| INT-6 | modify | `src/web/folders/FolderChooser.tsx` | "Recenti": a radio group of the folders of `GET /api/past-sessions`, in order, each once, rows as the board. Hidden when empty or not loaded. | REQ-45, REQ-52 | INT-5 |
| INT-7 | modify | `src/web/folders/FolderChooser.tsx` | Choosing a recent row makes its folder the current one: field and listing update, and that row is checked. | REQ-46 | INT-6 |
| INT-8 | modify | `src/web/folders/FolderChooser.tsx` | Folder browser under "Cartelle", below "Recenti", with rows in the "Recenti" style. The body scrolls as one area. | REQ-44 | INT-6 |
| INT-9 | modify | `src/web/history/ResumeDialog.tsx` | The new-session layout: history icon, folder headings, one radio row per session (Avatar, label, date and time), amber chip for a session running elsewhere. | REQ-49 | INT-1 |
| INT-10 | modify | `src/web/icons/Icons.tsx` | Add the folder-plus and folder icons, with the paths copied from the board. | REQ-44 | — |

## Human acceptance

### Scenario: The user picks a recent folder for a new session

- REQ → REQ-44, REQ-45, REQ-46, REQ-51, REQ-52
- Given → the latest past session is in "billing-api", an older one is in "docs-site", and the new-session dialog is open
- When → the user chooses "billing-api" under "Recenti"
- Then → the field "Cartella del progetto" holds the path of "billing-api" and its row is checked
- And → the dialog matches board "Dialoghi" on a darkened page, with "billing-api" first under "Recenti", except for the light-blue and grey palette

### Scenario: The user cancels a stop with Enter

- REQ → REQ-47, REQ-48, REQ-52
- Given → an open hosted session "billing-api" in which Claude is working, and the user clicked "Termina"
- When → the user presses Enter
- Then → the confirmation closes and the session keeps running
- And → before Enter, the confirmation read "billing-api sta ancora lavorando…" and "Annulla" had the focus

### Scenario: The user resumes a past session from the history

- REQ → REQ-49
- Given → past sessions exist
- When → the user opens the resume history
- Then → it has the layout of the new-session dialog, with one radio row per past session under its folder

### Scenario: The user sees the amber running-elsewhere warning

- REQ → REQ-50
- Given → the resume history is open, with a session that runs in another terminal selected
- When → the user clicks "Riprendi"
- Then → the warning opens in the stop-confirmation layout, in amber colours, with "Annulla" focused
