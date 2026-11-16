---
slug: dark_blue_theme
date: 2026-11-16
spec: .sdd/analysis/dark_blue_theme.md
status: validated
---

# Requirements — dark_blue_theme

The mock is `.sdd/mockups/dark_blue_theme/mock.html`. "The mock's look" below means its sizes,
spacing, corner radii, borders and shadows, unless a requirement says colours.

## Feature 1 — Shared shapes (all themes)

| ID | Requirement |
|----|-------------|
| REQ-1 | Every existing element shown in the mock takes the mock's size, spacing, corner radius, border and shadow, in every theme. |
| REQ-2 | In Light and Dark, each surface level, border and accent of the mock maps to the matching level of the theme's own colours. |
| REQ-3 | Screens and dialogs that are not in the mock use the same corner radii, borders, pills and surface levels as the mock's elements. |
| REQ-4 | In Light and Dark, every control keeps a visible keyboard focus. |
| REQ-5 | Roboto Flex and Roboto Mono stay the fonts of the client in every theme. |

## Feature 2 — Window frame: title bar, rail, bottom bar, toast

| ID | Requirement |
|----|-------------|
| REQ-6 | The window title bar is 38px high, with the app identity on the left and its existing controls on the right. |
| REQ-7 | The window buttons keep their current colours and style in every theme. |
| REQ-8 | In the desktop app, the window buttons work and the window can be dragged by the 38px title bar. |
| REQ-9 | The navigation rail is 52px wide, its buttons are 32px squares with 8px corners, and the settings button stays at the bottom. |
| REQ-10 | The "+" button of the rail is a square tinted with the accent colour, with an accent border. |
| REQ-11 | The active rail item shows a 3px accent bar on its left edge, with a soft glow. |
| REQ-12 | The bottom bar is 32px high, and each value it shows sits in a pill with 5px corners and a 1px border. |
| REQ-13 | When the bottom bar shows the context usage, its pill fills in proportion to the percentage. |
| REQ-14 | Numbers in the bottom bar use the monospace font with tabular figures. |
| REQ-15 | The short-message toast appears at the bottom right, with 8px corners, a border and an accent dot. |

## Feature 3 — Session cards

| ID | Requirement |
|----|-------------|
| REQ-16 | The default width of the session list is 260px. |
| REQ-17 | A session list width that the user has set stays as it is. |
| REQ-18 | Each session entry is a card with 7px corners and a 1px border. |
| REQ-19 | The active card has an accent border, a 3.5px accent bar on its left edge, a slightly lighter surface and a soft shadow. |
| REQ-20 | An inactive card changes its surface and border on hover. |
| REQ-21 | A card shows the status dot, name, star and status label on line one, the last prompt on line two, and the metrics on line three with a top border. |
| REQ-22 | Numbers in the cards use the monospace font with tabular figures. |
| REQ-23 | The status dot of a working session pulses softly. |
| REQ-24 | The status dot does not pulse when the system asks for reduced motion. |
| REQ-43 | An external session card has the same solid 1px border as every other card, with no dashed border (human decision, 2026-11-16). |

## Feature 4 — Session view: header and terminal frame

| ID | Requirement |
|----|-------------|
| REQ-25 | The session header is 44px high and shows the session name and the last-prompt summary in a monospace pill cut with an ellipsis. |
| REQ-26 | The terminal sits inside a frame with a 12px gap around it, a 1px border, 8px corners and a shadow. |
| REQ-27 | The terminal frame shows an accent border and an accent ring while the terminal has focus. |
| REQ-28 | The focus ring of the terminal frame does not overlap any other element. |
| REQ-29 | In the Light theme, the terminal inside the frame stays dark. |

## Feature 5 — Dark Blue theme

| ID | Requirement |
|----|-------------|
| REQ-30 | Settings > Appearance offers Light, Dark and Dark Blue, and shows the active choice. |
| REQ-31 | Choosing Dark Blue changes the whole client at once, without a reload, and does not interrupt sessions, close dialogs, or lose the open session or the scroll position. |
| REQ-32 | The client remembers the chosen theme, Light, Dark or Dark Blue, across reloads and restarts, in the browser and in the desktop app; a saved theme always wins over the first-start theme of REQ-35. |
| REQ-33 | When Dark Blue is remembered, the client shows it from the first frame of the start, with no flash of another theme. |
| REQ-34 | The theme shortcut cycles Light, Dark, Dark Blue, then Light again. |
| REQ-35 | Dark Blue is the theme of the first start, when no theme is saved. |
| REQ-36 | Dark Blue uses the colours of the table below. |
| REQ-37 | In Dark Blue, the text uses the mock's slate tones, and the status colours follow the mock: emerald for working, amber for needs input, rose for error, and the mock's tone for ended. |
| REQ-38 | In Dark Blue, the terminal takes the mock's background, frame and focus ring. |
| REQ-39 | In Dark Blue, the ANSI colours of Claude Code output stay as they are today. |
| REQ-40 | In Dark Blue, native parts of the page such as scrollbars and form controls match the mock, with rounded scrollbar thumbs in `#2E3546`. |
| REQ-41 | In Dark Blue, text meets WCAG 2.2 AA contrast; where a mock value fails, the colour changes only as much as needed. |
| REQ-42 | In Dark Blue, every control keeps a visible keyboard focus. |

## Feature 6 — Lists aligned to the session cards

Human decision, 2026-11-16: the mock shows only the first page, so every other list of the client
takes the look of the session cards.

| ID | Requirement |
|----|-------------|
| REQ-44 | In every list of selectable entries outside the session list, each entry is a card with the corners, border and surface of a session card. |
| REQ-45 | The active or selected entry of such a list has the look of the active session card. |
| REQ-46 | A hovered entry of such a list changes its surface and border as an inactive session card does. |
| REQ-47 | Dense technical lists, such as changed files, commit rows and shortcut rows, take the surfaces, borders, corners, hover and selected style of the session cards, without becoming cards. |
| REQ-48 | Numbers in every list use the monospace font with tabular figures. |

## Feature 7 — List spacing and card metrics

Human decision, 2026-11-16.

| ID | Requirement |
|----|-------------|
| REQ-49 | In every list of cards or rows, the session list included, a shown scrollbar leaves a gap to the right edge of the entries equal to the gap on their left. |
| REQ-50 | In a session card, the context percentage and the cost on line 3 use a smaller text than today. |
| REQ-51 | Withdrawn by human decision (2026-11-16): line 3 keeps its current position. |

Colours of REQ-36:

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
