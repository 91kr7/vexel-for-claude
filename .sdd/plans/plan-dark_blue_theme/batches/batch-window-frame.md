---
batch: window-frame
feature: Window frame — title bar, rail, bottom bar, toast
closed_req: [REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15]
depends: [shared-shapes]
---

# Batch window-frame

Reference mock: `.sdd/mockups/dark_blue_theme/mock.html`, title bar, rail and status bar. Colours
come from the role tokens of batch shared-shapes. The rail takes the "canvas and rail" role. The
title bar and the bottom bar take the "title bar, session header, bottom bar" role. This batch also
serves REQ-1 and REQ-2, which close in batch session-view.

The bottom bar is the SessionFooter of the open session. ConversationView uses it too.

Desktop app: tests that launch Electron go in the Electron e2e group, never in the default e2e run
(knowledge base `electron-e2e-separate`).

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/TopBar.tsx` | 38 px high, on its role surface. Logo, brand and version on the left; the plan usage button on the right. Drag area and window button places stay as today. | REQ-1, REQ-2, REQ-6, REQ-8 | — |
| INT-2 | modify | `src/web/WindowButtons.tsx` | Colours, symbols and style stay. The Windows-style buttons follow the 38 px bar height. | REQ-7, REQ-8 | INT-1 |
| INT-3 | modify | `src/desktop/startup-page.ts` | The drag bar becomes 38 px high, the height of the client title bar. | REQ-6, REQ-8 | — |
| INT-4 | modify | `src/web/AppLayout.tsx` | The page rows follow the 38 px title bar. The rule "top bar 44 px" becomes 38 px. | REQ-6 | INT-1 |
| INT-5 | modify | `src/web/NavigationRail.tsx` | 52 px on its role surface. "Sessions", "Projects" and "Resume" become 32 px squares with 8 px corners. | REQ-1, REQ-2, REQ-9 | — |
| INT-6 | modify | `src/web/SettingsButton.tsx` | 32 px square with 8 px corners, still at the bottom of the rail. | REQ-9 | — |
| INT-7 | modify | `src/web/NavigationRail.tsx` | "New Claude Code Session" becomes a square tinted with the accent and an accent border, in place of the gradient. | REQ-10 | INT-5 |
| INT-8 | modify | `src/web/NavigationRail.tsx` | The active item shows a 3 px accent bar on its left edge with a soft glow, as in the mock. | REQ-11 | INT-5 |
| INT-9 | modify | `src/web/sessions/SessionFooter.tsx` | 32 px high on its role surface. The path sits in a pill with 5 px corners and a 1 px border. | REQ-1, REQ-2, REQ-12 | — |
| INT-10 | modify | `src/web/sessions/SessionFigures.tsx` | Each figure sits in a pill with 5 px corners and a 1 px border. Numbers use the mono font with tabular figures. | REQ-12, REQ-14 | — |
| INT-11 | modify | `src/web/sessions/SessionFigures.tsx` | The context pill fills in proportion to the percentage, in the colour of its usage level. | REQ-13 | INT-10 |
| INT-12 | modify | `src/web/sessions/TerminalZoomControls.tsx` | The size value sits in the same pill, with tabular figures. | REQ-12, REQ-14 | — |
| INT-13 | modify | `src/web/ShortMessageToast.tsx` | 8 px corners, a border and an accent dot before the text, as in the mock. | REQ-15 | — |
| INT-14 | modify | `src/web/AppLayout.tsx` | The toast sits at the bottom right. When the needs-input snackbar shows, the toast sits above it. | REQ-15 | INT-13 |

## Human acceptance

### Scenario: the window frame takes the mock's layout

- REQ → REQ-6, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14
- Given → the client in the Dark theme, with a session open that has context usage
- When → the user looks at the window
- Then → the title bar is 38 px, the rail shows 32 px square buttons with the accent "+" and the accent bar on "Sessions", and the bottom bar is 32 px with each value in a pill
- And → the context pill is filled in proportion to its percentage

### Scenario: the desktop window still moves and its buttons still work

- REQ → REQ-7, REQ-8
- Given → the desktop app, in the current look and then in the Windows 11 look
- When → the user drags the title bar, then uses minimize, maximize and close
- Then → the window moves, and each button acts, with the same colours and style as before

### Scenario: a short message shows at the bottom right

- REQ → REQ-15
- Given → the client with no session that needs input
- When → the user presses a shortcut that shows a short message, such as "next session that needs input"
- Then → the toast "No session needs input" shows at the bottom right, with 8 px corners, a border and an accent dot
