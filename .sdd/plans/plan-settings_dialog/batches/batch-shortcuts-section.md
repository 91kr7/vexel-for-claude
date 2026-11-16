---
batch: shortcuts-section
feature: Shortcuts in the settings
closed_req: [REQ-3, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25]
depends: [settings-popup]
---

# Batch shortcuts-section — Shortcuts in the settings

Requirements → `.sdd/plans/plan-settings_dialog/requirements.md`. Batch settings-popup built the settings popup and the settings button. This batch moves the shortcuts panel into the popup as its third tab.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/ShortcutsPanel.tsx` | Turn the panel into the "Shortcuts" section of the popup. It keeps the same groups, rows and key badges. It loses its own Dialog frame, its "Close" and the `shortcuts-panel` class. | REQ-22, REQ-23, REQ-24 | — |
| INT-2 | modify | `src/web/settings/SettingsDialog.tsx` | Add the "Shortcuts" tab after "Window Look", with the section of INT-1. | REQ-21 | INT-1 |
| INT-3 | modify | `src/web/shortcut-map.ts` | The "general" row "Shortcuts panel" becomes "Shortcut settings", with a new command that opens the popup on the "Shortcuts" tab. The key stays Alt+S. | REQ-25 | — |
| INT-4 | modify | `src/web/shortcut-keys.ts` | Remove the exception for the `shortcuts-panel` dialog. While any dialog is open, every key does nothing, Alt+S included. | REQ-24, REQ-25 | INT-3 |
| INT-5 | modify | `src/web/AppLayout.tsx` | Run the new command of INT-3: open the popup on the "Shortcuts" tab. Remove the shortcuts panel state and its wiring to the TopBar. | REQ-24, REQ-25 | INT-3 |
| INT-6 | modify | `src/web/TopBar.tsx` | Remove the ShortcutsButton and its props. The drag area of the desktop window stays at every width. | REQ-24 | INT-5 |
| INT-7 | modify | `src/web/ShortcutsButton.tsx` | Delete the component. Also delete `KeyboardIcon` of IconSet when nothing else uses it. | REQ-24 | INT-6 |
| INT-8 | modify | `src/web/SettingsButton.tsx` | The tooltip shows the keys of the "Shortcut settings" row of the ShortcutMap: "Settings (Alt+S)". Write no key in the button itself. | REQ-3 | INT-3 |

Notes for the implementer:

- The settings button still opens the popup on the "Theme" tab. Only Alt+S opens it on "Shortcuts".
- Tests of the shortcuts panel move to the "Shortcuts" tab of the popup.

## Human acceptance

### Scenario: Alt+S shows the shortcuts in the settings

- REQ → REQ-3, REQ-21, REQ-22, REQ-23, REQ-25
- Given → the client is open with no dialog, and the pointer is over the settings button, whose tooltip reads "Settings (Alt+S)"
- When → the user presses Alt+S
- Then → the settings popup opens on the "Shortcuts" tab, after "Theme" and "Window Look", with every shortcut grouped under "Navigation", "Sessions", "Terminal" and "General", each with its action and keys

### Scenario: The shortcuts panel is gone from the top bar

- REQ → REQ-24
- Given → the client is open
- When → the user looks at the top bar
- Then → the top bar shows no "Keyboard Shortcuts" button, and no separate shortcuts panel can open
