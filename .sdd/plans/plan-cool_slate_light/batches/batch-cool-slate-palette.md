---
batch: cool-slate-palette
feature: Cool Slate palette
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-12, REQ-15, REQ-16]
depends: []
---

# Batch cool-slate-palette

Table A of `.sdd/plans/plan-cool_slate_light/requirements.md` gives the colours. The mock `.sdd/mockups/cool_slate_light/mock.html` (preset "Cool Slate · Full Light") is binding for the colours only. All colours come from ThemeTokens. Only the Light set changes. Dark and Dark Blue keep every value.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | Light set: canvas, surface levels, glass, borders, text and accent family take the values of table A. Darken muted text only as much as needed to reach 4.5:1 on every light surface (canvas, rail and pill fail today with `#64748b`). | REQ-1, REQ-2, REQ-3, REQ-10, REQ-12, REQ-14, REQ-16 | — |
| INT-2 | modify | `src/web/theme/tokens.css` | Add a role token for each role that table A separates from today's level: rail, pill and progress track, hover surface, context pill. In Dark and Dark Blue each one equals the level it replaces; Light gives the table A value. | REQ-1, REQ-2, REQ-13 | INT-1 |
| INT-3 | modify | `src/web/theme/tokens.css` | Light status tokens: emerald → working, amber → needs input, rose → error and Terminate, zinc → idle, waiting and ended, with the bg, text, dot and border of table A. The orange tokens of "Interrupt" take the warning values in Light. | REQ-4, REQ-5, REQ-13, REQ-14, REQ-15 | INT-1 |
| INT-4 | modify | `src/web/theme/tokens.css` | Light shadows: card and active card shadows of table A. Light native parts: scrollbar thumb and its hover, field background, border and focus ring from table A. | REQ-6, REQ-7, REQ-8, REQ-16 | INT-1 |
| INT-5 | modify | `src/web/theme/tokens.css` | The `--preview-light-*` tokens take canvas, card, main text and accent of table A, so the "Light" card in Settings shows the new colours. | REQ-11 | — |
| INT-6 | modify | `src/web/styles.css` | Rail, pills, progress tracks, hover surfaces and the context pill read the role tokens of INT-2 in place of the level they read today. Change only colour properties: add no border or shadow. | REQ-1, REQ-2, REQ-8, REQ-9, REQ-10, REQ-13 | INT-2 |
| INT-7 | modify | `src/web/theme/windows11.css` | In the Windows 11 look, Light points the new role tokens of INT-2 at its own levels, as it does for the existing role tokens. | REQ-11, REQ-13 | INT-2 |
| INT-8 | modify | `src/desktop/startup-page.ts` | The light values of the startup page take table A: canvas, top bar and its bottom line, text, error, accent of the indicator and of the focus ring. Window buttons keep their colours. | REQ-9, REQ-11, REQ-12 | — |

Notes:

- **Mapping.** INT-1 to INT-4 map each role of table A to the token that paints it today. Where one token serves two roles of table A with different values, INT-2 splits it. Hover and active surfaces, active border and accent pill are the likely cases.
- **Windows 11 look (INT-7).** Gatekeeper decision, 2026-11-20: in the Windows 11 look, Light keeps the colours `windows11.css` sets today. Only the tokens it does not set take table A.
- **Interrupt (INT-3).** Gatekeeper decision, 2026-11-20: in Light "Interrupt" takes the warning colours of table A, amber like needs input.
- **Other style files.** If a role of INT-6 is painted in a style file other than `styles.css`, change it there with the same rule.
- **Invariants of ThemeTokens.** The Light rules of the spec change: new contrast figures, the orange of "Interrupt" equals the amber in Light (REQ-5), and some role tokens have their own Light value. The implementer updates the spec.
- **Contrast.** Each text tone of table A is checked at 4.5:1 on every surface it sits on. Where it fails, change only lightness, as in REQ-14. Inside popups the 60% glass wins (requirements, assumptions).
- **Repository colours, commit graph, diff lines.** They read theme tokens, so they follow. The six repository colours keep their light values.
- **Tests.** Light colour checks in unit and e2e tests move to table A. A desktop check goes only in the Electron e2e group (knowledge base `electron-e2e-separate`). The startup page is checked by a unit test on its HTML.

## Human acceptance

### Scenario: the Light theme shows the Cool Slate colours

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-8, REQ-9, REQ-10, REQ-15
- Given → the browser client in the Light theme, with one working session, one that needs input and one ended
- When → the user opens the working session
- Then → canvas, title bar, rail, session list, cards, pills and text show the colours of the mock, the open card is pale blue with a blue border, and the dots are green, amber and slate; "Interrupt" is amber and "Terminate" is red
- And → no element shows a border, a shadow or a position it did not have before

### Scenario: dialogs, scrollbars and focus follow the palette

- REQ → REQ-7, REQ-11, REQ-14, REQ-16
- Given → the browser client in the Light theme
- When → the user opens Settings on "Appearance" and moves through it with Tab
- Then → the dialog, its scrollbar and its fields use the palette, the "Light" card shows the new colours, and each control shows a blue focus ring

### Scenario: the desktop app shows the same palette

- REQ → REQ-11, REQ-12
- Given → the desktop app with the Light theme saved
- When → the user starts the app
- Then → the startup page and then the client show the colours of the mock

### Scenario: Dark and Dark Blue do not change

- REQ → REQ-13
- Given → the client in the Dark theme
- When → the user switches to Dark Blue and back to Dark
- Then → both themes look exactly as before this batch
