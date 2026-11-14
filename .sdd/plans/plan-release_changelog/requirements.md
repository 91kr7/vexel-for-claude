---
slug: release_changelog
date: 2026-11-14
spec: .sdd/analysis/release_changelog.md
status: validated
---

# Requirements — release_changelog

The notice is the newer version notice of `plan-update_check`. The changelog of a release is the description of its GitHub Release (analysis, Assumptions).

## Feature: Changelog instruction for releases

| ID | Requirement |
|----|-------------|
| REQ-1 | A `CLAUDE.md` at the repository root tells the assistant to write a summary changelog each time the human asks for a release. |
| REQ-2 | The instruction makes the changelog the description of the GitHub Release. |
| REQ-3 | The instruction asks for a changelog that summarizes what changed since the previous release, written for the users of the application. |
| REQ-4 | The instruction asks for a changelog that groups the changes by kind: new features, changes, fixes. |
| REQ-5 | The instruction asks for a changelog in English. |
| REQ-6 | The instruction keeps the release step that sets `version` in `package.json` before the release is published. |

## Feature: Changelogs in the newer version notice

| ID | Requirement |
|----|-------------|
| REQ-7 | The notice shows the changelog of every published release newer than the installed version, up to the latest one. Drafts and pre-releases are excluded. |
| REQ-8 | The notice orders the changelogs from the newest release to the oldest, each under its own version. |
| REQ-9 | The notice shows a changelog as readable text, not as raw markup. |
| REQ-10 | A link inside a changelog opens in the browser. |
| REQ-11 | Text inside a changelog never runs as code in the application. |
| REQ-12 | A long changelog scrolls inside the notice, and the close action and the release link stay reachable. |
| REQ-13 | A release with no description appears in the notice under its version, with no changelog text. |
| REQ-14 | When the changelogs cannot be read, the notice looks as it does today. |
| REQ-15 | The changelogs show in the desktop window and in the browser page. |
| REQ-16 | Reading the changelogs never delays the launch or the display of the session list. |
| REQ-17 | The requests that read the changelogs carry no credentials and no data about the user or the sessions. |
