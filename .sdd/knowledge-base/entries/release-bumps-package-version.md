---
id: release-bumps-package-version
kind: guideline
scope: any
date: 2026-11-12
source: after the update_check cycle, when publishing the v0.2.1 release
---

# A new version updates package.json

**Rule** → When the human asks for a new version, update `version` in `package.json` to that version before publishing it.

**Why** → The human: "stai pubblicando senza aggiornare il package.json!!! … devi aggiornare il package.json quando chiedo una nuova versione". Releases v0.2.0 and v0.2.1 were published while `package.json` still said 0.1.0.

**How to apply** →
- orchestration: set the version with `npm version <x.y.z> --no-git-tag-version` (it keeps `package-lock.json` in step), commit and push it, then create the tag and the GitHub release on that commit. Only an explicit request of the human for that release keeps the old version.
