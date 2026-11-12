---
module: app
component: newerVersionOf
type: backend function
---

# newerVersionOf

**Purpose** → tells whether a release tag is a newer version than the installed one.

## Contract

- `newerVersionOf(tag, installedVersion) → string | null`
  - a version → `MAJOR.MINOR.PATCH`, three whole numbers. The tag may start with one `v`, which is ignored.
  - the tag version is strictly higher than the installed version → the tag version without the `v` (e.g. `v0.2.0` → `"0.2.0"`).
  - equal or lower → `null`.
  - the tag or the installed version in any other form (pre-release suffix, build suffix, two or four parts, empty) → `null`.

```
compare MAJOR, then MINOR, then PATCH, as numbers (0.10.0 > 0.9.0)
the first part that differs decides
```

## Requirements served

- `plan-update_check/REQ-4`
