---
status: validated
---

# Batches — Resizable session list, and a lighter session header

Requirements → `requirements.md`. Batch files → `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| list-width | Resizable list panel | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14 | — | certified | The user makes the list wider and finds the same width after a reload |
| header-footer | Lighter header and footer bar | REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-41 | — | implemented | The user reads the session details in the footer of a hosted session |

Execution order: list-width, then header-footer. The two batches do not depend on each other. Both may touch `src/web/styles.css`, so they run in this order.

Fix of 2026-11-07: header-footer reopens for REQ-30 to REQ-36 and REQ-41 (INT-7 to INT-11). It runs alone, because list-width is certified. Then the closing run of the plan checks REQ-37 to REQ-40 and REQ-42.

## Assumptions and decisions

- **Placement of the new components.** The list width store and the list panel edge go in module app, beside AppLayout, which owns the list panel. The footer bar goes in module sessions, beside SessionHeader, because SessionView and ConversationView both use it, as they use the header.
- **Terminal refit (REQ-11).** SessionView already refits with a `ResizeObserver` on its panel. The list-width batch does not change it.
- **Refits during a drag.** Each width change during a drag refits the terminal, as a window resize does today. The spec accepts the risk of a short flicker ("Risks").
- **No jump on start (REQ-9).** The store reads `localStorage` synchronously, before the first render. The page shows no list panel before React renders, so it needs no mark in `index.html`, unlike the theme.
- **Tests of the app restart (REQ-8).** In the Electron e2e group only (knowledge base `electron-e2e-separate`).

Fix of 2026-11-07. Gatekeeper decisions, not human decisions.

- **Pause icon (REQ-32).** `CirclePauseIcon`, already in IconSet with no user. No new icon file.
- **Test suite REQs (REQ-37 to REQ-42).** They close with no INT, a declared exception (see "Coverage check"). No INT edits unrelated tests or product code ahead of time. The closing Test phase finds the failures and sorts them by REQ-38. REQ-41 closes in header-footer, because its tester rewrites the header tests.

## Departures

- **"Search" in the header and the text size controls in the footer (REQ-15, REQ-29).** This departs from the spec. It is a human decision: see `requirements.md`, assumption "Search and text size controls". The spec must be corrected: line 54 of `.sdd/analysis/session_list_width.md` must add "Search" to the hosted header, and the "Footer bar" section must add the text size controls.
- **No key hint in the footer (REQ-22, withdrawn).** This departs from the spec. It is a human decision: see `requirements.md`, assumption "Key hint". The spec must be corrected: in `.sdd/analysis/session_list_width.md`, remove the key hint from "Changes" (line 27) and from the "Footer bar" requirements (line 63).

The spec now carries both corrections (version of 2026-11-07). The fix of 2026-11-07 adds no departure.

## Coverage check

Every REQ → at least one INT, except REQ-37 to REQ-42 (exception below). Every REQ closes in the batch that serves it. No REQ spans two batches. REQ-22 is withdrawn, so no INT serves it.

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
| REQ-23 | header-footer | INT-2 |
| REQ-24 | header-footer | INT-2 |
| REQ-25 | header-footer | INT-1 |
| REQ-26 | header-footer | INT-2 |
| REQ-27 | header-footer | INT-2 |
| REQ-28 | header-footer | INT-1, INT-5 |
| REQ-29 | header-footer | INT-1, INT-5 |
| REQ-30 | header-footer | INT-7, INT-8 |
| REQ-31 | header-footer | INT-7, INT-8 |
| REQ-32 | header-footer | INT-10, INT-11 |
| REQ-33 | header-footer | INT-11 |
| REQ-34 | header-footer | INT-9, INT-10 |
| REQ-35 | header-footer | INT-9, INT-10 |
| REQ-36 | header-footer | INT-10 |
| REQ-37 | closing run | none (exception) |
| REQ-38 | closing run | none (exception) |
| REQ-39 | closing run | none (exception) |
| REQ-40 | closing run | none (exception) |
| REQ-41 | header-footer | none (exception) |
| REQ-42 | closing run | none (exception) |

Every INT serves at least one REQ. There is no enabling intervention.

Exception: REQ-37 to REQ-42 are about the test suite, not the product, so no INT serves them. REQ-41 closes in header-footer. The others close in the closing run of the plan, which belongs to no batch. See assumption "Test suite REQs".
