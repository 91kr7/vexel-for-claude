---
request_slug: git_graph
date: 2026-11-16
type: evolution
size: ordinary
reference: .sdd/analysis/git_explorer.md
---

# Analysis — Git explorer on open-source components, with a graph history

## Request

> è possibile sostituire il componente custom per visionare i repo git con uno opensource con magari anche la view della history a grafico??
> inoltre puoi gestirmi i workspace con più progetti git al loro interno? intellij ad esempio lo fa!

## Reference

Evolution of [git_explorer.md](git_explorer.md). That analysis defines a read-only git explorer for the project folder of a session. It shows uncommitted changes, the history of the current branch as a plain list, and a diff for each file.

Changes:
- The human decided that the whole explorer (changes, diffs, history) moves to open-source components. Today it uses custom components.
- The human decided that the history becomes a graph of the current branch, merges included.
- The second point of the request (workspaces with several git repositories) is a separate request.

## Summary

The git explorer keeps all its current features. Its custom components are replaced by open-source components. The history list becomes a commit graph of the current branch.

## Requirements

### Functional

Existing behaviour
- Every requirement of [git_explorer.md](git_explorer.md) stays valid, except the history list, which the graph below replaces.
- After the change, the user must find every feature the explorer has today: changes split into staged and unstaged, kind of change, diff, refresh, empty states.

Graph history
- The history must show the commits of the current branch as a graph, newest first.
- The graph must include the commits that merges brought into the current branch.
- A merge commit must show a line to each of its parents.
- A history with no merges must show as a single straight line.
- The commit at the tip of the current branch must carry the branch name.
- Each commit row must show its short hash, its message, its author and its date.
- A click on a commit must show the files it changed, and a click on a file must show its diff in that commit.
- A repository with no commits yet must show an empty history, not an error.

### Non-functional

- A long history must not freeze the page. The graph may load in parts and must keep its lines correct across the parts.
- The explorer must follow the light and the dark theme of the app.
- The explorer must work in the browser page and in the desktop window, as today.

## Assumptions

- This request is an evolution of `git_explorer.md`, not a fix. The gatekeeper decided this, because a graph and several repositories are new behaviour.
- The two points of the request run as two cycles, and this file covers only the first. The gatekeeper decided this (knowledge base `run-all-requested-items`).
- The explorer stays read-only. The gatekeeper decided this, because the request says "visionare".
- The files and the diff of a merge commit are compared with its first parent, as `git show --first-parent` does.
- "Open source" means components whose code is public under an open-source licence. Which components to use is a choice for the later phases.

## Constraints

- The licence of each new component must allow distribution inside the app, in the browser build and in the desktop build.
- The licence notices of the new components must ship with the app.

## Market trends

- IntelliJ IDEA shows the log as a graph. It marks the head of the current branch with its own label colour, and it can sort commits so that the commits of a merge sit under the merge commit ([IntelliJ Log tab](https://www.jetbrains.com/help/idea/2026.2/log-tab.html)).
- SmartGit draws a merge as converging lines that end on the merge commit ([SmartGit Graph View](https://docs.syntevo.com/SmartGit/24.1/Manual/GUI/Graph-View)).

What this means for the request: a commit graph is standard in git tools. The merge lines must be easy to read.

## Risks

- A component replacement can lose a feature that the custom version has today, such as the staged and unstaged split or the refresh after a turn.
- A component that does not follow the app theme looks out of place, mostly in the dark theme.
- A graph loaded in parts can draw broken lines at the borders between parts.
- A component licence that does not allow distribution blocks the release.

## Scope

In scope:
- Moving the whole git explorer (changes, diffs, history) to open-source components, with no loss of features.
- A commit graph of the current branch, merges included.

Out of scope:
- Workspaces with several git repositories. A separate request handles this.
- Other branches, remote branches and tags in the graph.
- Any write to the repository: commit, stage, discard, checkout, branch, merge, push, pull.
- Filters and search in the history, blame, and the history of a single file.
- Content of submodules.
