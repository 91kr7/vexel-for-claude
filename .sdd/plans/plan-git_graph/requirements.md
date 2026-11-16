---
slug: git_graph
date: 2026-11-16
spec: .sdd/analysis/git_graph.md
status: validated
---

# Requirements — Git explorer on open-source components, with a graph history

Words used below:

- "Git explorer", "Changes tab", "History tab", "diff" → as in `plan-git_explorer`.
- "Open-source component" → a component whose code is public under an open-source licence.
- "Graph" → the commit graph of the current branch that replaces the plain history list.
- "Current branch" → the branch HEAD points to.

## Feature: Open-source explorer

| ID | Requirement |
|----|-------------|
| REQ-1 | The Changes tab and every diff of the git explorer use open-source components, and the custom components they replace are gone. |
| REQ-2 | The Changes tab keeps every behaviour of `plan-git_explorer/REQ-9` to `plan-git_explorer/REQ-15`. |
| REQ-3 | The git explorer keeps every behaviour of `plan-git_explorer/REQ-1` to `plan-git_explorer/REQ-8` and of `plan-git_explorer/REQ-23` to `plan-git_explorer/REQ-26`. |
| REQ-4 | The git explorer follows the light and the dark theme of the app. |
| REQ-5 | The git explorer works in the browser page and in the desktop window. |
| REQ-6 | The licence of each new component allows its distribution in the browser build and in the desktop build. |
| REQ-7 | The licence notices of the new components ship with the browser build and with the desktop build. |

## Feature: Graph history

| ID | Requirement |
|----|-------------|
| REQ-8 | The History tab shows the commits of the current branch as a graph, newest first, drawn by an open-source component. |
| REQ-9 | The graph includes the commits that merges brought into the current branch. |
| REQ-10 | A merge commit shows a line to each of its parents. |
| REQ-11 | A history with no merges shows as one straight line. |
| REQ-12 | The commit at the tip of the current branch carries the branch name. |
| REQ-13 | Each commit row shows its short hash, its message, its author and its date. |
| REQ-14 | A click on a commit shows the files it changed, each with its kind of change. |
| REQ-15 | A click on a file of a commit shows its diff in that commit. |
| REQ-16 | A binary file changed by a commit appears in its file list, and a note replaces its diff. |
| REQ-17 | A repository with no commits shows an empty history, not an error. |
| REQ-18 | A long history does not freeze the page. |
| REQ-19 | When the graph loads in parts, its lines stay correct across the borders between parts. |

## Assumptions

- **No mock.** The look follows the current git explorer panel and its two tabs. Every new text is in English, as in the rest of the client.
- **Order of the graph (REQ-8).** Newest first means `git log --date-order`: a commit never shows below one of its parents, and otherwise the newer commit comes first.
- **Graph content (REQ-9).** The graph holds the commits reachable from HEAD. Other branches, remote branches and tags do not appear, as in the spec.
- **Tip label (REQ-12).** On a detached HEAD the tip carries "detached" in place of a branch name, as the header of the git explorer already does.
- **Merge commit (REQ-14, REQ-15).** Its files and diffs compare against its first parent, as `git show --first-parent` does. The first commit compares against an empty tree.
- **Message and date (REQ-13).** The row shows the first line of the message and the author date, as today.
- **Diff look (REQ-1, REQ-2).** The diff stays a unified view, with added and removed lines marked differently. A side-by-side view is not required.
- **Out of scope**, as in the spec: workspaces with several repositories, other branches and tags in the graph, any write to the repository, filters and search, blame, file history, submodule content.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every requirement of `plan-git_explorer` stays true, except `plan-git_explorer/REQ-16`. REQ-8 replaces it.
