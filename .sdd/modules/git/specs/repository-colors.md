---
module: git
component: repositoryColor
type: frontend function
---

# repositoryColor

**Purpose** → gives each repository of the repository list its colour.

## Contract

- `REPOSITORY_COLOR_TOKENS` → the palette: 6 theme tokens, `--repo-color-1` to `--repo-color-6`.
- `repositoryColor(index) → string` → `var(<token>)` of the token at `index` modulo 6.
  - `0` → `var(--repo-color-1)`, `5` → `var(--repo-color-6)`, `6` → `var(--repo-color-1)` again.

## Rules and invariants

- Each token has a dark value and a light value (`data-theme='light'`). Both look modes use them.
- Dark values: sky, emerald, amber, pink, violet, orange. Light values: darker shades of the same hues, readable on the light surfaces.

## Requirements served

- `plan-multi_repo_workspace/REQ-7`
