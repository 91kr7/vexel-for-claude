---
request_slug: update_check
date: 2026-11-12
type: evolution
size: narrow
reference: .sdd/analysis/desktop_app.md
---

# Analysis — Installed version and newer version notice

## Request

> voglio che all'avvio l'applicazione vada a verificare se su github esiste una versione più nuova di quella attualmente presente e nel caso mostri un avviso all'utente in merito alla disponibilità di una versione più recente!

> da qualche parte sarebbe il caso di scrivere la versione installata!!

## Reference

[desktop_app.md](desktop_app.md) → the client runs as a desktop app or as a browser page. Today the user installs it by hand. Its scope leaves out automatic updates (line 86).

Changes:
- At each launch, the application checks GitHub for a newer published version.
- When one exists, the application shows a notice to the user.
- The top bar shows the installed version.
- Download and install stay out of scope.

## Summary

The top bar always shows the installed version. At launch, the application also checks whether GitHub has a newer release than the installed version. If it does, the application shows a notice with a link to that release.

## Requirements

### Functional

- At each launch, the application must check the project's GitHub repository for the latest published release.
- The check must apply to both ways of using the application: the desktop window and the browser page.
- The check must run once per launch.
- A release counts only when it is published, not a draft and not a pre-release.
- The application must show the notice only when that release has a higher version number than the installed version.
- The notice must show the installed version and the newer version.
- The notice must offer a link that opens the release page in the browser.
- The user must be able to close the notice.
- A closed notice must come back at the next launch while a newer version still exists.
- When GitHub cannot be reached or refuses the request, the application must show nothing and work normally.
- In both the desktop window and the browser page, the top bar must always show the installed version, right after the application name "Vexel for Claude".
- The top bar and the notice must show the same installed version.

### Non-functional

- The check must never delay or block the launch, or the display of the session list.
- The check must send GitHub no data about the user or the sessions, and must use no credentials.
- The installed version in the top bar must show without network access and without waiting for the check.

## Assumptions

- A "newer version" is a published GitHub Release with a higher version number. The orchestrator decided this from `SECURITY.md` ("the latest release") and the tag `v0.1.0`.
- The repository is public, so the check needs no credentials. The orchestrator decided this from `README.md` and `CONTRIBUTING.md`.
- The check covers the application however it starts: desktop window or browser page. The orchestrator decided this, because the request says "l'applicazione" with no limit.
- A launch is the start of the desktop app or of the server for the browser page.
- When the installed version is higher than the latest release, for example a development build, the application shows no notice.
- The top bar shows the version in the form of the release tags, for example `v0.2.2`.

## Risks

- GitHub limits requests without credentials. Many launches in a short time can make the check fail. The silent-failure requirement covers this.
- If a release does not set the installed version number to the release number, the top bar shows a wrong version and the notice compares wrong numbers. Knowledge base `release-bumps-package-version` prevents this.

## Scope

In scope:
- One check per launch against the GitHub releases of the project.
- The notice, with versions, a link to the release page, and a close action.
- The installed version in the top bar, after the application name.

Out of scope:
- Automatic download or install of the new version.
- Periodic checks while the application keeps running.
- A setting to turn the check off.
- Remembering a closed notice across launches.
