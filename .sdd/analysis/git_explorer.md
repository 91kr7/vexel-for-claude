---
request_slug: git_explorer
date: 2026-11-10
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client.md
---

# Analysis — Git explorer for the session workspace

## Request

> è possibile integrare un explorer git al fine di vedere le modifiche effettuate e la history? ovviamente se il workspace è agganciato ad un repo git

## Reference

Evolution of [claude_sessions_client.md](claude_sessions_client.md). That analysis defines a client that lists Claude Code sessions and opens each one in a page. Each session works in a project folder. Its out-of-scope list includes "Code review, diff views and pull request flows" (line 191).

Changes:
- Diff views leave the out-of-scope list, for viewing only. Code review and pull request flows stay out.
- New feature → a read-only git explorer for the project folder of a session.

## Summary

When the project folder of a session is in a git repository, the user can open a git explorer from the client. The explorer shows the uncommitted changes and the commit history, each with its diff.

## Requirements

### Functional

Availability
- The client must offer the git explorer only for a session whose project folder is inside a git repository.
- For a folder outside a git repository, the client must not offer the explorer.
- The explorer must be available for hosted sessions and for external sessions.
- The explorer must show the repository and the current branch it is reading.

Changes
- The explorer must list the files with uncommitted changes in the repository.
- Each file must show its kind of change: added, modified, deleted, renamed or untracked.
- The list must keep staged changes apart from unstaged changes.
- A click on a file must show its diff, with added and removed lines marked differently.
- When there are no uncommitted changes, the explorer must say so.

History
- The explorer must list the commits of the current branch, newest first.
- Each commit must show its short hash, its message, its author and its date.
- A click on a commit must show the files it changed, and a click on a file must show its diff in that commit.
- A repository with no commits yet must show an empty history, not an error.

Refresh
- The explorer must read the repository when it opens.
- The user must be able to refresh the explorer by hand.
- The explorer must refresh by itself when a turn of a session in the same folder ends.

Read-only
- The explorer must not change the repository or the files of the folder.

### Non-functional

- A binary file must appear in the list, with a note in place of its diff.
- A very large diff or a long history must not freeze the page. The explorer may show it in parts.
- A git error must appear as a message in the explorer and must not break the rest of the client.
- The explorer must work in the browser page and in the desktop window ([desktop_app.md](desktop_app.md)).

## Assumptions

- This request is an evolution of `claude_sessions_client.md`, not a fix. The gatekeeper decided this, because that analysis puts diff views out of scope on purpose.
- "Explorer" means viewing only, because the request says "vedere". There is no commit, stage, checkout or push.
- "Workspace" means the project folder of the session. The explorer reads the repository that contains that folder, also when the folder is a subfolder of it.
- "Modifiche effettuate" means the uncommitted changes of the working tree: staged, unstaged and untracked. Git cannot tell which session made a change.
- "History" means the commits of the current branch only.
- When git is not installed, the client treats every folder as outside a git repository.
- A refresh happens only on the three events in the "Refresh" requirements. There is no periodic poll.
- Several sessions on the same folder show the same repository content.

## Market trends

- The Claude Code desktop app has a diff view. It reviews the changes of a session "file by file" and opens from the line counts or the Changes card ([Claude Code docs](https://code.claude.com/docs/en/desktop)).
- Its users report gaps in that view. The diff stays stale after Claude edits a file ([issue 52740](https://claudeissues.com/issue/52740-desktop-app-diff-viewer-shows-stale-content-after-claude-edits-files)). Users ask for a list of changed files with staged and unstaged apart ([issue 13563](https://claudeissues.com/issue/13563-feature-request-git-viewer-in-claude-code-desktop)). One report says the panel compared against `origin/main`, not the working tree ([issue 65852](https://claudeissues.com/issue/65852-claude-code-on-desktop-app-mac-os-git-panel-diffs-against-origin-main-without-di)). These three points come from search results, because the issue pages did not load.

What this means for the request:
- A diff view is standard in this market, so the request meets a common expectation.
- The reported gaps match the requirements above: refresh after a turn, staged apart from unstaged, and changes taken from the working tree.

## Risks

- A view that does not refresh shows changes that no longer exist. The user then trusts wrong data.
- A large repository or a large diff can make the explorer slow.
- Reading a repository while Claude runs git commands in the same folder can show a state that is half updated.
- Diffs can show secrets in the files, such as keys in a config file. Access stays local, as in the base analysis.

## Scope

In scope:
- Detection of a git repository for the project folder of each session.
- List and diff of uncommitted changes, staged apart from unstaged.
- History of the current branch, with the files and the diff of each commit.
- Refresh on opening, by hand, and at the end of a turn in the same folder.

Out of scope:
- Any write to the repository: commit, stage, discard, checkout, branch, merge, push, pull.
- Other branches, tags, stashes, remotes and branch comparison.
- Code review, comments on lines and pull request flows.
- Linking a change to the session or the turn that made it.
- Blame and the history of a single file.
- Content of submodules.
- Folders that are not in a git repository, and version control systems other than git.
