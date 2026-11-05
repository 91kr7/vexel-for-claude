# Mockup — Vexel for Claude, Material 3

Source: `Vexel for Claude — Material 3 mockups.html`, provided by the human on 2026-11-05.
The original file is a self-unpacking bundle. Only the boards titled "Proposta — *" are the target.
The board "Oggi — screenshot dell'app" shows the current app and is not a target.

| Board | File |
|-------|------|
| Proposta — Sessione ospitata | `proposta-sessione-ospitata.html` |
| Proposta — Sessione esterna (sola lettura) | `proposta-sessione-esterna.html` |
| Proposta — Dialoghi | `proposta-dialoghi.html` |
| Proposta — Voci dell'elenco, chiaro e scuro | `proposta-voci-elenco.html` |

## How to read the files

- Each file is the readable source of one board, 1440 px wide. Layout, sizes, radii, spacing,
  typography and icons are in inline styles and in the `<style>` block inside `<helmet>`.
- `{{themeClass}}` is `dark` for the dark theme and empty for the light one. The `.m3` and
  `.m3.dark` rules hold the colour tokens of both themes.
- `{{...}}` placeholders and `sc-camel-view-box` come from the mockup tool: read them as the data
  they stand for and as `viewBox`.
- `@font-face` URLs point to bundle ids. The latin subsets are here:
  `roboto-flex-latin.woff2` (Roboto Flex, weight 400–800, width 25–151) and
  `roboto-mono-latin.woff2` (Roboto Mono, 400 and 500). Both fonts are under the SIL Open Font
  License 1.1.

## Human constraint on colour

The human asked for "colori più maschili: o blu chiaro o grigio". The violet primary of the mockup
(`#5847B8` and its tonal family) is replaced by a light-blue / grey palette. Everything else
follows the mockup exactly.
