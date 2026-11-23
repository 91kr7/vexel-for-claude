---
id: pr-to-main-then-release
kind: guideline
scope: any
date: 2026-11-18
source: release of v1.2.1
---

# Feature branches reach main through a pull request; releases start from main

**Rule** → Every branch of work goes to `main` on GitHub through a pull request. A release is made from `main` after that merge, never from a branch that is not merged.

**Why** → The human: "le branch di feature su cui lavori dovresti portarle su main e rilasciare da li via pull request!!!". On 2026-11-18 v1.1.1 was tagged on a release branch before its pull request was merged, and local merges made the local `main` differ from GitHub.

**How to apply** →
- orchestration: the reintegration of a cycle is a pull request of its branch into `main`, merged once its CI is green. This replaces the local `git merge` into `main` of the closing step of `/sdd-auto`: `main` on GitHub accepts changes only through pull requests. Never merge into the local `main`; keep it equal to `origin/main`.
- release: set the version on a branch, open its pull request, merge it into `main`, then tag and publish the release on that commit of `main` (with the complete e2e suite green, `e2e-green-before-release`).
- never cherry-pick the same change onto two branches; merge the branch that holds it.

## Steps of a reintegration

This entry refines `.claude/sdd/conventions/branching.md` ("Reintegration") and the closing step of `/sdd-auto` without changing those files. Where they say "merge into `main`", do this:

1. Open the branch from `origin/main`, after `git fetch`. The local `main` stays equal to `origin/main`.
2. When the work is complete, push the branch with the authentication of `gh` (`push-with-gh-auth`): `git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin <branch>`.
3. Open the pull request: `gh pr create --base main --head <branch>`.
4. Wait for its CI. Red → the work is not complete: fix it on the branch and push again.
5. Merge it with a merge commit and delete its source branch (`delete-merged-branch`): `gh pr merge <number> --merge --delete-branch`.
6. Update the local `main`: `git pull --ff-only origin main`, then run the build on `main`.

- Manual commands → ask the human before step 5. `/sdd-auto` → step 5 without asking, once every batch is `certified`, the suites are green and the CI is green.
- The pull request cannot be merged (a conflict, a blocked merge) → never force it: report it to the human and stop.
- Release → after step 6, tag and publish on the commit of `main` that sets the version.
