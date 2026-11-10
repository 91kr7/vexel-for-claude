---
module: git
component: GitRunner
type: backend service
---

# GitRunner

**Purpose** → the only component of the server that runs git. It runs read-only commands only.

## Contract

- `new GitRunner(gitPath = "git")` → `gitPath` is the git program to run.
- `run(folder, args) → stdout text`
  - runs `git --no-optional-locks <args>` with `folder` as working folder.
  - rejects with `GitCommandRejected` when `args` is not a read command (see the rules). Git does not run.
  - rejects with `GitError`, whose `kind` is:
    - `not_installed` → the git program cannot be started and `folder` exists. Message "git is not installed."
    - `folder_not_found` → `folder` does not exist. Message "The folder does not exist."
    - `failed` → git exits with a non-zero code. Message → git's error output, trimmed (the process error text when git wrote none). `exitCode` → the exit code.
    - `timeout` → git runs for more than 10 s. The process is stopped. Message "git did not answer within 10 s."
    - `output_too_large` → the output is larger than 5 MB. Message "The git output is larger than 5 MB."
- `isReadCommand(args) → boolean` → the check that `run` applies.

## Rules and invariants

- Read commands (the fixed list) → the first argument is one of:
  - `rev-parse`, with any arguments;
  - `symbolic-ref`, with at most one non-option argument and without `-d` or `--delete` (the read form; a second ref would write HEAD).
- No argument may start with `--output`, for any command.
- Every run passes `--no-optional-locks` and `GIT_OPTIONAL_LOCKS=0`: git does not write the index or take its lock.
- Git runs with `LC_ALL=C`, so its messages are in English, and with `GIT_TERMINAL_PROMPT=0`. No `GIT_*` variable of the server environment reaches git.
- Later batches add their read commands to the list; a command that can write is never added.

## Requirements served

- `plan-git_explorer/REQ-2`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-8`
