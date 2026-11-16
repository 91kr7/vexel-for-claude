---
status: validated
---

# Batches — Git explorer for workspaces with several git repositories

Requirements: `requirements.md`. Batch files: `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| `batch-repo-detection` | Repository detection | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | certified | The user sees every repository of a workspace folder |
| `batch-grouped-changes` | Grouped changes | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 | `batch-repo-detection` | certified | The user reads the changes of every repository, grouped |
| `batch-combined-history` | Combined history | REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27 | `batch-grouped-changes` | certified | The user reads the history of every repository in one graph |
| `batch-repo-filter` | Repository filter | REQ-28, REQ-29, REQ-30, REQ-31 | `batch-combined-history` | todo | The user filters the git explorer by one repository |

Order: `batch-repo-detection` → `batch-grouped-changes` → `batch-combined-history` → `batch-repo-filter`. Each batch changes `GitExplorerPanel.tsx`, so they run one after the other. `batch-combined-history` also checks that a repository has one colour in the header, the Changes tab and the History tab (REQ-23), so it needs the grouped changes.

## Assumptions and decisions

- **One route for detection.** `GET /api/git/repository` keeps its path and answers the covered list in place of one repository. Its two callers, `SessionView.tsx` and `ConversationView.tsx`, read the new state (`batch-repo-detection/INT-7`, `INT-8`).
- **No cache of detection (REQ-10).** Each lookup runs detection again. A lookup runs on page open, on "Refresh" and on a turn end, as today. There is no periodic read.
- **Interim tabs.** After `batch-repo-detection`, the two tabs read the first repository of the list (`batch-repo-detection/INT-12`). `batch-grouped-changes` and `batch-combined-history` replace this.
- **Changes and history stay per repository on the server.** The existing routes take the root of one repository. The frontend makes one request per root and builds the combined view.
- **Submodule test (REQ-4).** A candidate is a submodule when the repository around it tracks its path as a gitlink (`ls-files --stage`, mode `160000`). This is what "registers as a submodule" means in `requirements.md`. No new git command joins the list of GitRunner.
- **Colours (REQ-7, REQ-23).** The palette is the set of theme tokens of the frontend, so both themes are covered. The filter does not change the colour of a repository (`batch-repo-filter/INT-3`).
- **Filter shape (REQ-28).** The entries of the repository list are the filter toggles. No separate control is added, so the header stays small.
- **Desktop window.** No REQ of this plan targets the desktop window. It loads the same web build, so the constraint of `requirements.md` holds with no Electron e2e (knowledge base `electron-e2e-separate`).
- **Test folders.** Gatekeeper decision, 2026-11-16: every test that runs detection uses temporary folders only, never the user's home folder. Each batch file states it.
- **Ubuntu (knowledge base `wsl-keeps-ubuntu-working`).** Detection uses Node file reads and git only, with no WSL path. Nothing changes for Ubuntu.

## Departures

- **Detection depth (REQ-2).** Departing from the spec, human decision of 2026-11-16. The spec says "at any depth". The plan looks at most 4 folder levels below the project folder (`batch-repo-detection/INT-1`). Reason: a session opened in the home folder must not load the machine. The spec must be corrected: `.sdd/analysis/multi_repo_workspace.md`, section "Requirements", group "Detection", and "Scope".

## Coverage check

REQ → INT. `det` = `batch-repo-detection`, `chg` = `batch-grouped-changes`, `hist` = `batch-combined-history`, `flt` = `batch-repo-filter`. Test INTs are left out of the "Served by" column, except where a REQ has no other INT.

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | `det` INT-3 | `batch-repo-detection` |
| REQ-2 | `det` INT-1, INT-3 | `batch-repo-detection` |
| REQ-3 | `det` INT-1 | `batch-repo-detection` |
| REQ-4 | `det` INT-2 | `batch-repo-detection` |
| REQ-5 | `det` INT-4, INT-5, INT-6, INT-7, INT-8 | `batch-repo-detection` |
| REQ-6 | `det` INT-4, INT-5, INT-6 | `batch-repo-detection` |
| REQ-7 | `det` INT-9, INT-10, INT-11 | `batch-repo-detection` |
| REQ-8 | `det` INT-3, INT-11 | `batch-repo-detection` |
| REQ-9 | `det` INT-3, INT-4, INT-10 | `batch-repo-detection` |
| REQ-10 | `det` INT-4, INT-5 | `batch-repo-detection` |
| REQ-11 | `det` INT-13, INT-14 | `batch-repo-detection` |
| REQ-12 | `det` INT-1 | `batch-repo-detection` |
| REQ-13 | `det` INT-11, INT-12 | `batch-repo-detection` |
| REQ-14 | `chg` INT-1, INT-2, INT-6 | `batch-grouped-changes` |
| REQ-15 | `chg` INT-2 | `batch-grouped-changes` |
| REQ-16 | `chg` INT-2 | `batch-grouped-changes` |
| REQ-17 | `chg` INT-3 | `batch-grouped-changes` |
| REQ-18 | `chg` INT-4 | `batch-grouped-changes` |
| REQ-19 | `chg` INT-1, INT-3, INT-6 | `batch-grouped-changes` |
| REQ-20 | `chg` INT-5, INT-6 | `batch-grouped-changes` |
| REQ-21 | `hist` INT-1, INT-2, INT-3, INT-4, INT-8 | `batch-combined-history` |
| REQ-22 | `hist` INT-6, INT-8 | `batch-combined-history` |
| REQ-23 | `det` INT-9; `hist` INT-6, INT-8, INT-10 | `batch-combined-history` |
| REQ-24 | `hist` INT-2, INT-4, INT-5, INT-6, INT-7 | `batch-combined-history` |
| REQ-25 | `hist` INT-5 | `batch-combined-history` |
| REQ-26 | `hist` INT-3, INT-8 | `batch-combined-history` |
| REQ-27 | `hist` INT-6 | `batch-combined-history` |
| REQ-28 | `flt` INT-1, INT-2 | `batch-repo-filter` |
| REQ-29 | `flt` INT-3 | `batch-repo-filter` |
| REQ-30 | `flt` INT-1, INT-2, INT-3 | `batch-repo-filter` |
| REQ-31 | `det` INT-11; `flt` INT-2 | `batch-repo-filter` |

INT → REQ: every INT of the four batches serves at least one REQ. There is no enabling INT.
