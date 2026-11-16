---
batch: shared-shapes
feature: Shared shapes (all themes)
closed_req: [REQ-3, REQ-4, REQ-5]
depends: []
---

# Batch shared-shapes

Reference mock: `.sdd/mockups/dark_blue_theme/mock.html`. It sets the shapes and sizes. In Light and
Dark the colours stay the theme's own.

This batch adds the role tokens and shape tokens that the next batches use. It also gives the mock's
shapes to the screens and dialogs that the mock does not show. REQ-1 and REQ-2 start here and close in
batch session-view.

Mapping of the mock's surface levels to Light and Dark (REQ-2). "Role" is the new token. "Level" is
the existing ThemeTokens level it takes.

| Role (mock use) | Level in Light and Dark |
|-----------------|-------------------------|
| canvas and rail | `--bg-canvas` |
| session list | `--bg-surface-1` |
| title bar, session header, bottom bar | `--bg-surface-1` |
| card | `--bg-surface-2` |
| raised surface and pill | `--bg-surface-2` |
| active card | `--bg-surface-3` |
| subtle / strong border, accent | `--border-subtle` / `--border-strong`, `--accent-primary` family |

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | Add role tokens for the mock's surface levels, borders and accent. Map them in the dark and light sets as in the table above. | REQ-1, REQ-2 | — |
| INT-2 | modify | `src/web/theme/tokens.css` | Add shape tokens shared by all themes: the mock's corner radii (5, 7, 8 px), pill border and the card and frame shadows. `--font-ui` and `--font-mono` stay Roboto Flex and Roboto Mono. | REQ-1, REQ-3, REQ-5 | — |
| INT-3 | modify | `src/web/theme/windows11.css` | Map the role tokens to the Windows 11 levels with the same rule. The Windows 11 look keeps its own 4 px and 8 px corners. | REQ-2 | INT-1 |
| INT-4 | modify | `src/web/styles.css` | The shared classes (`.vx-surface-*`, `.mono-chip`, `.kbd-badge`, `.accent-pill`, `.button-*`, `.field-*`) take the mock's radii, borders and pill shape from the new tokens. | REQ-1, REQ-3 | INT-1, INT-2 |
| INT-5 | modify | `src/web/styles.css` | The keyboard focus ring stays visible on every role surface in Light and Dark. Cards and frames do not clip it. | REQ-4 | INT-1 |
| INT-6 | modify | `src/web/dialogs/Dialog.tsx` | Frame, header and footer take the mock's radius, border, shadow and raised surface role. | REQ-3 | INT-4 |
| INT-7 | modify | `src/web/settings/SettingsDialog.tsx`, `src/web/settings/SettingsPane.tsx`, `src/web/settings/ChoiceCard.tsx` | Menu items, choice cards and the update card take the shared radii, borders and surface roles. | REQ-3 | INT-4 |
| INT-8 | modify | `src/web/plan-usage/PlanUsagePopover.tsx`, `src/web/newer-version/NewerVersionNotice.tsx`, `src/web/NeedsInputSnackbar.tsx` | The floating panels take the mock's 8 px corners, border and shadow. | REQ-3 | INT-4 |
| INT-9 | modify | `src/web/folders/ProjectList.tsx`, `src/web/history/ResumeDialog.tsx` | Project rows and past-session rows take the card radius, border and surface role of the session cards. | REQ-3 | INT-4 |
| INT-10 | modify | `src/web/external/ConversationView.tsx`, `src/web/git/GitExplorerPanel.tsx` | Messages, tool cards and the git panel take the shared radii, borders, pills and surface roles. | REQ-3 | INT-4 |

## Human acceptance

### Scenario: dialogs and panels share the new shapes in Light and Dark

- REQ → REQ-3, REQ-5
- Given → the client in the Dark theme, with a session open
- When → the user opens Settings, then the Resume dialog, then the Plan Usage panel
- Then → each one shows the mock's corners, borders and pills in the Dark colours, with the same fonts as before
- And → in the Light theme the same views show the same shapes in the Light colours

### Scenario: the keyboard focus stays visible

- REQ → REQ-4
- Given → the client in the Light theme, then in the Dark theme
- When → the user moves through the controls of the page and of the Settings popup with Tab
- Then → every focused control shows a visible focus ring that no corner cuts
