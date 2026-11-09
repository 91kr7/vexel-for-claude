---
batch: shortcuts-panel
feature: Shortcuts panel
closed_req: [REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45, REQ-46]
depends: [navigation, session-actions]
---

# Batch shortcuts-panel — Shortcuts panel

The requirements are in `.sdd/plans/plan-keyboard_shortcuts/requirements.md`. Read the assumptions "Key map", "Panel content", "Panel shape" and "Button text".

Batches `navigation` and `session-actions` built the shortcut map, the key handler and the command channel. Their paths are in `.sdd/modules/app/index.md`. This batch adds the last key, so the rules REQ-34 to REQ-46 close here, for every shortcut of the plan.

## What this batch builds

- **Shortcuts button** → the keyboard icon button beside the Light/Dark switch. It opens and closes the panel.
- **Shortcuts panel** → the dialog that lists every shortcut by area, read from the shortcut map.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/icons/Icons.tsx` | Adds the Lucide "keyboard" icon as a decorative SVG component. | REQ-22 | — |
| INT-2 | modify | `src/web/dialogs/Dialog.tsx` | The primary action becomes optional. Without it, the footer shows only the close button, with the text "Close", and Enter adds nothing. | REQ-29, REQ-33 | — |
| INT-3 | create | frontend, module app, beside TopBar | Shortcuts button: the ThemeSwitch look with the keyboard icon, accessible name and tooltip of the "Button text" assumption. A press opens the panel, or closes it when it is open. | REQ-22, REQ-23, REQ-24, REQ-29 | INT-1 |
| INT-4 | create | frontend, module app, beside AppLayout | Shortcuts panel: a Dialog titled "Keyboard Shortcuts", with the groups "Navigation", "Sessions", "Terminal" and "General" built from the shortcut map. Each row shows the keys in `.kbd-badge` badges, then the action. | REQ-26, REQ-27, REQ-28, REQ-32, REQ-33 | INT-2 |
| INT-5 | modify | `src/web/TopBar.tsx` | Shows the shortcuts button right before the ThemeSwitch, 6 px apart, `no-drag` in the desktop window. The button stays above the dialog backdrop, visible and clickable, like the WindowButtons. | REQ-22, REQ-24, REQ-29 | INT-3 |
| INT-6 | modify | the shortcut map of batch `navigation` (path in `.sdd/modules/app/index.md`) | Adds the panel row (General). Adds the existing terminal keys as rows of the Terminal group: SessionView keeps handling them, and the key handler does not run them. | REQ-25, REQ-26, REQ-28, REQ-34, REQ-35, REQ-36, REQ-37, REQ-39, REQ-40, REQ-44, REQ-45 | — |
| INT-7 | modify | the key handler of batch `navigation` (path in `.sdd/modules/app/index.md`) | The panel shortcut also acts when the shortcuts panel is the open dialog, and closes it. Any other open dialog still blocks every shortcut. | REQ-25, REQ-29, REQ-42 | INT-6 |
| INT-8 | modify | `src/web/AppLayout.tsx` | Holds the open state of the panel. The button and the panel shortcut toggle it, and Esc closes it. The Dialog gives the focus back. The open session and its view stay mounted under the panel. | REQ-24, REQ-25, REQ-29, REQ-30, REQ-31 | INT-4, INT-5, INT-7 |

Notes:

- The panel reads the same map as the key handler. A test checks that every row of the panel runs its action, and that every key the handler takes has a row (REQ-26, REQ-28).
- REQ-38 → the desktop app needs no change: its menu bar stays hidden also on Alt, and its menu keys use Ctrl (`.sdd/modules/desktop/specs/desktop-app.md`). A check of a few Alt keys in the desktop window goes in the Electron e2e group (`npm run test:e2e:desktop`), not in the default e2e run (knowledge base `electron-e2e-separate`).
- REQ-31 → the panel is a dialog over the page. It must not unmount or resize the SessionView or the ConversationView.

## Human acceptance

### Scenario: The user opens the shortcuts panel and finds every shortcut

- REQ → REQ-22, REQ-24, REQ-26, REQ-27, REQ-32
- Given → the client shows the light theme
- When → the user clicks the keyboard button beside the Light/Dark switch
- Then → the "Keyboard Shortcuts" panel opens in light colours, with the groups Navigation, Sessions, Terminal and General
- And → each row shows its keys in keyboard badges, then its action in English

### Scenario: The user opens and closes the panel without losing the session

- REQ → REQ-25, REQ-29, REQ-30, REQ-31, REQ-33
- Given → a hosted session is working, its terminal is scrolled up, and the terminal has the focus
- When → the user presses Alt+S
- Then → the panel opens with a visible focus inside it, and the session keeps working behind it
- And → Esc closes the panel, and the terminal has the focus again at the same scroll position

### Scenario: The button shows its shortcut

- REQ → REQ-23, REQ-29
- Given → the panel is open
- When → the user clicks the keyboard button again
- Then → the panel closes
- And → with the pointer over the button, the tooltip "Keyboard Shortcuts (Alt+S)" shows

### Scenario: Every key of the panel works

- REQ → REQ-28, REQ-44
- Given → a hosted session is open and its terminal has the focus
- When → the user presses Ctrl+Shift+F, one of the Terminal rows of the panel
- Then → the terminal search box opens, as before this plan

### Scenario: The shortcuts work the same in the desktop app on an Italian keyboard

- REQ → REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-45, REQ-46
- Given → the desktop app runs with the Italian layout, and a hosted terminal has the focus
- When → the user presses Alt+Down
- Then → the next session opens at once, as in the browser, and no desktop or window action starts

### Scenario: A client key never reaches Claude Code

- REQ → REQ-39, REQ-40
- Given → a hosted session waits at its prompt, and its terminal has the focus
- When → the user presses Alt+S, then Esc
- Then → the prompt shows no new character, and Claude Code does not react

### Scenario: Another dialog blocks every shortcut

- REQ → REQ-42, REQ-43
- Given → the resume history dialog is open
- When → the user presses Alt+S
- Then → the shortcuts panel does not open, and the history dialog keeps the focus

### Scenario: A text field keeps its editing keys

- REQ → REQ-41
- Given → the "Session Name" field of an entry holds a name, with the focus in it
- When → the user presses Ctrl+A, then types "api"
- Then → the field holds only "api", as in any text field
