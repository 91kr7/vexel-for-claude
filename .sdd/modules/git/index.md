# Module git

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| GitRunner | backend service | `src/server/git/git-runner.ts` | Runs read-only git commands of a fixed list (`log` and `diff-tree` included), with `--no-optional-locks`, a 10 s timeout and a 5 MB output cap (error, or truncated output on request); git errors with their message | `specs/git-runner.md` |
| lookupRepository | backend function | `src/server/git/repository-lookup.ts` | Repository root and branch (or detached hash) of a folder, or "none" | `specs/repository-lookup.md` |
| parseStatus | backend function | `src/server/git/status-parser.ts` | Changed files of `git status --porcelain=v2 -z`: path, old path of a rename, group and kind | `specs/status-parser.md` |
| lookupChanges | backend function | `src/server/git/changes-lookup.ts` | Uncommitted changes of the whole repository of a folder, untracked files included | `specs/changes-lookup.md` |
| parseDiff | backend function | `src/server/git/diff-parser.ts` | Unified diff of one file as marked lines, binary note, cut after 5,000 lines | `specs/diff-parser.md` |
| lookupFileDiff | backend function | `src/server/git/diff-lookup.ts` | Diff of one changed file in the staged or unstaged group, untracked files included | `specs/diff-lookup.md` |
| ChangesRoute | REST endpoint | `src/server/git/changes-route.ts` | `GET /api/git/changes` and `GET /api/git/diff`: the changes list and the diff of one file | `specs/changes-route.md` |
| parseLog | backend function | `src/server/git/log-parser.ts` | Commits of a `git log -z` output with NUL-split fields: hash, short hash, parents, message, author, date | `specs/log-parser.md` |
| lookupHistory | backend function | `src/server/git/history-lookup.ts` | Commits reachable from HEAD in `--date-order`, with their parents, in pages of 100 from an offset; no commits → empty page | `specs/history-lookup.md` |
| lookupCommitFiles | backend function | `src/server/git/commit-files-lookup.ts` | Files of a commit against its first parent (empty tree for a first commit): kind, rename, binary mark | `specs/commit-files-lookup.md` |
| lookupCommitFileDiff | backend function | `src/server/git/commit-diff-lookup.ts` | Diff of one file in a commit, against the same base as lookupCommitFiles | `specs/commit-diff-lookup.md` |
| HistoryRoute | REST endpoint | `src/server/git/history-route.ts` | `GET /api/git/history`, `GET /api/git/commit-files` and `GET /api/git/commit-diff` | `specs/history-route.md` |
| detectRepositories | backend function | `src/server/git/repository-detection.ts` | Covered repositories of a folder: the one around it, then the ones up to 4 levels below in path order, with name, relative path, and branch or git error | `specs/repository-detection.md` |
| RepositoryRoute | REST endpoint | `src/server/git/repository-route.ts` | `GET /api/git/repository`: the covered repositories of a folder path, detected again at each request | `specs/repository-route.md` |
| useRepositoryLookup | frontend hook | `src/web/git/repository-lookup-store.ts` | Covered repositories of the open session folder, once per folder and again at each new revision: loading, repositories, none, error | `specs/repository-lookup-store.md` |
| GitExplorerButton | UI component | `src/web/git/GitExplorerButton.tsx` | Header icon button "Git Explorer" that opens and closes the panel, shown for at least one covered repository or a git error | `specs/git-explorer-button.md` |
| GitExplorerPanel | UI component | `src/web/git/GitExplorerPanel.tsx` | Right panel of the session content: repository name and branch chip, or the repository list for several, "Refresh", tab "Changes" on every covered repository, tab "History" on the first one, git error; refreshes on a turn end in or above a covered repository | `specs/git-explorer-panel.md` |
| RepositoryList | UI component | `src/web/git/RepositoryList.tsx` | Header list of the covered repositories: colour mark, name, relative path, branch chip or git error | `specs/repository-list.md` |
| repositoryColor | frontend function | `src/web/git/repository-colors.ts` | Colour of a repository by its position in the list, from a palette of 6 theme tokens with light and dark values | `specs/repository-colors.md` |
| useChanges | frontend hook | `src/web/git/changes-store.ts` | Uncommitted changes of each covered root, one state per root, read once per root and again at each new revision: loading, loaded, error | `specs/changes-store.md` |
| useFileDiff | frontend hook | `src/web/git/diff-store.ts` | Diff of one changed file, or of one file in a commit (`useCommitFileDiff`): idle, loading, loaded, error | `specs/diff-store.md` |
| DiffView | UI component | `src/web/git/DiffView.tsx` | Diff of one file in Roboto Mono, unified view drawn by react-diff-view: coloured "+" and "-" lines, muted hunk headers, binary and cut notes | `specs/diff-view.md` |
| ChangesTab | UI component | `src/web/git/ChangesTab.tsx` | Changed files in react-aria-components list boxes, groups "Staged" and "Unstaged" with kind labels, one group per repository (none for a single one) with name, colour, empty note or error; selecting a file shows its diff from its repository | `specs/changes-tab.md` |
| useHistory | frontend hook | `src/web/git/history-store.ts` | History of a repository root in pages, first page read again at each new revision: idle, loading, loaded with "load more", error | `specs/history-store.md` |
| useCommitFiles | frontend hook | `src/web/git/commit-files-store.ts` | Files of one commit: loading, loaded, error | `specs/commit-files-store.md` |
| HistoryTab | UI component | `src/web/git/HistoryTab.tsx` | Commit graph drawn by `commit-graph`, one row per commit with short hash, subject, author and date; branch label on the tip; "Load more"; "No commits yet"; opens the commit detail | `specs/history-tab.md` |
| CommitDetail | UI component | `src/web/git/CommitDetail.tsx` | Full message and changed files of a commit in a react-aria-components list box with kind labels; selecting a file shows its diff | `specs/commit-detail.md` |
| useTurnEndSignal | frontend hook | `src/web/git/turn-end-watcher.ts` | Signals a session of the list going from `working` to `idle` with its folder at, under or above one of the covered roots | `specs/turn-end-watcher.md` |
