---
status: validated
---

# Batches — Git explorer on open-source components, with a graph history

Requirements: `requirements.md`. Batch files: `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| `batch-open-source-explorer` | Open-source explorer | REQ-1, REQ-2 | — | certified | The user sees the uncommitted changes and their diff on the new components |
| `batch-graph-history` | Graph history | REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19 | `batch-open-source-explorer` | todo | The user reads the history of a branch with a merge as a graph |

Order: `batch-open-source-explorer` → `batch-graph-history`. The second batch reuses the list component, the licence texts and the licence notices of the first.

## Assumptions and decisions

- **What moves to open-source components.** The diff view, the file list of the Changes tab, the file list of a commit and the history move. The panel frame, its header and its tabs stay app components, as every other panel of the client. They take the theme from the app. The file list of a commit moves although no REQ names it, because the human decided that the whole explorer moves (spec, "Reference"; gatekeeper decision).
- **REQs of the whole explorer close in the second batch.** REQ-3, REQ-4, REQ-5, REQ-6 and REQ-7 cover every new component. The graph component arrives only in `batch-graph-history`, so they close there.
- **No server change for the diff.** The server keeps the output of `parseDiff`. The frontend adapts it to the diff component, if needed.
- **Licence notices in the builds (REQ-7).** The web build carries the notices of the bundled packages. The desktop window loads the page from the same web build, so the notices reach the desktop app too. `THIRD-PARTY-NOTICES.md` names each component and its licence text in the repository.
- **Tip of the graph (REQ-12).** All the commits are ancestors of HEAD and the order is `--date-order`, so the first commit of the history is the tip.
- **Long history (REQ-18).** The pages of 100 commits and "Load more" stay, as in `plan-git_explorer`.
- **Choice of the packages.** The implementer chooses them with the rules in the batch files. The spec leaves this choice to the later phases.
- **Electron e2e.** The desktop window test stays in the Electron group (knowledge base `electron-e2e-separate`). Only `batch-graph-history` touches it.
- **Components touched by both batches.** `THIRD-PARTY-NOTICES.md` and `package.json` change in both batches. `batch-graph-history` cites the licence texts of `batch-open-source-explorer/INT-7`. Their path is the one the implementer of that batch records.

## Departures

None.

## Coverage check

REQ → INT. Each REQ closes in the batch of the table above. `open` = `batch-open-source-explorer`, `graph` = `batch-graph-history`.

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | `open` INT-1, INT-2, INT-3 | `batch-open-source-explorer` |
| REQ-2 | `open` INT-2, INT-3, INT-4, INT-5, INT-6 | `batch-open-source-explorer` |
| REQ-3 | `open` INT-3, INT-5, INT-6; `graph` INT-4, INT-10 | `batch-graph-history` |
| REQ-4 | `open` INT-2, INT-3, INT-6; `graph` INT-4, INT-10 | `batch-graph-history` |
| REQ-5 | `graph` INT-11 | `batch-graph-history` |
| REQ-6 | `open` INT-1; `graph` INT-3 | `batch-graph-history` |
| REQ-7 | `open` INT-7, INT-8, INT-9; `graph` INT-12, INT-13 | `batch-graph-history` |
| REQ-8 | `graph` INT-2, INT-3, INT-4, INT-10 | `batch-graph-history` |
| REQ-9 | `graph` INT-1, INT-2, INT-5, INT-10 | `batch-graph-history` |
| REQ-10 | `graph` INT-1, INT-5, INT-9, INT-10 | `batch-graph-history` |
| REQ-11 | `graph` INT-5, INT-9 | `batch-graph-history` |
| REQ-12 | `graph` INT-6, INT-7, INT-9, INT-10 | `batch-graph-history` |
| REQ-13 | `graph` INT-4 | `batch-graph-history` |
| REQ-14 | `graph` INT-8, INT-10 | `batch-graph-history` |
| REQ-15 | `graph` INT-8, INT-10 | `batch-graph-history` |
| REQ-16 | `graph` INT-8, INT-10 | `batch-graph-history` |
| REQ-17 | `graph` INT-2, INT-4, INT-10 | `batch-graph-history` |
| REQ-18 | `graph` INT-4 | `batch-graph-history` |
| REQ-19 | `graph` INT-5, INT-9 | `batch-graph-history` |

INT → REQ: every INT of the two batches serves at least one REQ. There is no enabling INT.
