---
id: delete-merged-branch
kind: guideline
scope: any
date: 2026-11-23
source: pull request #39 (fix/flaky-tests)
---

# A closed pull request deletes its source branch

**Rule** → When a pull request is merged or closed, its source branch is deleted, on GitHub and locally.

**Why** → The human: "quando fai la pull request e la chiudi devi rimuovere la branch sorgente".

**How to apply** →
- merge: `gh pr merge <number> --merge --delete-branch`. It deletes the remote branch and the local one, and switches to `main`.
- a pull request closed without a merge: `gh pr close <number> --delete-branch`.
- then update the local `main`: `git pull --ff-only origin main`.
- this replaces "Keep the branch" in step 5 of `pr-to-main-then-release`.
