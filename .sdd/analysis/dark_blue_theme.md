---
request_slug: dark_blue_theme
date: 2026-11-16
type: evolution
size: ordinary
reference: .sdd/analysis/light_theme.md
---

# Analysis — Mock layout in every theme, and a new "Dark Blue" theme

## Request

> allinea globalmente la grafica a questo mock e crea un nuovo tema "blue scuro" come da mock file:///home/christian.mariani/Downloads/vexel_ui_redesign_preview.html

## Reference

The mock is at `.sdd/mockups/dark_blue_theme/mock.html`.

- [light_theme.md](light_theme.md) → the client has a Light and a Dark theme. The terminal of hosted sessions stays dark in both of them.
- [settings_dialog.md](settings_dialog.md) → the user chooses the theme in the settings popup. A shortcut switches the theme.
- [ui_restyle.md](ui_restyle.md) → it set the top bar height, the window buttons and the terminal margin. These are the values on 2026-11-14.

Changes (human decisions of 2026-11-16):
- The mock's layout and shapes apply to all themes: Light, Dark and Dark Blue. This covers the title bar, the rail, the session cards, the session header, the framed terminal, the status bar and the sizes.
- Only the new theme uses the mock's colours.
- Only elements that exist today get the new style. The client gets no new functions.
- The fonts do not change. Roboto Flex and Roboto Mono stay in every theme.
- The window buttons keep the colours and style of [ui_restyle.md](ui_restyle.md) in every theme.

## Summary

Give every screen of the client the layout and shapes of the mock, in all three themes. Add a third theme, "Dark Blue", with the mock's colours.

## Requirements

### Functional

Layout and shapes (all themes)
- Each existing element shown in the mock must take the mock's size, spacing, corner radius, border and shadow. The theme's own colours apply.
- The window title bar must be 38px high. It must show the app identity on the left and its existing controls on the right.
- The navigation rail must be 52px wide. Its buttons must be 32px squares with 8px corners. The settings button stays at the bottom.
- The "+" button of the rail must be a square tinted with the accent colour, with an accent border.
- The active rail item must show a 3px accent bar on its left edge, with a soft glow.
- The default width of the session list must be 260px.
- Each session entry must be a card with 7px corners and a 1px border.
- The active card must have an accent border and a 3.5px accent bar on its left edge. It must also have a slightly lighter surface and a soft shadow.
- An inactive card must change its surface and border on hover.
- A card must keep the layout of the mock. The status dot, name, star and status label go on the first line. The last prompt goes on the second line. The metrics go on a third line with a top border.
- The status dot of a working session must pulse softly.
- The session header must be 44px high. It must show the session name and the last-prompt summary in a monospace pill that is cut with an ellipsis.
- The terminal must sit inside a frame with a 12px gap around it. The frame has a 1px border, 8px corners and a shadow.
- The terminal frame must show an accent border and ring while the terminal has focus. The ring must not overlap any other element.
- The bar at the bottom must be 32px high. Each value it shows must sit in a pill with 5px corners and a 1px border.
- If the bottom bar shows the context usage, its pill must fill in proportion to the percentage.
- Numbers in cards and in the bottom bar must use the monospace font with tabular figures.
- The short-message toast must take the mock's shape: bottom right, 8px corners, a border and an accent dot.
- Screens and dialogs that are not in the mock must use the same radii, borders, pills and surface levels.

Dark Blue theme
- The client must offer a third theme, "Dark Blue", next to Light and Dark.
- Dark Blue must use the mock's colours:

  | Use | Colour |
  |-----|--------|
  | canvas and rail | `#12151E` |
  | title bar, session header, bottom bar | `#181C27` |
  | session list | `#161A24` |
  | card | `#1B202C` |
  | active card | `#212736` |
  | raised surface and pill | `#1D2230` |
  | terminal | `#11141C` |
  | subtle border | `#2E3546` |
  | strong border | `#384156` |
  | accent | `#38BDF8` |
  | main text | `#F1F5F9` |

- In Dark Blue, the text and status colours (working, needs input, error, ended) must follow the mock: slate text, emerald, amber and rose.
- In Dark Blue, the terminal must take the mock's background, frame and focus ring.
- Native parts of the page in Dark Blue, such as scrollbars and form controls, must match the mock. The scrollbar thumbs are rounded and use `#2E3546`.

Choice of theme
- Settings > Appearance must offer Light, Dark and Dark Blue. It must show the active choice.
- Choosing Dark Blue must behave like the other themes. It applies at once, the client remembers it, and the next start shows no flash of another theme. See [light_theme.md](light_theme.md), lines 45-48.

### Non-functional

- In Dark Blue, text must meet WCAG 2.2 AA contrast. Where a mock value fails, the colour changes only as much as needed.
- The pulse of the status dot must not play when the system asks for reduced motion.
- Every control must keep a visible keyboard focus in all three themes.

## Assumptions

The gatekeeper decided these, not the human.

- This is an evolution, not a fix. It adds a theme and changes the look on purpose. It corrects no earlier requirement.
- The theme is labelled "Dark Blue", because the UI is in English. Dark stays the default on first start.
- The theme shortcut cycles Light → Dark → Dark Blue.
- In Dark Blue, the ANSI colours of Claude Code output stay as they are today.
- The Light theme keeps its dark terminal, as [light_theme.md](light_theme.md) requires.

The analyst decided these.

- In Light and Dark, each surface level of the mock maps to the matching level of the theme. The same applies to borders and to the accent.
- A width the user set for the session list stays. Only the default changes to 260px.
- The 12px gap around the terminal replaces the 16px margin of [ui_restyle.md](ui_restyle.md), because the human applied the mock's sizes.
- The mock's texts, version number and sample data are illustrations. The client keeps its own English texts and its real data.

## Risks

- The new heights, widths and margins affect every screen at once. Unit and e2e tests that check sizes or layout will need updates.
- A 38px title bar leaves less height for the window buttons and the drag area of the desktop app.
- Light and Dark have no mock of their own. So the accent bar and the frame shadows may look weaker or heavier there than in the mock.

## Scope

In scope:
- The mock's layout and shapes for every existing element, in Light, Dark and Dark Blue, in the browser and in the desktop app.
- The Dark Blue theme, and its choice in Settings > Appearance and in the theme shortcut.
- Updating the tests that these changes affect.

Out of scope:
- Mock elements with no counterpart in the client today. Examples are Interrupt and Terminate buttons, branch and search icons in the header, an Idle/Running pill, a "Running N" counter, a separate prompt box with an auto-mode badge, and bottom-bar values the client does not have.
- Any change of font, including Inter and JetBrains Mono.
- Any change to the window buttons.
- The ANSI palette of the terminal, and a light terminal.
- A "System" theme, or following the operating-system theme.
