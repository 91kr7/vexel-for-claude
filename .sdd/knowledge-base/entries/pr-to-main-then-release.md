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
