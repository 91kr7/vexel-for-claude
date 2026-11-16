---
batch: batch-repo-detection
feature: Repository detection
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13
depends: —
---

# Batch — Repository detection

Requirements: `../requirements.md`. Paths of the module `git` are in `.sdd/modules/git/index.md`.

The git explorer finds every covered repository of the project folder and lists them in its header. The Changes and History tabs still read one repository. The next batches extend them.

## What this batch builds

- **Repository detection** (backend) → finds the covered repositories of a project folder, and gives each one its name, relative path and branch.
- **Repository colours** (frontend) → gives each repository of the list its colour, in the light and the dark theme.
- **Repository list** (frontend UI) → the entries of the covered repositories in the header of the git explorer panel.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, git area (repository detection) | Walk the project folder with async reads, at most 4 folder levels below it, also inside found repositories. Skip symbolic links, the content of `.git` and the folders of "Skipped folders". A folder with a `.git` entry (folder or file) is a candidate. | REQ-2, REQ-3, REQ-12 | — |
| INT-2 | create | backend, git area (repository detection) | Drop a candidate that the repository around it tracks as a gitlink (mode `160000` in `ls-files --stage`). Do not look inside it. | REQ-4 | INT-1 |
| INT-3 | create | backend, git area (repository detection) | Build the covered list: the repository of lookupRepository on the folder first, then the candidates in path order, with no duplicate root. Each entry has root, name, relative path, and branch or its git error. | REQ-1, REQ-2, REQ-8, REQ-9 | INT-1, INT-2 |
| INT-4 | modify | `src/server/git/repository-route.ts` | Answer the covered list of `path`, or `none` when the list is empty or git is not installed. Run detection again at each request, with no cache. | REQ-5, REQ-6, REQ-9, REQ-10 | INT-3 |
| INT-5 | modify | `src/web/git/repository-lookup-store.ts` | Carry the covered list in place of one repository. Keep `loading`, `none`, `error` and the revision rules. | REQ-5, REQ-6, REQ-10 | INT-4 |
| INT-6 | modify | `src/web/git/GitExplorerButton.tsx` | Show the button for a list with at least one repository, or for an error. | REQ-5, REQ-6 | INT-5 |
| INT-7 | modify | `src/web/sessions/SessionView.tsx` | Show the panel on the new lookup state: a list with at least one repository, or an error. | REQ-5 | INT-5 |
| INT-8 | modify | `src/web/external/ConversationView.tsx` | Same change as INT-7. | REQ-5 | INT-5 |
| INT-9 | create | frontend, git area (repository colours) | A palette of theme tokens with a light and a dark value. A repository takes the colour of its position in the list. After the last colour, the palette starts again. | REQ-7 | — |
| INT-10 | create | frontend, git area (repository list) | One entry per repository: colour mark, name, relative path, and branch chip ("detached <short hash>" on a detached HEAD). An entry with a git error shows the message. | REQ-7, REQ-9 | INT-9 |
| INT-11 | modify | `src/web/git/GitExplorerPanel.tsx` | With several repositories, show the repository list in the header, next to "Refresh". With one, keep today's header. | REQ-7, REQ-8, REQ-13 | INT-5, INT-10 |
| INT-12 | modify | `src/web/git/GitExplorerPanel.tsx` | The Changes and History tabs read the first repository of the list. The next batches replace this. | REQ-13 | INT-5 |
| INT-13 | modify | `src/web/git/turn-end-watcher.ts` | Take a list of roots. Signal when a session folder is at or under a root, or a root is under the session folder. | REQ-11 | — |
| INT-14 | modify | `src/web/git/GitExplorerPanel.tsx` | Pass every covered root to useTurnEndSignal. | REQ-11 | INT-13 |
| INT-15 | modify | `src/server/git/repository-route.test.ts`, `src/web/git/repository-lookup-store.test.tsx`, `src/web/git/GitExplorerButton.test.tsx`, `src/web/git/GitExplorerPanel.test.tsx`, `src/web/git/turn-end-watcher.test.tsx` | Adapt the tests to the covered list. Add unit tests next to the new components: nested repositories, a repository at level 4 found and one at level 5 not found, skipped folders, a submodule, a symbolic link loop, path order, one failing repository. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-11, REQ-13 | INT-1 to INT-14 |
| INT-16 | modify | `e2e/git-explorer.spec.ts` | Add a fixture in a temporary folder that is not a repository, with two nested repositories. Add a third repository at level 5, one in `node_modules` and a submodule. Check the button, the list, its order, a repository added before "Refresh", and the single repository header. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-10, REQ-13 | INT-1 to INT-14 |

