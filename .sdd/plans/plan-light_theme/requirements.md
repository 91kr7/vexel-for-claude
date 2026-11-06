---
slug: light_theme
date: 2026-11-06
spec: .sdd/analysis/light_theme.md
status: validated
---

# Requirements — Light theme with a Light/Dark switch

"The mock" is `.sdd/mockups/studio-dark/mock.html`. "Editorial-light" is its `[data-theme="editorial-light"]` theme, called "Paper Light" in the mock. "Accent" is the light blue that the dark theme already uses in place of the mock's orange. "The switch" is the new Light/Dark control.

## Feature: Light theme

| ID | Requirement |
|----|-------------|
| REQ-1 | The top bar shows the switch on every screen. |
| REQ-2 | The switch shows which theme is active and has an accessible name. |
| REQ-3 | Using the switch changes the theme of the whole client at once, without a reload. |
| REQ-4 | Changing the theme does not interrupt sessions, close dialogs, or lose the open session or the scroll position. |
| REQ-5 | The switch works with the keyboard and shows a visible focus, like the other controls of the top bar. |
| REQ-6 | In the light theme, every screen, dialog and state takes the look of the mock's editorial-light theme. |
| REQ-7 | In the light theme, canvas, surfaces, the glass surface, borders, the top highlight of surfaces and the text colours use the editorial-light values of the mock. The only exception is a text colour changed by REQ-14. |
| REQ-8 | In the light theme, an element with no counterpart in editorial-light is built from the light theme's surfaces, borders and text colours. |
| REQ-9 | In the light theme, the client uses the accent wherever the mock uses its accent colours. The only exception is a darker tone required by REQ-15. |
| REQ-10 | In the light theme, the client uses Roboto Flex where the mock uses a serif font, and Roboto Mono where it uses JetBrains Mono. |
| REQ-11 | Scrollbars and native form controls render in the active theme. |
| REQ-12 | In the light theme, the terminal panel of hosted sessions keeps its current dark look. |
| REQ-13 | The dark theme looks exactly as it does today, apart from the switch in the top bar. |
| REQ-14 | Text in the light theme meets WCAG 2.2 AA contrast. Where a mock value fails, the colour changes only as much as needed. |
| REQ-15 | In the light theme, accent text and text on accent-filled buttons use a darker tone of the accent where needed to reach 4.5:1. |
| REQ-16 | In the light theme, the status colours of working, needs input, error, waiting and ended stay distinguishable and readable on the light surfaces. |

## Feature: Remembered theme

| ID | Requirement |
|----|-------------|
| REQ-17 | The client remembers the chosen theme across reloads and restarts, in the browser and in the desktop app. |
| REQ-18 | On start, the client page shows the remembered theme from its first frame, with no flash of the other theme. |
| REQ-19 | With no remembered choice, the client starts in the light theme. |
| REQ-20 | The startup page of the desktop app, while the backend starts and on a startup error, always shows the light theme, whatever the remembered choice. |

## Human decisions (2026-11-06)

- **Light by default.** With no remembered choice the client starts light (REQ-19). This replaces the spec assumption "dark on first start" (`.sdd/analysis/light_theme.md`, line 60), which was a gatekeeper assumption. A user who picks Dark keeps Dark (REQ-17).
- **Startup page always light** (REQ-20).
- **Form of the switch.** One icon button that toggles between the themes. Its sun or moon icon shows the active theme. It sits on the right of the top bar, before the new-session button.

## Assumptions

- **One feature holds the switch and the light theme.** The switch has no visible effect without the light theme, and the user cannot reach the light theme without the switch. So they are always built together.
- **REQ-13.** The dark theme keeps today's look. It is now a choice of the user, not the default.
- **Where the choice lives.** The client keeps the choice where the user made it. The desktop app and each browser keep their own choice. The backend does not store it (spec assumption).
- **External sessions.** Tool output and code blocks of external sessions follow the active theme (spec assumption). REQ-6 covers them. Only the hosted terminal panel stays dark (REQ-12).
- **Startup page of the desktop app.** REQ-18 applies to the client page, which the window loads after the startup page. The startup page has its own rule, REQ-20.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The mock is the binding visual reference for the light theme. The developer reads the editorial-light values from the mock file: a description does not replace it.
- Only colours, shadows and the fonts named in REQ-10 change between the themes. Layout, sizes and behaviour stay the same.
- UI text stays in English, like the rest of the client.
- Out of scope: a "System" option or following the operating-system theme, the mock's carbon-indigo theme or any third theme, a light terminal panel, a settings screen, a choice of accent colour, any change to the dark theme or to the layout, the native title bar and the tray icon of the desktop app.
- Every requirement of the earlier plans of this client stays true, up to `plan-desktop_app`. This plan changes one thing: `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1` and `/REQ-2` (always dark, dark scrollbars and controls) now hold for the dark theme only.
