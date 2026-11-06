---
status: validated
---

# Batches — Links, search, zoom and file drop in the hosted terminal

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [clickable-links](batches/batch-clickable-links.md) | Clickable links | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | certified | The user opens a web address from the terminal with Ctrl+click |
| [search](batches/batch-search.md) | Search | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31 | clickable-links | todo | The user finds a word in the terminal scrollback |
| [font-zoom](batches/batch-font-zoom.md) | Font zoom | REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45 | clickable-links | todo | The user makes the terminal text larger |
| [file-drop](batches/batch-file-drop.md) | File drop | REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53, REQ-54 | clickable-links | todo | The user drops files on the terminal in the desktop app |

Execution order: clickable-links, search, font-zoom, file-drop. The last three depend only on `clickable-links`, for the e2e change below. They still run one after the other in this order, because all four change `src/web/sessions/SessionView.tsx`.

## Assumptions and decisions

- **One batch per feature.** The four features are independent for the user, so each one is a batch.
- **Enabling e2e change.** Another cycle runs its e2e in parallel on port 3100 and in `/tmp/ai-client-e2e-claude`. Batch `clickable-links` (INT-1, INT-2) reads both from `E2E_PORT` and `E2E_CLAUDE_DIR`, with today's defaults. This cycle runs its e2e with both set, for example `E2E_PORT=3200` and `E2E_CLAUDE_DIR=/tmp/ai-client-e2e-claude-terminal_addons`. It sits in the first batch, so the first e2e run already uses it.
- **Electron e2e group.** Desktop checks go only in `npm run test:e2e:desktop` (knowledge base `electron-e2e-separate`). The group stays small: one check each in `clickable-links`, `font-zoom` and `file-drop`, only for what Vitest and the browser e2e cannot prove. `search` does not touch the desktop app.
- **Test scope of a batch.** Gatekeeper guideline, not yet in this worktree's knowledge base. On a batch that is not the last, the tester runs only:
  - the batch's new tests;
  - the existing tests of the files the batch changed, and of their direct dependencies;
  - the existing e2e tests that exercise the change.
- **Desktop changes kept small.** `src/desktop/main.ts` gets two changes: the window open handler (`clickable-links`, INT-9) and the page zoom keys (`font-zoom`, INT-6). The preload gets one function (`file-drop`, INT-2).
- **New dependencies.** `@xterm/addon-web-links` and `@xterm/addon-search`, same major as `@xterm/xterm`. Both are MIT, like the xterm packages already in `.archi`.
- **Controls.** The "Search" button and the zoom controls go in the session subbar, before "Interrupt", through the `actions` of SessionHeader. SessionHeader does not change.
- **Gatekeeper decisions on the requirements.** These are recorded in `requirements.md`, "Assumptions": ended sessions, no drop state in the browser, position of the controls, and quoting.

## Departures

None.

## Coverage check

Every REQ is served by at least one INT. Every INT serves at least one REQ, except `clickable-links` INT-1 and INT-2: these are enabling, for the e2e of parallel cycles. Each REQ closes in one batch.

| REQ | Closes in | INT |
|-----|-----------|-----|
| REQ-1 | clickable-links | INT-3, INT-5, INT-6 |
| REQ-2 | clickable-links | INT-7 |
| REQ-3 | clickable-links | INT-6, INT-7 |
| REQ-4 | clickable-links | INT-8 |
| REQ-5 | clickable-links | INT-6, INT-7 |
| REQ-6 | clickable-links | INT-6, INT-7 |
| REQ-7 | clickable-links | INT-5 |
| REQ-8 | clickable-links | INT-5 |
| REQ-9 | clickable-links | INT-9 |
| REQ-10 | clickable-links | INT-4 |
| REQ-11 | clickable-links | INT-4, INT-9 |
| REQ-12 | clickable-links | INT-4, INT-7, INT-9 |
| REQ-13 | clickable-links | INT-6, INT-8 |
| REQ-14 | search | INT-5 |
| REQ-15 | search | INT-6 |
| REQ-16 | search | INT-5 |
| REQ-17 | search | INT-5 |
| REQ-18 | search | INT-5 |
| REQ-19 | search | INT-1, INT-7 |
| REQ-20 | search | INT-7 |
| REQ-21 | search | INT-7 |
| REQ-22 | search | INT-3, INT-7 |
| REQ-23 | search | INT-7 |
| REQ-24 | search | INT-4, INT-7 |
| REQ-25 | search | INT-2, INT-4, INT-7 |
| REQ-26 | search | INT-4, INT-7 |
| REQ-27 | search | INT-4, INT-8 |
| REQ-28 | search | INT-4, INT-8 |
| REQ-29 | search | INT-8 |
| REQ-30 | search | INT-4 |
| REQ-31 | search | INT-3 |
| REQ-32 | font-zoom | INT-4 |
| REQ-33 | font-zoom | INT-4 |
| REQ-34 | font-zoom | INT-4 |
| REQ-35 | font-zoom | INT-2, INT-3, INT-5 |
| REQ-36 | font-zoom | INT-4 |
| REQ-37 | font-zoom | INT-4 |
| REQ-38 | font-zoom | INT-4 |
| REQ-39 | font-zoom | INT-4, INT-6 |
| REQ-40 | font-zoom | INT-1 |
| REQ-41 | font-zoom | INT-3 |
| REQ-42 | font-zoom | INT-5 |
| REQ-43 | font-zoom | INT-1, INT-5 |
| REQ-44 | font-zoom | INT-1 |
| REQ-45 | font-zoom | INT-3 |
| REQ-46 | file-drop | INT-2, INT-3, INT-5 |
| REQ-47 | file-drop | INT-5 |
| REQ-48 | file-drop | INT-1, INT-5 |
| REQ-49 | file-drop | INT-1 |
| REQ-50 | file-drop | INT-5 |
| REQ-51 | file-drop | INT-5 |
| REQ-52 | file-drop | INT-6 |
| REQ-53 | file-drop | INT-4 |
| REQ-54 | file-drop | INT-7 |

INT ids are local to their batch: INT-1 to INT-9 in `batch-clickable-links`, INT-1 to INT-8 in `batch-search`, INT-1 to INT-6 in `batch-font-zoom`, INT-1 to INT-7 in `batch-file-drop`.
