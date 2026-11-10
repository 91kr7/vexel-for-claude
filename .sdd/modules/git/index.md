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
| parseLog | backend function | `src/server/git/log-parser.ts` | Commits of a `git log -z` output with NUL-split fields: hash, short hash, message, author, date | `specs/log-parser.md` |
| lookupHistory | backend function | `src/server/git/history-lookup.ts` | Commits reachable from HEAD in pages of 100 from an offset; no commits → empty page | `specs/history-lookup.md` |
| lookupCommitFiles | backend function | `src/server/git/commit-files-lookup.ts` | Files of a commit against its first parent (empty tree for a first commit): kind, rename, binary mark | `specs/commit-files-lookup.md` |
| lookupCommitFileDiff | backend function | `src/server/git/commit-diff-lookup.ts` | Diff of one file in a commit, against the same base as lookupCommitFiles | `specs/commit-diff-lookup.md` |
| HistoryRoute | REST endpoint | `src/server/git/history-route.ts` | `GET /api/git/history`, `GET /api/git/commit-files` and `GET /api/git/commit-diff` | `specs/history-route.md` |
| RepositoryRoute | REST endpoint | `src/server/git/repository-route.ts` | `GET /api/git/repository`: the repository lookup of a folder path | `specs/repository-route.md` |
| useRepositoryLookup | frontend hook | `src/web/git/repository-lookup-store.ts` | Repository lookup of the open session folder, once per folder: loading, repository, none, error | `specs/repository-lookup-store.md` |
| GitExplorerButton | UI component | `src/web/git/GitExplorerButton.tsx` | Header icon button "Git Explorer" that opens and closes the panel, shown for a repository or a git error | `specs/git-explorer-button.md` |
| GitExplorerPanel | UI component | `src/web/git/GitExplorerPanel.tsx` | Right panel of the session content: repository name with its path as tooltip, branch chip, tabs "Changes" and "History", git error | `specs/git-explorer-panel.md` |
| useChanges | frontend hook | `src/web/git/changes-store.ts` | Uncommitted changes of a repository root, once per root: loading, loaded, error | `specs/changes-store.md` |
| useFileDiff | frontend hook | `src/web/git/diff-store.ts` | Diff of one changed file, or of one file in a commit (`useCommitFileDiff`): idle, loading, loaded, error | `specs/diff-store.md` |
| DiffView | UI component | `src/web/git/DiffView.tsx` | Diff of one file in Roboto Mono: coloured "+" and "-" lines, muted hunk headers, binary and cut notes | `specs/diff-view.md` |
| ChangesTab | UI component | `src/web/git/ChangesTab.tsx` | Changed files in the groups "Staged" and "Unstaged" with kind labels; a click shows the file diff | `specs/changes-tab.md` |
| useHistory | frontend hook | `src/web/git/history-store.ts` | History of a repository root in pages: idle, loading, loaded with "load more", error | `specs/history-store.md` |
| useCommitFiles | frontend hook | `src/web/git/commit-files-store.ts` | Files of one commit: loading, loaded, error | `specs/commit-files-store.md` |
| HistoryTab | UI component | `src/web/git/HistoryTab.tsx` | Commit rows with short hash, subject, author and date; "Load more"; "No commits yet"; opens the commit detail | `specs/history-tab.md` |
| CommitDetail | UI component | `src/web/git/CommitDetail.tsx` | Full message and changed files of a commit with kind labels; a click shows the file diff | `specs/commit-detail.md` |
