---
batch: startup-page
feature: Startup screen (desktop app)
closed_req: [REQ-36, REQ-37, REQ-38, REQ-39, REQ-40]
depends: [top-bar, window-buttons]
---

# Batch startup-page

Requirements: `.sdd/plans/plan-ui_restyle/requirements.md`. Request mock: `.sdd/mockups/ui_restyle/mock.html`. The mock sets the look only, never the scope.

The startup screen is the page the desktop window shows before the client page. It always uses the client's light theme. It cannot import `src/web`, so it repeats the values of the top bar and of WindowButtons in its own inline styles.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/desktop/startup-page.ts` (bar style) | Set the bar height to 44px instead of 48px. Keep the buttons 14px from the left edge and centred in the bar height, as in the client top bar. | REQ-36, REQ-40 | — |
| INT-2 | modify | `src/desktop/startup-page.ts` (window button style, rest) | Colours `#e0443c`, `#e8b616`, `#25b033` in flat 12px circles, 8px apart. Border `box-shadow: 0 0 0 0.5px color-mix(<colour> 45%, #fff)`. No gloss or shadow at rest. Symbols in black at 60%. | REQ-37, REQ-39, REQ-40 | — |
| INT-3 | modify | `src/desktop/startup-page.ts` (window button style, hover and press) | Hovered button: `filter: brightness(1.08)` and glow `0 0 8px 1px color-mix(<colour> 60%, transparent)` added to the border, `transition` 0.2s. `:active` → `brightness(.85)`. Use the same values as `.window-button` in `src/web/styles.css`. | REQ-38, REQ-40 | INT-2 |
| INT-4 | modify | `src/desktop/startup-page.test.ts` | Check in the HTML: bar height 44px, the new colours, the border, no shadow at rest, the hover and press rules, symbols at 60% black. Check that the Content-Security-Policy and its script hash still match. | REQ-36, REQ-37, REQ-38, REQ-39 | INT-1, INT-2, INT-3 |
| INT-5 | create | e2e tests, Electron group, desktop window area | With the startup screen and then with the client page, measure the bar height and the place, size and colour of the three buttons. They must be equal. | REQ-40 | INT-1, INT-2, INT-3 |

Notes:
- `<colour>` stands for the colour of each button.
- The page changes only its inline styles. If the inline script changes, its SHA-256 hash in the Content-Security-Policy changes too.
- INT-5 launches Electron, so it goes only in the Electron group, never in the default e2e run (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: Nothing moves when the desktop app finishes loading

- REQ → REQ-36, REQ-37, REQ-39, REQ-40
- Given → the backend is not running yet
- When → the user opens the desktop app and waits until the client page shows
- Then → during the wait the bar and the three flat window buttons look as in the client, and the bar height and the buttons do not change when the client page appears

### Scenario: The startup window buttons glow under the pointer

- REQ → REQ-38
- Given → the desktop app shows the startup screen
- When → the user moves the pointer over the red button and presses it
- Then → the button gets brighter with a soft red glow, and it gets darker while pressed
