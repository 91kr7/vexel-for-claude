---
request_slug: cool_slate_light
date: 2026-11-20
type: evolution
size: ordinary
reference: .sdd/analysis/light_theme.md
---

# Analysis — Light theme recoloured as "Cool Slate · Full Light"

## Request

> adeguare il tema a questo mock file:///home/christian.mariani/Downloads/vexel_for_claude_anteprima_tema_chiaro.html Cool Slate · Full Light devi adeguare i colori e non toccare/aggiungere/rimuovere elementi grafici! il mock copre solo la prima pagina ma ovviamente devi adegure tutto!!!

## Reference

- Mock kept at `.sdd/mockups/cool_slate_light/mock.html` (copy of the file in the request).
- [light_theme.md](light_theme.md) → the client has a Light theme. Its terminal of hosted sessions stays dark (line 39).
- [dark_blue_theme.md](dark_blue_theme.md) → it set the layout and shapes of all themes. It kept the dark terminal in Light (line 99).
- [popup_glass.md](popup_glass.md) → floating surfaces are 60% opaque with an 8px blur.

The mock holds four presets. The human chose "Cool Slate · Full Light". Its preset "Attuale (Prima)" reproduces today's Light theme, so the mock is a before/after of the Light theme.

Changes:
- The Light theme takes the colours of "Cool Slate · Full Light" on every screen.
- In the Light theme, the terminal of hosted sessions becomes light, as in "Full Light". This replaces line 39 of [light_theme.md](light_theme.md).
- Only colours change. No element is added, removed or reshaped.

## Summary

Replace every colour of the Light theme with the "Cool Slate · Full Light" palette of the mock, on all screens, dialogs and states, including a light terminal. Layout, elements and the other themes stay as they are.

## Requirements

### Functional

Palette
- In the Light theme, each element must take the mock colour of its role, from this table:

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

- A colour must change only where the element already has that property. A border or shadow that does not exist today must not appear.
- An element not shown in the mock must take the colour of the nearest role in the table.
- Native parts of the page, such as scrollbars and form controls, must use the palette.

Terminal
- In the Light theme, the terminal of hosted sessions must be light, with these colours:

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

- The terminal colours the mock does not give (red, magenta, cyan, black, white, bright variants, selection) must come from the same slate family and be readable on white.
- The tool output and code blocks of external sessions must use the same light palette.

Coverage
- Every screen, dialog, popover, menu, tooltip, toast and state of the client must use the new palette in the Light theme. This includes screens the mock does not show.
- The palette must apply in the browser and in the desktop app.

### Non-functional

- Text in the Light theme must meet WCAG 2.2 AA contrast. Where a mock value fails, the colour changes only as much as needed.
- Status colours (working, needs input, error, waiting, ended) must stay distinguishable on light surfaces.
- Every control must keep a visible keyboard focus.

## Assumptions

- This is an evolution, not a fix. The human replaces a working palette by choice, and reverses the dark-terminal decision.
- The table gives solid colours. Today's opacity and blur rules stay, including the 60% popups of [popup_glass.md](popup_glass.md). The mock's 85-92% alphas and its 20px blur are not adopted.
- The theme keeps the name "Light". Dark stays the default on first start.
- Fonts do not change. Roboto Flex and Roboto Mono stay, not the mock's Inter and JetBrains Mono.
- The window buttons keep their current colours, as [dark_blue_theme.md](dark_blue_theme.md) decided.
- Needs input maps to warning and error maps to danger. Waiting and ended map to the idle slate.
- The mock's sizes, spacing and radii are not adopted. They already come from [dark_blue_theme.md](dark_blue_theme.md).
- The mock's preset switcher, wallpaper, frosted toggle and sample texts are preview artefacts, not part of the client.

## Risks

- Claude Code draws some output with its own fixed colours. On a light terminal, some of that output can lose contrast.
- Unit and e2e tests that check Light theme colours, or the dark terminal in Light, will need updates.

## Scope

In scope:
- All colours of the Light theme, on every screen and state, in the browser and the desktop app.
- The light terminal palette in the Light theme.
- Updating the tests these changes affect.

Out of scope:
- The Dark and Dark Blue themes.
- Any element added, removed, moved or resized. This includes mock elements the client lacks, such as the font-size stepper.
- Fonts, opacity levels, blur, animations.
- The other mock presets ("Cool Slate · Hybrid", "Warm Paper · Light").
- Changing the Claude Code theme setting of hosted sessions.
