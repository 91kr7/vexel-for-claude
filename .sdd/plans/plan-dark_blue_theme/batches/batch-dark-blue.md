---
batch: dark-blue
feature: Dark Blue theme
closed_req: [REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42]
depends: [shared-shapes, window-frame, session-cards, session-view]
---

# Batch dark-blue

Reference mock: `.sdd/mockups/dark_blue_theme/mock.html`. Its colours apply only to Dark Blue. The
colour table is in REQ-36 of `requirements.md`. Each colour goes to the role token of batch
shared-shapes with the same use.

Decisions for this batch:
- the theme value is `dark-blue`. It uses the same mark (`data-theme`) and the same storage key as
  today. Its `color-scheme` is `dark`.
- the theme of the first start becomes Dark Blue (human decision, 2026-11-16). A saved theme still
  wins. Existing unit and e2e tests that expect Light with no saved theme are in this batch's test
  scope and must be updated, e.g. those of ThemeStore, WebEntry, ThemeSection and the e2e setup of
  the stored theme.
- the `toggle-theme` shortcut row keeps its keys. Its action text becomes "Light/Dark/Dark Blue theme".
- in the Windows 11 look, Dark Blue keeps its own colours. The Windows 11 dark colours apply only to
  Dark.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/theme-store.ts` | `Theme` and `isTheme` accept `dark-blue`. A new `setTheme(theme)` marks, saves and notifies. `toggle()` cycles Light, Dark, Dark Blue. Both save every theme. | REQ-31, REQ-32, REQ-34 | — |
| INT-2 | modify | `src/web/index.html` | The first-paint script accepts any valid saved theme, `dark-blue` included, and marks it before the first paint. | REQ-32, REQ-33 | — |
| INT-13 | modify | `src/web/theme/theme-store.ts` | `START_THEME` becomes `dark-blue`. | REQ-35 | INT-1 |
| INT-14 | modify | `src/web/index.html` | With no valid saved theme, the first-paint script marks `dark-blue`. The `color-scheme` meta of the HTML becomes `dark`, so the first start shows no light flash. A valid saved theme still wins. | REQ-32, REQ-33, REQ-35 | INT-2 |
| INT-3 | modify | `src/web/theme/tokens.css` | Add the Dark Blue set on `data-theme="dark-blue"`: the REQ-36 colours on the role and level tokens, and its accent family. | REQ-36 | — |
| INT-4 | modify | `src/web/theme/tokens.css` | Dark Blue text tones in the mock's slate, status tones in emerald, amber, rose and the mock's ended tone. Each text tone reaches 4.5:1, with the least change to a mock value. | REQ-37, REQ-41 | INT-3 |
| INT-5 | modify | `src/web/theme/tokens.css` | Dark Blue terminal tokens: `#11141C` background, frame and focus ring from the mock. Light and Dark keep theirs. The ANSI palette does not change. | REQ-38, REQ-39 | INT-3 |
| INT-6 | modify | `src/web/theme/tokens.css` | Add the preview tokens of Dark Blue for its choice card. | REQ-30 | INT-3 |
| INT-7 | modify | `src/web/styles.css` | Dark Blue `color-scheme` `dark`, form controls as in the mock, and rounded scrollbar thumbs in `#2E3546`. | REQ-40 | INT-3 |
| INT-8 | modify | `src/web/styles.css` | The keyboard focus ring stays visible on every Dark Blue surface. | REQ-42 | INT-3 |
| INT-9 | modify | `src/web/sessions/SessionView.tsx` | On a theme change, the open terminal takes the new terminal colours at once, without a new connection. | REQ-31, REQ-38 | INT-5 |
| INT-10 | modify | `src/web/settings/ThemeSection.tsx` | Three cards: "Light", "Dark", "Dark Blue", each with its preview. Choosing a card calls `setTheme`; the active card is checked. | REQ-30, REQ-31 | INT-1, INT-6 |
| INT-11 | modify | `src/web/shortcut-map.ts` | The `toggle-theme` row gets the new action text. | REQ-34 | INT-1 |
| INT-12 | modify | `src/web/theme/windows11.css` | The Windows 11 dark colour set applies only to `data-theme="dark"`. Dark Blue keeps its colours in that look. | REQ-36 | INT-3 |

## Human acceptance

### Scenario: the user switches to Dark Blue

- REQ → REQ-30, REQ-31, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42
- Given → the client in the Dark theme, with a working session open and the list scrolled
- When → the user chooses "Dark Blue" in Settings > Appearance
- Then → the whole client takes the mock's colours at once, the terminal included, and the "Dark Blue" card is checked. The session keeps running and the list keeps its scroll position.
- And → text, status colours, scrollbars and focus rings are readable, and Claude Code output keeps its colours

### Scenario: Dark Blue is remembered with no flash

- REQ → REQ-32, REQ-33
- Given → the user chose Dark Blue
- When → the user restarts the client
- Then → the client shows Dark Blue from the first frame, with no flash of another theme

### Scenario: any chosen theme is still there after a desktop restart

- REQ → REQ-32, REQ-33
- Given → the desktop app, where the user chose Light in Settings > Appearance
- When → the user quits and starts the desktop app again
- Then → the client shows Light from the first frame, with no flash of Dark Blue
- And → the same holds for Dark, and for a browser reload

This scenario launches Electron: its test goes in the Electron e2e group (knowledge base
`electron-e2e-separate`). The browser part goes in the default e2e run.

### Scenario: the shortcut cycles three themes

- REQ → REQ-34, REQ-35
- Given → a first start with no saved theme
- When → the user presses the theme shortcut three times
- Then → the client starts in Dark Blue with no flash, then shows Light, Dark and Dark Blue again
