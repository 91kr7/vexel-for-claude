---
slug: dark_blue_theme
date: 2026-11-16
status: validated
---

# Batches — dark_blue_theme

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| shared-shapes | Shared shapes (all themes) | REQ-3, REQ-4, REQ-5 | — | certified | Dialogs and panels share the new shapes in Light and Dark |
| window-frame | Window frame: title bar, rail, bottom bar, toast | REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15 | shared-shapes | certified | The window frame takes the mock's layout |
| session-cards | Session cards | REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-43 | shared-shapes, window-frame | certified | The session list shows cards like the mock |
| session-view | Session view: header and terminal frame | REQ-1, REQ-2, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29 | shared-shapes, window-frame, session-cards | certified | The open session shows the mock's header and terminal frame |
| list-cards | Lists aligned to the session cards | REQ-44, REQ-45, REQ-46, REQ-47, REQ-48 | shared-shapes, session-cards | certified | The Resume dialog shows its sessions as cards |
| dark-blue | Dark Blue theme | REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42 | shared-shapes, window-frame, session-cards, session-view, list-cards | implemented | The user switches to Dark Blue |

Execution order: shared-shapes → window-frame → session-cards → session-view → list-cards → dark-blue.
session-cards depends on window-frame because both change `src/web/AppLayout.tsx`.

## Assumptions and decisions

- **Shared shapes come first.** Batch shared-shapes is the foundation batch. Its role and shape
  tokens let the later batches restyle each area without new colours. It is also a feature: the
  screens and dialogs outside the mock (REQ-3).
- **Role tokens.** The mock has more surface levels than ThemeTokens. New role tokens name each mock
  use. In Light and Dark they point to the existing levels, as the table of batch shared-shapes
  shows. In Dark Blue they take the REQ-36 colours.
- **The bottom bar is the SessionFooter.** The client has no separate status bar. ConversationView
  uses the same footer, so it changes too.
- **Card lines.** Line 2 shows the entry label, the client's own text. Line 3 holds percentage, cost
  and time. A working entry keeps its tool line and progress bar.
- **The header line pill** shows the text of today's line chip.
- **The toast moves to the bottom right.** It sits above the needs-input snackbar when both show.
- **Startup page.** Its drag bar follows the client title bar to 38 px, so the window buttons do not
  jump at start.
- **Windows 11 look.** The mock's sizes apply in both looks. The Windows 11 look keeps its own
  4 px and 8 px corners. Its dark colour set applies only to Dark: Dark Blue keeps its colours.
  The Windows-style window buttons follow the 38 px bar height, with the same colours and style.
- **Theme value.** `dark-blue`, with the same `data-theme` mark and storage key. `color-scheme`
  `dark`.
- **First-start theme.** Dark Blue, by human decision. See "Departures". The tests that expect Light
  with no saved theme are in the test scope of batch dark-blue.
- **Saved theme for every theme (REQ-32).** Human decision during coverage validation (2026-11-16):
  the chosen theme, Light, Dark or Dark Blue, stays at the next start, in the browser and in the
  desktop app. A saved theme wins over the first-start theme. This refines REQ-32 and agrees with
  the analysis, so it is not a departure. The desktop restart test goes in the Electron e2e group.
- **External cards lose the dashed border (REQ-43).** Human decision, 2026-11-16. It is added to
  batch session-cards as INT-9, for its fix round. The group heading and the "External" chip still
  tell external sessions apart.
- **Every list takes the session card look (REQ-44..48).** Human decision, 2026-11-16: the mock
  shows only the first page. Selectable lists become cards; dense technical lists take the card
  styles without becoming cards. New batch list-cards. It refines REQ-3 and the analysis rule on
  screens outside the mock, so it is not a departure.
- **Confirmed by the gatekeeper (2026-11-16):** the Windows 11 look rule, the toast above the
  snackbar, and the client's own text on card line 2 and in the header pill.
- **Shortcut text.** The `toggle-theme` row reads "Light/Dark/Dark Blue theme". Keys do not change.
- **Live terminal colours.** Today the terminal colours never change with the theme. Dark Blue has
  its own terminal background, so the open terminal must take the new colours on a theme change.
- **Git repository colours** keep their dark values in Dark Blue: they apply to any theme other than
  Light.
- **Electron tests.** Tests for REQ-8 go in the Electron e2e group (knowledge base
  `electron-e2e-separate`).

## Departures

- **First-start theme (REQ-35).** Departing from the spec, human decision (2026-11-16): Dark Blue is
  the theme of the first start. The analysis says "Dark stays the default", and the client starts
  in Light today. The analysis `.sdd/analysis/dark_blue_theme.md` must be corrected.