## Skipped folders

Detection does not enter a folder with one of these names: `node_modules`, `bower_components`, `jspm_packages`, `vendor`, `.venv`, `venv`, `__pycache__`, `.tox`, `.gradle`, `.m2`, `target`, `build`, `dist`, `out`, `.next`, `.nuxt`, `.dart_tool`, `Pods`, `.terraform`.

## Notes for the implementer

- **Depth limit (REQ-2).** Human decision, 2026-11-16 (departure from the spec, see `batches.md`). The project folder is level 0. A folder at level 4 can be a candidate, but the walk does not read inside it.
- **Test folders.** Gatekeeper decision, 2026-11-16: every test that runs detection uses temporary folders only. No test ever runs detection on the user's home folder or on any real folder of the machine.
- **Test parallelism.** Knowledge base `limited-test-parallelism`: at most 4 Vitest workers, at most 3 Playwright workers, and never two full suites at the same time.
- **No blocking (REQ-12).** The walk uses async file reads and gives control back to the event loop between folders. The branch lookups run with a small fixed concurrency, so many repositories do not start many git processes at once.
- **Relative path.** `.` for the project folder itself, a `..` path for a repository above it.
- **Submodule test.** `ls-files` is already a read command of GitRunner. No new git command is needed.

## Human acceptance

### Scenario: The user sees every repository of a workspace folder

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-7, REQ-8
- Given → a session on a temporary folder that is not a repository. It holds the repositories `api`, `web/app` and `a/b/c/d/deep`, a repository inside `node_modules`, and a submodule of `api`.
- When → the user opens the git explorer
- Then → the header lists `api`, then `web/app`, each with its own colour, relative path and branch
- And → the repository in `node_modules`, the submodule and `a/b/c/d/deep` (5 levels down) do not appear

### Scenario: The user finds a new repository after a refresh

- REQ → REQ-10
- Given → the git explorer of the folder above is open
- When → the user runs `git init tools` in the folder and clicks "Refresh"
- Then → `tools` appears in the list, in path order

### Scenario: The git explorer refreshes after a turn in a nested repository

- REQ → REQ-11
- Given → the git explorer of the folder above is open, and a second session works in `api`
- When → the second session ends a turn that adds a repository `api/plugins/x`
- Then → the list of the first session shows `api/plugins/x` with no click

### Scenario: The user sees one failing repository among the others

- REQ → REQ-9
- Given → the folder above, where the `.git` of `web/app` is damaged
- When → the user opens the git explorer
- Then → the entry of `web/app` shows the git message, and `api` shows its branch

### Scenario: A folder with no repository has no git explorer

- REQ → REQ-6
- Given → a session on a folder with no repository inside or above it
- When → the user opens the session
- Then → the header shows no "Git Explorer" button

### Scenario: A single repository looks as today

- REQ → REQ-13
- Given → a session on a folder that is the root of one repository, with no repository inside it
- When → the user opens the git explorer
- Then → the header shows the repository name and its branch chip, as before this plan

### Scenario: A large folder does not block the client

- REQ → REQ-12
- Given → a session on a temporary folder with many thousands of subfolders
- When → the user opens the session and detection runs
- Then → the page and the session list keep responding, and the "Git Explorer" button appears when detection ends
