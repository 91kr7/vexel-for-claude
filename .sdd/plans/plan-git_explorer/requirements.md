---
slug: git_explorer
date: 2026-11-10
spec: .sdd/analysis/git_explorer.md
status: validated
---

# Requirements — Git explorer for the session workspace

Words used below:

- "Git explorer" → the read-only view of the git repository of a session, as the spec names it.
- "Project folder" → the folder a session works in.
- "Repository" → the git repository that contains the project folder. The project folder can be its root or a subfolder.
- "Uncommitted changes" → the staged, unstaged and untracked changes of the working tree.
- "History" → the commits of the current branch.
- "Diff" → the added and removed lines of one file.

## Feature: Git explorer access

| ID | Requirement |
|----|-------------|
| REQ-1 | The client offers the git explorer for a session whose project folder is inside a repository. |
| REQ-2 | The client does not offer the git explorer for a session whose project folder is outside a repository, or when git is not installed. |
| REQ-3 | The git explorer is offered for hosted sessions and for external sessions. |
| REQ-4 | The git explorer shows the repository it reads and its current branch. |
| REQ-5 | When the project folder is a subfolder of the repository, the git explorer reads the whole repository. |
| REQ-6 | A git error appears as a message in the git explorer, and the rest of the client keeps working. |
| REQ-7 | The git explorer works in the browser page and in the desktop window. |
| REQ-8 | Using the git explorer changes nothing in the repository or in the files of the folder. |

## Feature: Uncommitted changes

| ID | Requirement |
|----|-------------|
| REQ-9 | The git explorer lists every file of the repository with uncommitted changes. |
| REQ-10 | Each listed file shows its kind of change: added, modified, deleted, renamed or untracked. |
| REQ-11 | The list shows staged changes apart from unstaged changes. |
| REQ-12 | A click on a listed file shows its diff, with added lines and removed lines marked differently. |
| REQ-13 | When there are no uncommitted changes, the git explorer says so. |
| REQ-14 | A binary file appears in the list, and a note replaces its diff. |
| REQ-15 | A very large diff does not freeze the page. |

## Feature: History

| ID | Requirement |
|----|-------------|
| REQ-16 | The git explorer lists the commits of the current branch, newest first. |
| REQ-17 | Each commit shows its short hash, its message, its author and its date. |
| REQ-18 | A click on a commit shows the files it changed, each with its kind of change. |
| REQ-19 | A click on a file of a commit shows its diff in that commit. |
| REQ-20 | A repository with no commits shows an empty history, not an error. |
| REQ-21 | A long history does not freeze the page. |
| REQ-22 | A binary file changed by a commit appears in its file list, and a note replaces its diff. |

## Feature: Refresh

| ID | Requirement |
|----|-------------|
| REQ-23 | The git explorer reads the repository each time it opens. |
| REQ-24 | The user can refresh the git explorer by hand. |
| REQ-25 | The git explorer refreshes by itself when a turn of a session in the same repository ends. |
| REQ-26 | After a refresh, an open diff shows the current content, or closes when its file no longer has that change. |

## Assumptions

- **Shape of the git explorer.** Human decision, 2026-11-10. There is no mock. The git explorer is a panel of the session page, opened by a button in the header of the session. It has two tabs, "Changes" and "History". Its look follows the existing panels, in the light and in the dark theme. Every new text is in English, as in the rest of the client.
- **Offered (REQ-1, REQ-2).** "Not offered" means the button does not appear. The client checks the repository when the session page opens. A session whose project folder no longer exists counts as outside a repository.
- **Repository and branch (REQ-4).** The git explorer shows the name of the root folder of the repository, with its full path on hover, and the branch name. On a detached HEAD it shows "detached" and the short hash.
- **Untracked files (REQ-10, REQ-11).** Gatekeeper decision, 2026-11-10: it follows the usual `git status` grouping. Untracked files appear in the unstaged group. A file with staged and unstaged changes appears in both groups. Each group shows the diff of its own change: staged against the last commit, unstaged against the staged version. An untracked file shows all its lines as added.
- **Commit message (REQ-17).** The list shows the first line of the message. The full message appears with the files of the commit (REQ-18). The date is the author date.
- **Diff of a commit (REQ-19).** The diff is against the first parent. The first commit compares against an empty tree.
- **Large content (REQ-15, REQ-21).** The history loads in pages of fixed size, with a "Load more" control. A diff over a fixed size shows its first part and a note that it is cut. The sizes are a planner choice, fixed in the batch.
- **Same repository (REQ-25).** Departing from the spec, human decision of 2026-11-10. The spec says "the same folder". The plan uses "a session whose project folder is in the same repository", because a session in a subfolder changes the same working tree. Example: repository `~/progetto`, session A on `~/progetto` with the git explorer open, session B on `~/progetto/frontend`. When B ends a turn, the git explorer of A refreshes. A turn end is the same event the client already uses for the turn-end notification (`plan-session_notifications`). A turn the user interrupts also triggers a refresh, because it can leave changes (gatekeeper decision).
- **Refresh on opening (REQ-23).** Every opening of the panel reads the repository again. There is no periodic poll, as in the spec.
- **Read-only (REQ-8).** The client runs only git commands that read. Reading the status must not write the git index or take its lock, because Claude can run git in the same folder at the same time.
- **Ended and history sessions.** The git explorer is offered for any session the client can open, also an ended one, as long as its project folder is in a repository. It shows the current state of the repository, not the state at the time of the session.
- **Out of scope**, as in the spec: any write to the repository, other branches, tags, stashes and remotes, branch comparison, code review and comments, linking a change to a session or a turn, blame and file history, submodule content, other version control systems.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every requirement of `plan-usage_limits` and of the plans before it stays true.
