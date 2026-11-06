---
module: sessions
component: WebAddressLinks
type: frontend function
---

# WebAddressLinks

**Purpose** → makes the `http` and `https` addresses in the rows of a terminal links, with their exact range, on top of `@xterm/addon-web-links`.

## Contract

- `loadWebAddressLinks(terminal, activate) → disposable`
  - `terminal` → needs only `buffer` and `registerLinkProvider` of an xterm.js terminal.
  - effect: registers one link provider on the terminal. `dispose()` removes it.
  - for a buffer row (1-based) the provider gives one link per address that touches the row: `text` is the full address, `range` its cells (1-based, end included, possibly over several rows).
  - activating a link → `activate(event, address)` with the full address. The provider does not check modifier keys.

What is an address:
- it starts with `http://`, `https://`, `HTTP://` or `HTTPS://` and is a valid URL.
- it ends at the first whitespace, `"` or `'`.
- closing characters at the end are not part of it: `.`, `,`, `:`, `!`, `?`, `)`, `]`, `}`, `>` and similar.
  - e.g. `see https://example.com/a.` → `https://example.com/a`; `(https://a.io/b)` → `https://a.io/b`.

Rows joined into one address:
- a row that continues the previous one as a soft wrap of the terminal.
- a row that follows a row whose last column holds a visible character (Claude Code breaks long lines itself, with no soft wrap mark).
- e.g. 20 columns, row 1 `https://example.com/` (fills the row), row 2 `abcdef, done` → `https://example.com/abcdef`, from row 1 column 1 to row 2 column 6.
- the join stops at a row that contains a space, after that row; a continuation row that starts with a space is not joined.

## Dependencies

- `@xterm/addon-web-links` (address pattern, joining of the rows, mapping to cells)

## Requirements served

- `plan-terminal_addons/REQ-1`, `plan-terminal_addons/REQ-7`, `plan-terminal_addons/REQ-8`
