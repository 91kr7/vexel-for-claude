---
slug: multi_repo_workspace
date: 2026-11-16
spec: .sdd/analysis/multi_repo_workspace.md
status: validated
---

# Requirements — Git explorer for workspaces with several git repositories

Words used below:

- "Git explorer", "Changes tab", "History tab", "diff", "project folder" → as in `plan-git_explorer`.
- "Graph" → as in `plan-git_graph`.
- "Repository" → an independent git repository, with its own `.git`.
- "Covered repository" → a repository the git explorer of a session reads: the one that contains the project folder, and the ones inside it.
- "Detection" → the search for the covered repositories.
- "Repository list" → the place of the git explorer that names the covered repositories.
- "Filter" → the choice of the repositories the git explorer shows.

## Feature: Repository detection

| ID | Requirement |
|----|-------------|
| REQ-1 | The git explorer covers the repository that contains the project folder, if there is one. |
| REQ-2 | The git explorer also covers every repository whose root is at most 4 folder levels below the project folder, also when it sits inside another covered repository. |
| REQ-3 | Detection does not look inside dependency folders and build output folders. |
| REQ-4 | Detection does not cover submodules. |
| REQ-5 | The client offers the git explorer for a session when the git explorer covers at least one repository. |
| REQ-6 | The client does not offer the git explorer when it covers no repository, or when git is not installed. |
| REQ-7 | With several covered repositories, the repository list shows each one with its name, its colour, its path relative to the project folder and its current branch. |
| REQ-8 | In the repository list, the repository that contains the project folder comes first, and the others follow in path order. |
| REQ-9 | A git error in one repository appears on that repository in the repository list, and the other repositories still show. |
| REQ-10 | Every refresh of the git explorer runs detection again, so a repository created or removed during the session appears or disappears. |
| REQ-11 | The git explorer refreshes by itself when a turn ends in a session whose project folder is inside one of its covered repositories or contains one of them. |
| REQ-12 | Detection in a large folder does not freeze the page and does not slow the session list. |
| REQ-13 | With a single covered repository, the git explorer shows that repository and its branch as today. |

## Feature: Grouped changes

| ID | Requirement |
|----|-------------|
| REQ-14 | The Changes tab shows the uncommitted changes of every covered repository in one view, one group per repository, in the order of the repository list. |
| REQ-15 | Each group carries the name and the colour of its repository. |
| REQ-16 | Each group shows staged changes apart from unstaged changes. |
| REQ-17 | A repository with no uncommitted changes says so inside its group. |
| REQ-18 | A click on a file of a group shows its diff in that repository. |
| REQ-19 | A git error while reading the changes of one repository appears in its group only. |
| REQ-20 | With a single covered repository, the Changes tab looks and behaves as today, with no group. |

## Feature: Combined history

| ID | Requirement |
|----|-------------|
| REQ-21 | The History tab shows the commits of every covered repository in one graph, newest first. |
| REQ-22 | Each commit carries the name and the colour of its repository. |
| REQ-23 | A repository has the same colour in the repository list, in the Changes tab and in the History tab. |
| REQ-24 | The commits of each repository keep every behaviour of `plan-git_graph/REQ-8` to `plan-git_graph/REQ-19`, so the graph shows only the current branch of that repository. |
| REQ-25 | No line of the graph joins commits of two different repositories. |
| REQ-26 | A git error while reading the history of one repository appears in the History tab, and the commits of the other repositories still show. |
| REQ-27 | With a single covered repository, the History tab looks and behaves as today, with no repository mark on the commits. |

## Feature: Repository filter

| ID | Requirement |
|----|-------------|
| REQ-28 | The user can filter the git explorer by one or more repositories. |
| REQ-29 | The filter applies to the Changes tab and to the History tab. |
| REQ-30 | With no filter set, the git explorer shows every covered repository. |
| REQ-31 | With a single covered repository, the git explorer offers no filter. |

## Assumptions

- **No mock.** The look follows the current git explorer panel. Every new text is in English, as in the rest of the client.
- **Repository list (REQ-7).** It sits in the header of the git explorer panel, in the place of today's repository name and branch.
- **Name and path (REQ-7).** The name is the name of the root folder of the repository. The path of the repository that contains the project folder is `.` when it is the project folder itself, and a parent path such as `..` otherwise. A detached HEAD shows "detached" and the short hash, as today.
- **Colour (REQ-7, REQ-23).** Each repository takes a colour from a fixed palette, in the order of the repository list. The palette has a light and a dark variant of each colour, chosen to be easy to tell apart in both themes. After the last colour, the palette starts again. A repository added by a refresh can shift the colours of the repositories after it. Gatekeeper decision, 2026-11-16: fewer moving parts, and neighbours stay distinct.
- **Submodules (REQ-4).** A submodule is a folder that the repository containing it registers as a submodule. Detection skips it and does not look inside it.
- **Linked worktrees (REQ-2).** A linked worktree inside the project folder counts as a repository, because it has its own working tree and branch.
- **Symbolic links (REQ-2).** Detection does not follow symbolic links to folders, so a link loop cannot make it endless.
- **Depth limit (REQ-2, REQ-12).** Departing from the spec ("at any depth"), human decision of 2026-11-16: detection looks at most 4 folder levels below the project folder. Example: `<project>/a/b/c/d` can be a covered repository, `<project>/a/b/c/d/e` cannot. A session opened in the home folder must not load the machine. Detection has no time limit. It runs on the server without blocking it. The client offers the git explorer when detection ends.
- **Turn end (REQ-11).** Example: session A on `~/ws` covers `~/ws/front` and `~/ws/back`. A turn ends in session B on `~/ws/front/src`. The git explorer of A refreshes. A turn end is the same event `plan-git_explorer/REQ-25` uses.
- **Order of the combined history (REQ-21).** Newest first follows the commit date across repositories. Inside one repository, the order of `plan-git_graph` holds: a commit never shows below one of its parents.
- **Loading in parts (REQ-21, REQ-24).** The combined history loads in parts, as today. The lines of each repository stay correct across the borders between parts (`plan-git_graph/REQ-19`).
- **Filter life (REQ-28).** The filter lasts while the session page stays open. It is not saved, as in the spec. A repository that a refresh removes leaves the filter. A filter left with no repository counts as no filter.
- **Out of scope**, as in the spec: any write to a repository, operations on all repositories at once, submodules, repositories outside the project folder, adding repositories by hand, saving the filter or a list of excluded repositories, and everything out of scope in `plan-git_graph`.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every requirement of `plan-git_explorer` and `plan-git_graph` stays true for each covered repository, except the ones replaced here: `plan-git_explorer/REQ-1` by REQ-5, `plan-git_explorer/REQ-2` by REQ-6, `plan-git_explorer/REQ-25` by REQ-11.
- The git explorer stays read-only (`plan-git_explorer/REQ-8`), and works in the browser page and in the desktop window (`plan-git_explorer/REQ-7`).
