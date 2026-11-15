---
batch: top-bar
feature: Top bar
closed_req: [REQ-1, REQ-2, REQ-3]
depends: []
---

# Batch top-bar

Requirements: `.sdd/plans/plan-ui_restyle/requirements.md`. Request mock: `.sdd/mockups/ui_restyle/mock.html`. The mock sets the look only, never the scope.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/TopBar.tsx` | Remove the "New Session" button and the `onNewSession` prop. The other controls keep their order. | REQ-2 | — |
| INT-2 | modify | `src/web/AppLayout.tsx` | Stop passing `onNewSession` to TopBar. Keep the rail "+" button and the new-session shortcut as they are. | REQ-2, REQ-3 | INT-1 |
| INT-3 | modify | `src/web/styles.css` (`.top-bar`) | Set the bar height to 44px instead of 48px. In the desktop window, check that the Windows 11 window buttons still fill the bar height. | REQ-1 | — |
| INT-4 | modify | Tests that look for the top bar "New Session" button. Candidates: `e2e/title-bar.spec.ts`, `e2e/studio-dark.spec.ts`, `e2e/plan-usage.spec.ts`, `e2e/installed-version.spec.ts`, `e2e/windows-look.spec.ts`, `e2e/visual-language.spec.ts`, `e2e/english-ui.spec.ts`, `e2e/shortcuts-panel.spec.ts`, `e2e/desktop-window.spec.ts` | Remove or invert the checks on that button. Add checks for: bar height 44px, no "New Session" in the bar, a new session from the rail "+" and from the shortcut. | REQ-1, REQ-2, REQ-3 | INT-1, INT-2, INT-3 |

Notes:
- The "New Session" button of the empty main area (EmptyState) is not part of the top bar. It stays.
- `e2e/desktop-*.spec.ts` files run in the Electron group. Keep each test in its current group (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: The top bar is lower and has no "New Session" button

- REQ → REQ-1, REQ-2, REQ-3
- Given → the page is open, in the browser or in the desktop app
- When → the user looks at the top bar, then clicks the "+" button of the navigation rail
- Then → the bar is 44px high, shows no "New Session" button, and the new-session dialog opens
- And → the new-session keyboard shortcut also opens the dialog
