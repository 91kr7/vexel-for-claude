---
batch: batch-open-source-explorer
feature: Open-source explorer
closed_req: REQ-1, REQ-2
depends: —
---

# Batch — Open-source explorer

Requirements: `../requirements.md`. Paths of the module `git` are in `.sdd/modules/git/index.md`.

This batch moves the Changes tab and the diff view to open-source components. It also starts the licence record that `batch-graph-history` completes.

## What this batch builds

- Licence texts of the new components → a copy of the licence file of each new open-source package, kept in the repository so that `THIRD-PARTY-NOTICES.md` can name it.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `package.json` | Add an open-source diff component and an open-source list component as runtime dependencies. Each one must pass the licence rule of "Choosing the components" below. | REQ-1, REQ-6 | — |
| INT-2 | modify | `src/web/git/DiffView.tsx` | Draw the diff lines with the diff component, as a unified view. Keep the props, the added and removed colours, the muted hunk headers, the binary note and the cut note. Style it from the theme tokens, in light and dark. | REQ-1, REQ-2, REQ-4 | INT-1 |
| INT-3 | modify | `src/web/git/ChangesTab.tsx` | Draw the "Staged" and "Unstaged" groups with the list component. Keep the kind labels, the rename text, the tooltips, the selection and the refresh rules. Style it from the theme tokens. | REQ-1, REQ-2, REQ-3, REQ-4 | INT-1 |
| INT-4 | modify | `src/web/git/DiffView.test.tsx` | Adapt the tests to the new markup. Keep every current case. | REQ-2 | INT-2 |
| INT-5 | modify | `src/web/git/ChangesTab.test.tsx` | Adapt the tests to the new markup. Keep every current case. | REQ-2, REQ-3 | INT-3 |
| INT-6 | modify | `e2e/git-explorer.spec.ts` | Keep every Changes case green on the new components. Add a check that the diff follows the dark theme. | REQ-2, REQ-3, REQ-4 | INT-2, INT-3 |
| INT-7 | create | frontend, git area | Licence texts of the components of INT-1, copied from their packages. | REQ-7 | INT-1 |
| INT-8 | modify | `THIRD-PARTY-NOTICES.md` | One entry per component of INT-1: package, version, licence and the path of its licence text (INT-7). | REQ-7 | INT-7 |
| INT-9 | modify | `vite.config.ts` | The web build output carries the licence notices of the third-party packages it bundles. | REQ-7 | INT-1 |

## Choosing the components

- The licence must allow distribution inside the app: MIT, ISC, BSD, Apache-2.0 or an equivalent permissive licence. GPL, AGPL, LGPL and packages with no licence are excluded.
- The component must work with React 18 and accept styling from CSS variables, so that it follows the theme tokens.
- The diff component takes the lines that `parseDiff` already gives. If it needs another input, the batch adapts the lines in the frontend. The server output does not change.
- The implementer records the new packages in the "Dependencies" table of `.sdd/.archi`.

## Human acceptance

### Scenario: The user sees the uncommitted changes and their diff on the new components

- REQ → REQ-1, REQ-2, REQ-3, REQ-4
- Given → a session whose repository has one staged file, one modified file and one untracked file
- When → the user opens the git explorer and clicks the modified file in "Unstaged"
- Then → the groups "Staged" and "Unstaged" list the files with their kind labels, and the diff shows added and removed lines in different colours
- And → after a switch to the dark theme, the list and the diff use the dark colours

### Scenario: The user sees a binary file and a clean repository

- REQ → REQ-2
- Given → a session whose repository has one changed binary file
- When → the user clicks the binary file
- Then → the note "Binary file, no diff shown" replaces the diff
- And → after a commit of every change and a "Refresh", the tab shows "No uncommitted changes"
