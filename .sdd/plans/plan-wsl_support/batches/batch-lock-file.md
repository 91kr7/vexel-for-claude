---
batch: lock-file
feature: Lock file
closed_req: [REQ-41]
depends: []
---

# Batch — Lock file

Source: the branch `feature/wsl-support` changes the license field of the root package in `package-lock.json`. Port that change only.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `package-lock.json` | In the root package entry, set `license` to the value of `package.json` (`MIT`). Change no other line, and no dependency version. | REQ-41 | — |

## Human acceptance

### Scenario: The lock file names the project license

- REQ → REQ-41
- Given → the repository after this batch
- When → the user compares `package-lock.json` with main before the batch
- Then → the only change is the license of the root package, the same as in `package.json`
- And → `npm ci` installs the same dependency versions as before
