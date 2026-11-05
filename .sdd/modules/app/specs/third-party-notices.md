---
module: app
component: ThirdPartyNotices
type: document
---

# ThirdPartyNotices

**Purpose** → the record of every font, icon set or image the client takes from another project.

## Contract

- One entry per font or icon set, with: the files in the repository, the source project, the package and version it came from (or where it was taken, when no version is recorded), and the licence.
- Each entry names the path of its licence file in the repository.

## Rules and invariants

- Every file from another project that the client ships has an entry here.
- Every licence file named here exists in the repository.

## Dependencies

- BundledFont
- IconSet

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-7`