## Coverage check

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | batch-shared-shapes/INT-1, INT-2, INT-4; batch-window-frame/INT-1, INT-5, INT-9; batch-session-cards/INT-2, INT-3; batch-session-view/INT-1, INT-2 | session-view |
| REQ-2 | batch-shared-shapes/INT-1, INT-3; batch-window-frame/INT-1, INT-5, INT-9; batch-session-cards/INT-2, INT-3; batch-session-view/INT-1, INT-2 | session-view |
| REQ-3 | batch-shared-shapes/INT-2, INT-4, INT-6, INT-7, INT-8, INT-9, INT-10 | shared-shapes |
| REQ-4 | batch-shared-shapes/INT-5 | shared-shapes |
| REQ-5 | batch-shared-shapes/INT-2 | shared-shapes |
| REQ-6 | batch-window-frame/INT-1, INT-3, INT-4 | window-frame |
| REQ-7 | batch-window-frame/INT-2 | window-frame |
| REQ-8 | batch-window-frame/INT-1, INT-2, INT-3 | window-frame |
| REQ-9 | batch-window-frame/INT-5, INT-6 | window-frame |
| REQ-10 | batch-window-frame/INT-7 | window-frame |
| REQ-11 | batch-window-frame/INT-8 | window-frame |
| REQ-12 | batch-window-frame/INT-9, INT-10, INT-12 | window-frame |
| REQ-13 | batch-window-frame/INT-11 | window-frame |
| REQ-14 | batch-window-frame/INT-10, INT-12 | window-frame |
| REQ-15 | batch-window-frame/INT-13, INT-14 | window-frame |
| REQ-16 | batch-session-cards/INT-1, INT-2 | session-cards |
| REQ-17 | batch-session-cards/INT-1 | session-cards |
| REQ-18 | batch-session-cards/INT-3 | session-cards |
| REQ-19 | batch-session-cards/INT-4 | session-cards |
| REQ-20 | batch-session-cards/INT-5 | session-cards |
| REQ-21 | batch-session-cards/INT-6 | session-cards |
| REQ-22 | batch-session-cards/INT-7 | session-cards |
| REQ-23 | batch-session-cards/INT-8 | session-cards |
| REQ-24 | batch-session-cards/INT-8 | session-cards |
| REQ-25 | batch-session-view/INT-1 | session-view |
| REQ-26 | batch-session-view/INT-2, INT-4 | session-view |
| REQ-27 | batch-session-view/INT-3 | session-view |
| REQ-28 | batch-session-view/INT-3 | session-view |
| REQ-29 | batch-session-view/INT-2 | session-view |
| REQ-30 | batch-dark-blue/INT-6, INT-10 | dark-blue |
| REQ-31 | batch-dark-blue/INT-1, INT-9, INT-10 | dark-blue |
| REQ-32 | batch-dark-blue/INT-1, INT-2, INT-14 | dark-blue |
| REQ-33 | batch-dark-blue/INT-2, INT-14 | dark-blue |
| REQ-34 | batch-dark-blue/INT-1, INT-11 | dark-blue |
| REQ-35 | batch-dark-blue/INT-13, INT-14 | dark-blue |
| REQ-36 | batch-dark-blue/INT-3, INT-12 | dark-blue |
| REQ-37 | batch-dark-blue/INT-4 | dark-blue |
| REQ-38 | batch-dark-blue/INT-5, INT-9 | dark-blue |
| REQ-39 | batch-dark-blue/INT-5 | dark-blue |
| REQ-40 | batch-dark-blue/INT-7 | dark-blue |
| REQ-41 | batch-dark-blue/INT-4 | dark-blue |
| REQ-42 | batch-dark-blue/INT-8 | dark-blue |
| REQ-43 | batch-session-cards/INT-9 | session-cards |
| REQ-44 | batch-list-cards/INT-1, INT-2, INT-3, INT-4, INT-6 | list-cards |
| REQ-45 | batch-list-cards/INT-1, INT-3, INT-4, INT-6 | list-cards |
| REQ-46 | batch-list-cards/INT-1, INT-2, INT-3, INT-4, INT-6 | list-cards |
| REQ-47 | batch-list-cards/INT-1, INT-5, INT-7, INT-8, INT-9, INT-10, INT-11, INT-12 | list-cards |
| REQ-48 | batch-list-cards/INT-1, INT-2, INT-3, INT-9, INT-12 | list-cards |

- Every REQ has at least one INT. Every INT serves at least one REQ; there is no enabling-only INT.
- REQ-1 and REQ-2 build up over four batches and close in session-view.
- No batch creates a new component.
