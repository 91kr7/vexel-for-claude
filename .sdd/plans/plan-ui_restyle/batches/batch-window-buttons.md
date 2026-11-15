---
batch: window-buttons
feature: Window buttons (desktop app, macOS look)
closed_req: [REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11]
depends: []
---

# Batch window-buttons

Requirements: `.sdd/plans/plan-ui_restyle/requirements.md`. Request mock: `.sdd/mockups/ui_restyle/mock.html`. The mock sets the look only, never the scope.

"macOS look" is the current look (`look: 'vexel'`) of WindowButtons. The Windows 11 look lives in `src/web/theme/windows11.css`, and this batch does not touch that file.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` (`--window-*`) | Set close `#e0443c`, minimize `#e8b616`, maximize `#25b033`. The values are the same in both themes. | REQ-5 | — |
| INT-2 | modify | `src/web/styles.css` (`.window-button`, current look only) | Make each button a flat 12px circle with a solid colour, 8px apart. Add the border `box-shadow: 0 0 0 0.5px color-mix(<colour> 45%, #fff)`. No gradient, gloss or shadow at rest. | REQ-4, REQ-6, REQ-7, REQ-11 | INT-1 |
| INT-3 | modify | `src/web/styles.css` (`.window-button`, current look only) | Keep all symbols visible while the pointer is over the group. On the hovered button: `filter: brightness(1.08)` and glow `0 0 8px 1px color-mix(<colour> 60%, transparent)` added to the border, `transition` 0.2s. `:active` → `brightness(.85)`. | REQ-8, REQ-9, REQ-10, REQ-11 | INT-2 |
| INT-4 | modify | `e2e/window-buttons.spec.ts`, `e2e/windows-look.spec.ts` | Check the computed styles: size, gap, colours, border, no shadow at rest, glow and brightness on hover, darker on press. Check that the Windows 11 buttons keep their current styles. | REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11 | INT-1, INT-2, INT-3 |

Notes:
- `<colour>` stands for the `--window-*` token of each button.
- Keep each test in its current group. A new test that launches Electron goes only in the Electron group (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: The macOS-style window buttons are flat and glow under the pointer

- REQ → REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10
- Given → the desktop app is open in the current look
- When → the user moves the pointer over the green button and presses it
- Then → at rest the three circles are flat, small, with a thin light border; under the pointer all symbols show, the green one gets brighter with a soft green glow, and it gets darker while pressed

### Scenario: The Windows 11 window buttons do not change

- REQ → REQ-11
- Given → the desktop app is open in the Windows 11 look
- When → the user moves the pointer over the window buttons
- Then → the buttons look and react as before this change
