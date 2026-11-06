---
status: validated
---

# Batches — Resizable session list, and a lighter session header

Requirements → `requirements.md`. Batch files → `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| list-width | Resizable list panel | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14 | — | implemented | The user makes the list wider and finds the same width after a reload |
| header-footer | Lighter header and footer bar | REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29 | — | todo | The user reads the session details in the footer of a hosted session |

Execution order: list-width, then header-footer. The two batches do not depend on each other. Both may touch `src/web/styles.css`, so they run in this order.

## Assumptions and decisions

- **Placement of the new components.** The list width store and the list panel edge go in module app, beside AppLayout, which owns the list panel. The footer bar goes in module sessions, beside SessionHeader, because SessionView and ConversationView both use it, as they use the header.
- **Terminal refit (REQ-11).** SessionView already refits with a `ResizeObserver` on its panel. The list-width batch does not change it.
- **Refits during a drag.** Each width change during a drag refits the terminal, as a window resize does today. The spec accepts the risk of a short flicker ("Risks").
- **No jump on start (REQ-9).** The store reads `localStorage` synchronously, before the first render. The page shows no list panel before React renders, so it needs no mark in `index.html`, unlike the theme.
- **Tests of the app restart (REQ-8).** In the Electron e2e group only (knowledge base `electron-e2e-separate`).

## Departures

- **"Search" in the header and the text size controls in the footer (REQ-15, REQ-29).** This departs from the spec. It is a human decision: see `requirements.md`, assumption "Search and text size controls". The spec must be corrected: line 54 of `.sdd/analysis/session_list_width.md` must add "Search" to the hosted header, and the "Footer bar" section must add the text size controls.

## Coverage check

Every REQ → at least one INT. Every REQ closes in the batch that serves it. No REQ spans two batches.

| REQ | Batch | INT |
|-----|-------|-----|
| REQ-1 | list-width | INT-2 |
| REQ-2 | list-width | INT-2, INT-3 |
| REQ-3 | list-width | INT-1, INT-4 |
| REQ-4 | list-width | INT-4 |
| REQ-5 | list-width | INT-4 |
| REQ-6 | list-width | INT-1, INT-4 |
| REQ-7 | list-width | INT-1 |
| REQ-8 | list-width | INT-1 |
| REQ-9 | list-width | INT-1, INT-4 |
| REQ-10 | list-width | INT-5 |
| REQ-11 | list-width | INT-4 |
| REQ-12 | list-width | INT-3 |
| REQ-13 | list-width | INT-3 |
| REQ-14 | list-width | INT-2 |
| REQ-15 | header-footer | INT-3, INT-5 |
| REQ-16 | header-footer | INT-3, INT-6 |
| REQ-17 | header-footer | INT-3 |
| REQ-18 | header-footer | INT-4 |
| REQ-19 | header-footer | INT-1, INT-5, INT-6 |
| REQ-20 | header-footer | INT-2, INT-5, INT-6 |
| REQ-21 | header-footer | INT-1, INT-6 |
| REQ-22 | header-footer | INT-1, INT-5 |
| REQ-23 | header-footer | INT-2 |
| REQ-24 | header-footer | INT-2 |
| REQ-25 | header-footer | INT-1 |
| REQ-26 | header-footer | INT-2 |
| REQ-27 | header-footer | INT-2 |
| REQ-28 | header-footer | INT-1, INT-5 |
| REQ-29 | header-footer | INT-1, INT-5 |

Every INT serves at least one REQ. There is no enabling intervention.
