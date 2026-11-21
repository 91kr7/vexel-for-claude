---
module: app
component: ListStyles
type: configuration
---

# ListStyles

**Purpose** → shared CSS classes that give every list outside the session list the look of the session cards (SessionList, module sessions).

## Contract

- `.list-card` → an entry of a card list: 1 px `--role-border-subtle` border, `--radius-card` corners, `--role-card` surface.
- `.list-row` → a row of a dense list: same corners, transparent border and surface at rest. It keeps the height and padding of its own list.
- hover on `.list-card` or `.list-row` → `--role-hover` surface, `--role-border-strong` border, `--text-primary` text. Not on an active entry, nor on an entry with the class `unavailable`.
- `.list-active` with `.list-card` or `.list-row` → the open session card: `--role-card-active` surface, `--role-accent` border, a 3.5 px `--role-accent` bar on the left edge (border plus a 2.5 px inner bar), `--shadow-card-active`, `--text-primary` text. Hover changes nothing.
- keyboard focus on a `.list-card` or `.list-row` → the focus ring is drawn inside its edge, so a clipping or scrolling list never cuts it.
- `.list-scroll` → a list scroll area. It reaches `--list-scroll-reach` to the right of its own box, into the frame's right padding. A shown scrollbar sits at that right edge, and the gap between the right edge of the entries and the scrollbar is `--list-scroll-gap`, the left gap of the entries.
  - with no scrollbar, the entries end `--list-scroll-gap` minus `--list-scroll-reach` before the box edge.
  - the list panel of AppLayout → gap 10 px, reach 6 px. The scrollbar stays clear of the 4 px of the resize handle (ListPanelEdge) inside the panel; the cards are 4 px narrower than the title row.
  - the Dialog body → gap 16 px, reach 16 px: the scrollbar touches the dialog edge, the rows keep their width.
  - the header of the git explorer with several repositories → gap 16 px, reach 8 px: the scrollbar stays 2 px clear of the refresh button column.
  - elsewhere both are 0, so the class changes nothing.
- `.list-number` → mono font (`--font-mono`) with tabular figures.
- Windows 11 look → `.list-card` and `.list-row` take `--radius-control` (4 px), as the other list rows of that look (Windows11Look).

## Rules and invariants

- The values are tokens of ThemeTokens, so the classes follow the theme and the look.

## Dependencies

- ThemeTokens, Windows11Look, ListPanelEdge

## Requirements served

- `plan-dark_blue_theme/REQ-44`, `plan-dark_blue_theme/REQ-45`, `plan-dark_blue_theme/REQ-46`, `plan-dark_blue_theme/REQ-47`, `plan-dark_blue_theme/REQ-48`, `plan-dark_blue_theme/REQ-49`
- `plan-dark_blue_theme/REQ-4`
