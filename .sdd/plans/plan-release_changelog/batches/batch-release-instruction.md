---
batch: release-instruction
feature: Changelog instruction for releases
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6]
depends: []
---

# Batch — release-instruction

Requirements: `.sdd/plans/plan-release_changelog/requirements.md`.

## Decisions for this batch

- **File.** A new `CLAUDE.md` at the repository root. The project has none today. The user's global `~/.claude/CLAUDE.md` stays untouched (analysis, Assumptions).
- **Language of the file** → English, like the other repository documents.
- **Release procedure in the file**, in this order:
  1. Set `version` in `package.json` with `npm version <x.y.z> --no-git-tag-version`, then commit and push (REQ-6, knowledge base entry `release-bumps-package-version`).
  2. Write the changelog from the changes since the previous release tag.
  3. Create the tag and the GitHub Release on that commit, with the changelog as the release description.
- **Changelog headings** → "New features", "Changes", "Fixes". An empty group is left out.
- **Changelog markup** → headings, bullet lists, bold, italic, inline code and links only. No images and no raw HTML. The notice of batch `notice-changelogs` renders this subset.
- **No code changes.** The tester checks the file against the REQs of this batch.

## What this batch builds

- **Project `CLAUDE.md`** → tells the assistant how to publish a release of this project, changelog included.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | repository root, project instructions for the assistant | Release procedure for a release requested by the human. It covers the `package.json` version step and the changelog step: since the previous release, for the users, in English, grouped by kind, in the markup above. The changelog becomes the GitHub Release description. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6 | — |

## Human acceptance

### Scenario: A requested release carries a changelog

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6
- Given → the repository has the new `CLAUDE.md`, and some features and fixes were merged since the last release
- When → the human asks the assistant for release `v0.5.0`
- Then → the GitHub Release `v0.5.0` has an English description, with the changes since `v0.4.0` grouped under "New features", "Changes" and "Fixes"
- And → `package.json` on the release commit says `0.5.0`
