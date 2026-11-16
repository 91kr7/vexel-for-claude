---
module: git
component: RepositoryList
type: UI component
---

# RepositoryList

**Purpose** → names the covered repositories in the header of the git explorer panel.

## Contract

Props:
- `repositories` → the covered repositories of useRepositoryLookup, in list order.

Shows:
- a list named "Repositories", one entry per repository, in the order of `repositories`. Each entry has the full `root` as tooltip and shows:
  - a round colour mark → `repositoryColor(<position in the list>)`;
  - the name;
  - the relative path, in the mono font;
  - the branch chip (the `git-branch` icon and the branch name, or "detached <short hash>");
  - or, for an entry with `error`, the git message in the error colour in place of the chip.
- with many entries the list scrolls inside the header.

Also exports:
- `BranchChip({ branch, className })` → the branch chip alone, as GitExplorerPanel shows it for a single repository.

## Dependencies

- repositoryColor, useRepositoryLookup
- IconSet (module app)

## Requirements served

- `plan-multi_repo_workspace/REQ-7`, `plan-multi_repo_workspace/REQ-9`
