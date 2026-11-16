---
request_slug: multi_repo_workspace
date: 2026-11-16
type: evolution
size: ordinary
reference: .sdd/analysis/git_graph.md
---

# Analysis — Git explorer for workspaces with several git repositories

## Request

> è possibile sostituire il componente custom per visionare i repo git con uno opensource con magari anche la view della history a grafico??
> inoltre puoi gestirmi i workspace con più progetti git al loro interno? intellij ad esempio lo fa!

## Reference

Evolution of [git_graph.md](git_graph.md), which builds on [git_explorer.md](git_explorer.md). Today the explorer reads one repository: the one that contains the project folder of the session. A folder that is not inside a repository gets no explorer, even when its subfolders are repositories.

Changes:
- The explorer also finds the git repositories inside the project folder, at any depth.
- One explorer covers every repository it finds, in one combined view. Each repository has its own name and colour.

## Summary

When the project folder of a session holds several git repositories, the git explorer shows all of them in one view. Changes are grouped by repository. The history shows the commits of all repositories together, each marked with its repository. The user can filter both by repository.

## Human decisions

The human gave these decisions on 2026-11-16, answering the analyst of `git_graph`.
- The explorer shows one combined view, grouped by repository, with a filter per repository. The human rejected "one repository at a time with a selector".
- Detection searches the whole folder tree. It skips dependency folders and build output folders. Submodules are excluded.

## Requirements

### Functional

Detection
- The explorer must cover the repository that contains the project folder, if there is one.
- The explorer must also cover every git repository inside the project folder, at any depth.
- Detection must skip dependency folders and build output folders.
- Detection must exclude submodules.
- The client must offer the explorer when the explorer covers at least one repository.
- With no repository found, the client must not offer the explorer, as today.

Repositories
- Each repository must show its name, its colour, its path relative to the project folder and its current branch.
- Each repository must keep the same colour in the changes and in the history.
- The repository that contains the project folder must come first. The others must follow in path order.
- With a single repository, the explorer must look and behave as it does today.

Filter
- The user must be able to filter the explorer by one or more repositories.
- The filter must apply to the changes and to the history.
- With no filter set, the explorer must show every repository.

Changes
- The explorer must show the uncommitted changes of every repository in one view, grouped by repository.
- Each group must carry the name and the colour of its repository.
- Each group must keep staged changes apart from unstaged changes, as today.
- A repository with no changes must say so inside its group.
- A click on a file must show its diff, as today.

History
- The history must show the commits of every covered repository in one view, newest first.
- Each commit must carry the name and the colour of its repository, as the IntelliJ Log does.
- The graph of each repository must follow every rule of [git_graph.md](git_graph.md), so it shows the current branch of that repository only.
- Lines of the graph must never join commits of two different repositories.

Refresh
- Every refresh must find the repositories again. A repository created or removed during the session must appear or disappear.
- The refresh at the end of a turn must cover every repository of the folder.

### Non-functional

- An error in one repository must appear in that repository only. The other repositories must still show.
- Finding the repositories in a large folder must not freeze the page or slow the session list.
- The explorer stays read-only, and must work in the browser page and in the desktop window, as today.

## Assumptions

- This request is an evolution, not a fix. The gatekeeper decided this in [git_graph.md](git_graph.md), because several repositories are new behaviour.
- "Workspace" means the project folder of a session, as in `git_explorer.md`.
- "Progetti git" means independent git repositories, each with its own `.git`.
- The name of a repository is the name of its root folder. The relative path tells apart two repositories with the same name.
- A repository inside another repository counts as a separate repository when it is not a submodule.
- Detection does not follow symbolic links to folders, so a link loop cannot make it endless.

## Market trends

- IntelliJ IDEA handles several repositories in one project. Its Log marks each commit with the colour of its repository and filters the log by one or more repositories ([IntelliJ Log tab](https://www.jetbrains.com/help/idea/2026.2/log-tab.html)).
- IntelliJ groups local changes by repository. Users report this grouping and can turn it off ([JetBrains forum](https://intellij-support.jetbrains.com/hc/zh-cn/community/posts/360010511360/comments/360002814119)).

What this means for the request: a combined view with a colour and a filter per repository matches what IntelliJ users expect.

## Risks

- A folder with many subfolders, such as a home folder, can make detection slow even with dependency folders skipped.
- Many repositories with many changes or commits can make the combined view long and hard to read. The filter is the answer to this.
- Colours that look alike, mostly in the dark theme, can make two repositories hard to tell apart.
- A long combined history loaded in parts can break the graph lines of one repository at the borders between parts.

## Scope

In scope:
- Detection of every repository that contains or sits inside the project folder, skipping dependency and build output folders.
- One combined view of changes and history, grouped by repository, with a name and a colour per repository.
- A filter by one or more repositories.
- Refresh that also finds new and removed repositories.

Out of scope:
- Any write to a repository, and operations on all repositories at once (commit, pull, push).
- Submodules, and repositories outside the project folder.
- Manual adding of repositories, or saving a list of excluded repositories. The filter is not saved.
- Everything already out of scope in [git_graph.md](git_graph.md).
