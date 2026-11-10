# Module git

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| GitRunner | backend service | `src/server/git/git-runner.ts` | Runs read-only git commands of a fixed list, with `--no-optional-locks`, a 10 s timeout and a 5 MB output cap; git errors with their message | `specs/git-runner.md` |
| lookupRepository | backend function | `src/server/git/repository-lookup.ts` | Repository root and branch (or detached hash) of a folder, or "none" | `specs/repository-lookup.md` |
| RepositoryRoute | REST endpoint | `src/server/git/repository-route.ts` | `GET /api/git/repository`: the repository lookup of a folder path | `specs/repository-route.md` |
| useRepositoryLookup | frontend hook | `src/web/git/repository-lookup-store.ts` | Repository lookup of the open session folder, once per folder: loading, repository, none, error | `specs/repository-lookup-store.md` |
| GitExplorerButton | UI component | `src/web/git/GitExplorerButton.tsx` | Header icon button "Git Explorer" that opens and closes the panel, shown for a repository or a git error | `specs/git-explorer-button.md` |
| GitExplorerPanel | UI component | `src/web/git/GitExplorerPanel.tsx` | Right panel of the session content: repository name with its path as tooltip, branch chip, git error | `specs/git-explorer-panel.md` |
