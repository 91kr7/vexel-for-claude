---
id: push-with-gh-auth
kind: guideline
scope: any
date: 2026-11-23
source: pull request #39 (fix/flaky-tests)
---

# Push through the authentication of gh, not of git

**Rule** → Push branches with the GitHub authentication of `gh`, which is already logged in. Plain `git push` has no credentials on this machine and fails.

**Why** → The human: "non devi usare git ma gh per pushare, perché è già autenticato". On 2026-11-23 `git push` failed with `could not read Username for 'https://github.com'`.

**How to apply** →
- push: `git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin <branch>`. It takes the token from `gh` for this command only.
- never change the git configuration to store credentials (no `gh auth setup-git`, no credential store) unless the human asks for it.
- everything else on GitHub (pull requests, merges, releases) goes through `gh` as before.
