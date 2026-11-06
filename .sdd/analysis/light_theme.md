---
request_slug: light_theme
date: 2026-11-06
type: evolution
size: narrow
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark.md
---

# Analysis — Light theme with a Light/Dark switch

## Request

> implementa tema chiaro/tema scuro(che c'è già)

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md) → the dark "Studio" restyle. It made the client always dark and removed the light theme (line 46). It left the mock's "editorial-light" theme and any theme switch out of scope (line 151).

Changes (human decisions of 2026-11-06):
- The client gets a light theme: the "editorial-light" ("Paper Light") theme of `.sdd/mockups/studio-dark/mock.html`. It uses the same swaps as the dark theme: light-blue accent, Roboto Flex in place of the serif fonts.
- A Light/Dark switch inside the client chooses the theme. There is no "System" option. The client remembers the choice.
- The terminal of hosted sessions stays dark in both themes.

## Summary

Add a light theme to every screen, dialog and state, taken from the Studio mock's "editorial-light" theme. Add a Light/Dark switch, and remember the choice.

## Requirements

### Functional

Light theme
- In the light theme, every screen, dialog and state must take the look of the mock's "editorial-light" theme.
- In the light theme, canvas, surfaces, borders and text colours must use the "editorial-light" values of the mock file.
- An element with no counterpart in "editorial-light" must be built from the theme's surfaces, borders and text colours.
- The accent must be light blue in the light theme too, where the mock uses its accent colours.
- The light theme must use Roboto Flex where the mock uses a serif font, and Roboto Mono where it uses JetBrains Mono.
- Native parts of the page, such as scrollbars and form controls, must render in the active theme.
- The terminal panel of hosted sessions must stay dark in the light theme, with its current look.
- The dark theme must look exactly as it does today.

Switch
- The client must show a Light/Dark switch in the top bar.
- The switch must show which theme is active and have an accessible name.
- Using the switch must change the theme of the whole client at once, without a reload.
- Changing the theme must not interrupt sessions, close dialogs, or lose the open session or the scroll position.
- The client must remember the chosen theme across reloads and restarts.
- On start, the client must show the remembered theme from the first frame, with no flash of the other theme.

### Non-functional

- Text in the light theme must meet WCAG 2.2 AA contrast. Where a mock value fails, the colour changes only as much as needed.
- In the light theme, accent text and text on accent-filled buttons must use a darker tone of the light blue when needed to reach 4.5:1.
- Status colours (working, needs input, error, waiting, ended) must stay distinguishable and readable on light surfaces.
- The switch must work with the keyboard, with a visible focus, like the other controls.

## Assumptions

- This is an evolution, not a fix. The light theme was removed on purpose, so it was a decision, not a defect. The orchestrator decided this.
- On first start, with no remembered choice, the client is dark. That is today's behaviour. The orchestrator decided this.
- The switch sits in the top bar, the only bar shown on every screen. The orchestrator decided this.
- The client remembers the choice where the user made it. The desktop window and a browser can each keep a different choice.
- The light theme keeps the layout, sizes and behaviour of the dark theme. Only colours, shadows and the fonts named above change.
- The tool output and code blocks of external sessions follow the active theme. Only the terminal panel of hosted sessions stays dark.

## Scope

In scope:
- The light theme for every screen, dialog and state.
- The Light/Dark switch in the top bar.
- Remembering the chosen theme.

Out of scope:
- A "System" option, or following the operating-system theme.
- The mock's "carbon-indigo" theme, or any theme other than light and dark.
- A light terminal panel.
- A settings screen, or a choice of accent colour.
- Any change to the dark theme, the layout or the behaviour.
- The native title bar and the tray icon of the desktop app.
