---
slug: cool_slate_light
date: 2026-11-20
spec: .sdd/analysis/cool_slate_light.md
status: validated
---

# Requirements — Light theme recoloured as "Cool Slate · Full Light"

Words used below, as in the spec:

- "The mock" → `.sdd/mockups/cool_slate_light/mock.html`, preset "Cool Slate · Full Light".
- "The palette" → the colours of the tables at the end of this file. Table A is the client palette, table B the terminal palette.
- "Role" → a row of a table.

## Feature: Cool Slate palette

| ID | Requirement |
|----|-------------|
| REQ-1 | In the Light theme, the canvas, bars, rail, workspace, cards, raised surfaces, popovers, dialogs, hover surface, active card surface, pills and progress track take the surface colours of table A. |
| REQ-2 | In the Light theme, borders, the accent, the accent tint, the context pill, progress fills and the keyboard focus take the border and accent colours of table A. |
| REQ-3 | In the Light theme, main, secondary and muted text take the text colours of table A. |
| REQ-4 | In the Light theme, the session status colours follow table A: working is green, needs input is warning, error is danger, waiting, idle and ended are the idle slate. |
| REQ-5 | In the Light theme, the interrupt and terminate actions take the warning and danger colours of table A. |
| REQ-6 | In the Light theme, cards and the active card take the shadows of table A. |
| REQ-7 | In the Light theme, scrollbars and native form controls take the colours of table A. |
| REQ-8 | A colour changes only where the element already has that property: no border or shadow appears that does not exist today. |
| REQ-9 | No element is added, removed, moved or resized, in any theme. |
| REQ-10 | In the Light theme, an element not shown in the mock takes the colour of the nearest role of table A. |
| REQ-11 | In the Light theme, every screen, dialog, popover, menu, tooltip, toast and state of the client uses the palette, also the screens the mock does not show. |
| REQ-12 | The palette applies in the browser and in the desktop app. |
| REQ-13 | The Dark and Dark Blue themes look exactly as they do today. |
| REQ-14 | Text in the Light theme meets WCAG 2.2 AA contrast. Where a value of table A fails, the colour changes only as much as needed. |
| REQ-15 | In the Light theme, the status colours of working, needs input, error, waiting and ended stay distinguishable on the light surfaces. |
| REQ-16 | In the Light theme, every control keeps a visible keyboard focus. |

## Feature: Light terminal

| ID | Requirement |
|----|-------------|
| REQ-17 | In the Light theme, the terminal of hosted sessions has the background and frame border of table B. |
| REQ-18 | In the Light theme, the terminal text, muted text, strong text, green, yellow, blue, links and cursor take the colours of table B. |
| REQ-19 | In the Light theme, every other terminal colour (red, magenta, cyan, black, white, the bright variants) is a slate-family tone that reaches 4.5:1 on the terminal background. |
| REQ-20 | In the Light theme, selected text in the terminal stays readable. |
| REQ-21 | In the Light theme, where the client draws the user prompt band and the divider itself, they take the colours of table B. |
| REQ-22 | In the Light theme, the tool output and code blocks of external sessions use the colours of table B. |
| REQ-23 | The light terminal applies in the browser and in the desktop app. |
| REQ-24 | In the Dark and Dark Blue themes, the terminal looks exactly as it does today. |
| REQ-25 | In the Light theme, text that Claude Code draws in its own fixed colours in the hosted terminal keeps at least 4.5:1 against the colour it is drawn on. |

## Assumptions

