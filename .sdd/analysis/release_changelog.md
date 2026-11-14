---
request_slug: release_changelog
date: 2026-11-14
type: evolution
size: narrow
reference: .sdd/analysis/update_check.md
---

# Analysis — Release changelog in the newer version notice

## Request

> voglio che venga aggiornato il claude.md indicando di generare un changelog riepilogativo del contenuto della release quando te ne chiedo di generarmene una!e voglio mi mostri il changelog nel popup che avvisa della disponibilità di una nuova versione dell'app

## Reference

[update_check.md](update_check.md) → at launch, the application checks GitHub for a newer published release. If one exists, it shows a notice with the installed version, the newer version, a link to the release page and a close action.

Changes:
- Every new release carries a changelog that summarizes its content.
- A project `CLAUDE.md` tells the assistant to write that changelog when the human asks for a release.
- The notice shows the changelogs of the releases the user does not have yet.

## Summary

When the human asks for a release, the assistant writes a summary changelog and publishes it with the release. The newer version notice shows these changelogs.

## Requirements

### Functional

- A new `CLAUDE.md` at the repository root must tell the assistant to write a summary changelog each time the human asks for a release.
- The instruction must make the changelog the description of the GitHub Release.
- The changelog must summarize what changed since the previous release, written for the users of the application.
- The changelog must be in English.
- The notice must show the changelog of every published release newer than the installed version, up to the latest one.
- The notice must order the changelogs from the newest release to the oldest, each under its own version.
- The notice must show the changelog as readable text, not as raw markup.
- Links inside a changelog must open in the browser.
- A long changelog must scroll inside the notice, and the close action and the release link must stay reachable.
- A release with no description must appear in the notice with no changelog text.
- When the changelogs cannot be read, the notice must look as it does today.

### Non-functional

- Reading the changelogs must not delay the launch or the session list, as the existing check already requires.

## Assumptions

- The user's global `~/.claude/CLAUDE.md` stays untouched (human decision).
- The changelog is the GitHub Release description, because the application already reads that release.
- Releases already published without a changelog keep today's notice with no changelog text.
- Drafts and pre-releases stay excluded, as in `update_check.md`.
- The changelog groups the changes by kind (new features, changes, fixes), because this is the common way to make a summary easy to scan.
- The release procedure keeps the step that updates `package.json` (knowledge base `release-bumps-package-version`). The new instruction adds to that procedure and does not replace it.

## Risks

- A user who skipped many versions gets a long notice. The scroll requirement keeps it usable.
- The changelog comes from the release description. Text in it must not run as code in the application.

## Scope

In scope:
- The project `CLAUDE.md` with the changelog instruction for releases.
- The changelogs of the missing releases in the newer version notice.

Out of scope:
- Rewriting the descriptions of releases already published.
- A changelog view outside the notice, for example a "what's new" page.
- A `CHANGELOG` file in the repository.
- Any other change to the check or to the notice described in `update_check.md`.
