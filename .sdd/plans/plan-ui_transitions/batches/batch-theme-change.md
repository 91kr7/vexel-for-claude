---
batch: theme-change
feature: Theme change
closed_req: [REQ-14, REQ-15]
depends: [modal-dialogs]
---

# Batch theme-change

The motion base comes from batch modal-dialogs. The theme and the look change through ThemeStore and LookStore. ThemeSection, LookSection and the shortcut Alt+A all call them.

## What this batch builds

- **Colour dissolve** → runs one theme or look change as a cross-fade of the whole page, from the old colours to the new ones, terminal included.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area (theme) | Colour dissolve: wraps a colour change in a whole-page cross-fade, terminal canvas and commit graph included. It never takes pointer or key input. With reduced motion it applies the change at once. | REQ-14, REQ-15, REQ-25, REQ-26 | — |
| INT-2 | modify | `src/web/theme/theme-store.ts` | `setTheme` and `toggle` apply the new theme through the colour dissolve. A new change during a dissolve ends on the last theme. | REQ-14, REQ-28 | INT-1 |
| INT-3 | modify | `src/web/theme/look-store.ts` | The look toggle applies the new look through the colour dissolve. | REQ-14 | INT-1 |

Notes:

- The theme and look marks set before the first paint (WebEntry) do not change: the first paint has no dissolve.
- The dissolve ends with every area in the new colours: the terminal recolours under it, as today, and the commit graph reads its colours again before it ends.

## Human acceptance

### Scenario: the theme changes with a colour dissolve

- REQ → REQ-14, REQ-15
- Given → an open session with text in its terminal, in the Dark Blue theme
- When → the user chooses "Light" in the "Theme" group of Settings
- Then → the colours of the whole app dissolve to the new theme, the terminal included, and no area keeps a Dark Blue colour at the end

### Scenario: the window look changes with the same dissolve

- REQ → REQ-14, REQ-32
- Given → the app in the macOS window look
- When → the user chooses "Windows 11" in the "Window Look" group of Settings
- Then → the page dissolves to the Windows 11 look, and later effects, such as closing Settings, look the same as before

### Scenario: two quick theme changes end on the last theme

- REQ → REQ-26, REQ-28
- Given → the app in the Dark theme
- When → the user presses Alt+A twice in quick succession
- Then → the app ends in the theme of the second press, and the page takes clicks during the dissolve