- **Two features.** The terminal palette is applied by a different part of the client than the page colours. Each feature can be checked and can fail on its own.
- **Opacity and blur stay (spec).** Popups keep their 60% background and 8px blur from `plan-popup_glass`. Table A gives their base colour. The mock's 85-92% alphas and 20px blur are not adopted.
- **Contrast inside popups (REQ-14).** `plan-popup_glass` decided that the 60% glass wins over contrast in the Light theme. That decision stays: inside popups, REQ-14 holds only as far as the 60% glass allows.
- **First-start theme.** It does not change. The spec says "Dark stays the default", but today the first-start theme is Dark Blue (`plan-dark_blue_theme/REQ-35`). The spec line is outdated; this plan does not touch the default.
- **Desktop startup page.** Where it shows the Light theme, it is a screen of the client and REQ-11 covers it.
- **Window buttons, fonts, sizes, radii.** They stay as they are (spec assumptions). REQ-9 covers it.
- **Status mapping (REQ-4).** Waiting and ended use the idle slate, as the spec assumes.
- **Prompt band and divider (REQ-21, REQ-25).** Gatekeeper decision, 2026-11-20. In the hosted terminal, Claude Code draws the band and the divider in its own fixed colours, and its theme setting is out of scope. So REQ-21 applies where the client draws them (the external-session view). In the hosted terminal the band may differ from the mock, but the text stays readable (REQ-25).
- **Terminal white (REQ-19).** Gatekeeper decision, 2026-11-20. White and bright white become mid-grey slate tones, as in the usual light terminal themes.

## Earlier plans changed by this plan

- `plan-light_theme/REQ-12` and `plan-dark_blue_theme/REQ-29` (dark terminal in the Light theme) are replaced by REQ-17 to REQ-23 and REQ-25.
- `plan-light_theme/REQ-7` and `/REQ-9` (editorial-light values and accent) are replaced by REQ-1 to REQ-6 for the Light theme.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The mock is binding for the colours of the Light theme. It does not limit the scope: screens it does not show are in scope (REQ-11).
- A change made for WSL never breaks the app on Ubuntu.
- Out of scope: the other mock presets, the mock's preset switcher, wallpaper, frosted toggle, sample texts and font-size stepper, fonts, opacity, blur, animations, and the Claude Code theme setting of hosted sessions.

## Table A — client palette

| Role | Colour |
|------|--------|
| canvas | `#f3f5f8` |
| title bar, session list, status bar | `#f6f8fb` |
| navigation rail | `#eef1f6` |
| workspace behind the terminal | `#f3f5f8` |
| card, raised surface, popover, dialog | `#ffffff` |
| surface on hover | `#f1f5f9` |
| active card surface | `#eef4ff` |
| pill, progress track | `#e9eef5` |
| subtle border | `rgba(15, 23, 42, 0.08)` |
| default border | `rgba(15, 23, 42, 0.14)` |
| active border, accent, progress fill, focus | `#2563eb` |
| accent soft tint | `rgba(37, 99, 235, 0.12)` |
| accent pill (context) | bg `#dbeafe`, text `#1d4ed8`, border `rgba(37, 99, 235, 0.22)` |
| main text | `#0f172a` |
| secondary text | `#475569` |
| muted text | `#64748b` |
| working status | bg `#dcfce7`, text `#15803d`, dot `#16a34a` |
| idle status dot | `#64748b` |
| warning (interrupt, needs input) | bg `#fef3c7`, text `#b45309`, border `#fcd34d` |
| danger (terminate, error) | bg `#fee2e2`, text `#b91c1c`, border `#fca5a5` |
| card shadow | `0 1px 2px rgba(15, 23, 42, 0.05)` |
| active card shadow | `0 2px 8px rgba(37, 99, 235, 0.10)` |
| scrollbar thumb | `rgba(100, 116, 139, 0.28)`, hover `0.45` |

## Table B — terminal palette

| Role | Colour |
|------|--------|
| background | `#ffffff` |
| frame border | `rgba(15, 23, 42, 0.14)` |
| text | `#1e293b` |
| muted text | `#64748b` |
| strong text | `#0f172a` |
| green | `#15803d` |
| yellow | `#b45309` |
| blue, links | `#1d4ed8` |
| cursor | `#2563eb` |
| user prompt band | `rgba(15, 23, 42, 0.055)` |
| divider | `rgba(15, 23, 42, 0.10)` |
