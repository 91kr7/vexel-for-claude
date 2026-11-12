---
slug: update_check
date: 2026-11-12
spec: .sdd/analysis/update_check.md
status: validated
---

# Requirements — update_check

A launch is the start of the desktop app, or the start of the server for the browser page (analysis, Assumptions).

## Feature: Newer version notice

| ID | Requirement |
|----|-------------|
| REQ-1 | At each launch, the application asks the project's GitHub repository for its latest release. |
| REQ-2 | The check runs once per launch. A page reload or a new browser tab does not run it again. |
| REQ-3 | Only a published release counts. Drafts and pre-releases are ignored. |
| REQ-4 | The application shows the notice only when the latest release has a higher version number than the installed version. |
| REQ-5 | The notice shows the installed version and the newer version. |
| REQ-6 | The notice offers a link that opens the release page in the browser. |
| REQ-7 | The user can close the notice. |
| REQ-8 | A closed notice shows again at the next launch while a newer version still exists. |
| REQ-9 | When GitHub cannot be reached or refuses the request, the application shows no notice and no error, and works normally. |
| REQ-10 | The check and the notice work in the desktop window and in the browser page. |
| REQ-11 | The check never delays or blocks the launch, or the display of the session list. |
| REQ-12 | The request to GitHub carries no credentials and no data about the user or the sessions. |

## Feature: Installed version in the top bar

| ID | Requirement |
|----|-------------|
| REQ-13 | In the desktop window and in the browser page, the top bar always shows the installed version in the form of the release tags, for example `v0.2.2`, right after the application name "Vexel for Claude". |
| REQ-14 | The top bar and the notice show the same installed version number. |
| REQ-15 | The top bar shows the installed version without network access and without waiting for the check of REQ-1. |
