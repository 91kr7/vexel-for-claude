---
batch: settings-popup
feature: Settings popup
closed_req: [REQ-1, REQ-2, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20]
depends: []
---

# Batch settings-popup — Settings popup

Requirements → `.sdd/plans/plan-settings_dialog/requirements.md`. REQ-3 starts here and closes in batch shortcuts-section.

## What this batch builds

- **Settings popup** → the modal "Settings" dialog with one tab per section. This batch gives it the "Theme" and "Window Look" tabs.
- **Settings button** → the gear button at the bottom of the navigation rail that opens the popup.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/icons/Icons.tsx` | Add the Lucide "settings" gear icon as a decorative component, like the other Lucide icons. | REQ-1 | — |
| INT-2 | create | frontend, app area (dialogs) | Settings popup on the shared Dialog: title "Settings", no primary action, so the footer has "Close" only. A tab list "Theme", "Window Look" shows one section at a time. A prop sets the tab shown on open. | REQ-5, REQ-6, REQ-7, REQ-8, REQ-10, REQ-11, REQ-19, REQ-20 | — |
| INT-3 | create | frontend, app area, in the popup | "Theme" section: a radio group "Light" / "Dark" checked on the active theme of ThemeStore (`useTheme`). Choosing the other radio calls `toggleTheme()`. | REQ-12, REQ-14, REQ-15 | INT-2 |
| INT-4 | create | frontend, app area, in the popup | "Window Look" section: a radio group "macOS" / "Windows 11" checked on the active look of LookStore (`useLook`). Choosing the other radio calls `toggleLook()`. | REQ-13, REQ-14, REQ-15 | INT-2 |
| INT-5 | create | frontend, app area | Settings button: an icon button with the gear icon, accessible name "Settings", tooltip "Settings". A click opens the popup on the "Theme" tab. | REQ-1, REQ-3, REQ-4 | INT-1 |
| INT-6 | modify | `src/web/AppLayout.tsx` | Remove the `.list-panel-footer` and the settings button from the list panel. Give the NavigationRail the action that opens the popup on the "Theme" tab. Keep the open state and the start tab of the popup, and show it over the page like the other dialogs. | REQ-1, REQ-4, REQ-9, REQ-18 | INT-2, INT-11 |
| INT-7 | modify | `src/web/TopBar.tsx` | Remove the ThemeSwitch and the LookSwitch. The drag area of the desktop window stays at every width. | REQ-16, REQ-17 | — |
| INT-8 | modify | `src/web/ThemeSwitch.tsx` | Delete the component. Nothing else uses it after INT-7. | REQ-16 | INT-7 |
| INT-9 | modify | `src/web/LookSwitch.tsx` | Delete the component. Nothing else uses it after INT-7. | REQ-16 | INT-7 |
| INT-10 | modify | `src/web/SettingsButton.tsx` | Give the button the style of the other rail buttons: 34 × 34 px, gear icon at 17 px, hover and focus as "Resume", and the rail tooltip. The accessible name and the tooltip text stay "Settings". | REQ-1, REQ-3 | — |
| INT-11 | modify | `src/web/NavigationRail.tsx` | Show the SettingsButton at the bottom of the rail, below "Resume", apart from the top group. A new prop calls the open action. It stays visible at every window height. | REQ-1, REQ-2, REQ-4 | INT-10 |

Notes for the implementer:

- The popup is a Dialog, so it has `aria-modal="true"`. useShortcutKeys then runs no shortcut while it is open (REQ-19). Do not give it the class `shortcuts-panel`.
- The theme shortcut (Alt+A) keeps calling ThemeStore `toggle` in AppLayout. Removing the ThemeSwitch must not change it (REQ-18).
- The look choice is offered in the browser too. In the browser a change of look shows no window buttons, as today.
- On Ubuntu nothing else changes: the default theme and the default look stay as today.
- Tests that use the top bar switches today move to the popup. The drag area check of REQ-17 runs in the Electron e2e group only (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: The user changes the theme and the look from the settings

- REQ → REQ-1, REQ-2, REQ-4, REQ-5, REQ-6, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-20
- Given → a hosted session is open in the dark theme and the macOS look, in a low window with the session list scrolled down
- When → the user clicks the gear button "Settings" at the bottom of the navigation rail, below "Resume", then chooses "Light" on the "Theme" tab and "Windows 11" on the "Window Look" tab
- Then → the popup stays open and the whole client, popup included, turns light with the Windows 11 look at once, with the new choices checked
- And → the session keeps running, and the list keeps its scroll position

### Scenario: The user closes the settings and finds the focus where it was

- REQ → REQ-7, REQ-8, REQ-19
- Given → the settings popup is open from the keyboard, with the focus on the settings button before it opened
- When → the user presses Alt+N, then Esc
- Then → Alt+N opens nothing, and Esc closes the popup with the focus back on the settings button

### Scenario: The top bar has no theme or look switch

- REQ → REQ-16, REQ-17, REQ-18
- Given → the client is open in the desktop window
- When → the user looks at the top bar and presses Alt+A
- Then → the top bar shows no theme switch and no look switch, and the theme changes
- And → dragging the empty part of the top bar still moves the window
