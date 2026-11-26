---
batch: notifications-section
feature: Notifications section
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13
depends: —
---

# Batch — Notifications section

The "Sound" menu of the settings popup becomes "Notifications". It keeps the sound switch and adds the remote notification settings: the remote switch, the topic URL and the token. "Updates" moves to the end of the menu. This batch sends nothing yet: the test button and the remote notification come in the next batches.

## What this batch builds

- **Remote settings store** (desktop area) → keeps the remote switch, the topic URL and the token in a file of the desktop app.
- **Topic URL check** (web frontend, settings area) → accepts a topic URL or gives the reason it rejects it.
- **Remote notification section** (web frontend, settings area) → the remote switch and the two fields, under the sound switch.

## Decisions

- **Where the settings live.** In a JSON file in the Electron user data folder, with mode `0600`, owned by the Electron main process. The main process sends the remote notification in batch remote-notification, also before the page loads, so it must own the values. The page reads and saves them through the DesktopBridge. The sound switch stays in `localStorage`, as it is today (REQ-13).
- **Defaults.** Nothing saved → remote switch off, topic URL empty, token empty (REQ-5).
- **Menu order.** "Appearance", "Shortcuts", "Processes", "Notifications", "Updates". In a browser: "Appearance", "Shortcuts", "Processes", "Updates". So "Processes" moves before "Updates" (knowledge base `settings-updates-last`).
- **Notifications panel.** Title "Notifications". The body holds SoundSection, unchanged, then the Remote notification section.
- **Controls.**
  - The remote switch (`role="switch"`) is labelled "Send a remote notification after 60 seconds of waiting".
  - The field "Topic URL" has the placeholder `https://ntfy.sh/your-topic`.
  - The field "Access token (optional)" is `type="password"` (REQ-8).
  - Every control works with the keyboard and shows the focus ring, like the other controls of the popup.
- **Topic URL.** The check accepts an address that `URL` can parse, with the `http:` or `https:` scheme, a host, and a last path segment that is a topic name: 1 to 64 letters, digits, `-` or `_`. A sub-path before the topic is allowed, for an ntfy server behind a proxy. The reasons, in English:
  - not an address, or another scheme → "Enter an http or https address."
  - no topic segment → "Add the topic name at the end of the address."
  - bad topic characters → "The topic name may use only letters, digits, - and _."
  - An empty field shows no reason. The remote switch stays disabled.
- **Switch lock.** The remote switch is disabled while the topic URL is empty or invalid. If the URL turns empty or invalid while the switch is on, the section saves the switch off (`requirements.md`, assumption "Topic URL becomes invalid").
- **Save at once.** Each change of a control saves the three values at once. There is no "Save" button, like the rest of the popup.
- **Desktop only.** The browser has no DesktopBridge, so it shows no "Notifications" menu, as it showed no "Sound" menu.
- **IPC from the window only.** The main process answers a read or a save only from the web contents of its window, like the open-session report.
- **Tests.** Vitest covers the store (defaults, save, read again, file mode), the URL check (every reason), the section (switch lock, switch off on a broken URL, password field, save on change) and the menu order of SettingsDialog with and without the bridge. The Electron e2e group checks that the values survive a restart of the desktop app (knowledge base `electron-e2e-separate`). The default browser e2e run checks the browser menu order with "Updates" last.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area | Remote settings store: reads and saves the remote switch, the topic URL and the token in a JSON file of the Electron user data folder, mode `0600`. Defaults of decision "Defaults". No IPC. | REQ-5, REQ-12, REQ-13 | — |
| INT-2 | modify | `src/desktop/main.ts` | Answer the read and the save of the remote settings on two new IPC channels, through the store. Only for the web contents of the window. | REQ-11, REQ-12 | INT-1 |
| INT-3 | modify | `src/desktop/desktop-bridge.cts` | Add the read and the save of the remote settings, with `ipcRenderer.invoke` on the channels of INT-2. | REQ-11, REQ-12 | — |
| INT-4 | modify | `src/web/desktop-bridge.ts` | Pass on the read and the save of the remote settings. No bridge → none. | REQ-11, REQ-12 | INT-3 |
| INT-5 | create | web frontend, settings area | Topic URL check of decision "Topic URL": accepted, or rejected with its reason. | REQ-6, REQ-9 | — |
| INT-6 | create | web frontend, settings area | Remote notification section: the controls of decision "Controls", loaded through INT-4. The reason of INT-5 shows under the URL field. Each change saves at once through INT-4. | REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-11 | INT-4, INT-5 |
| INT-7 | create | web frontend, settings area (section of INT-6) | Switch lock of the section: the rule of decision "Switch lock". | REQ-10 | INT-6 |
| INT-8 | modify | `src/web/settings/SettingsDialog.tsx` | Rename the "Sound" item and panel to "Notifications". Its body is SoundSection then the section of INT-6. Order of decision "Menu order"; arrow keys and Tab follow it. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-13 | INT-6 |

The developer updates the specs of DesktopApp, DesktopBridge, useDesktopBridge and SettingsDialog. They write the specs of the remote settings store, the topic URL check and the remote notification section, and update the indexes.

## Human acceptance

### Scenario: The user sets up the remote notification

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-11, REQ-13
- Given → the desktop app runs with this version for the first time, and the settings popup is open
- When → the user opens "Notifications", types `https://ntfy.sh/my-topic` in "Topic URL" and a token in "Access token (optional)", then turns the remote switch on
- Then → the menu reads "Appearance", "Shortcuts", "Processes", "Notifications", "Updates", the token shows as dots, and the remote switch is on
- And → the sound switch is still on, as before

### Scenario: A wrong topic URL is rejected

- REQ → REQ-9, REQ-10
- Given → the remote switch is on with a valid topic URL
- When → the user changes the topic URL to `ftp://ntfy.sh/my-topic`
- Then → "Enter an http or https address." shows under the field, and the remote switch turns off and cannot be turned on

### Scenario: The settings stay after a restart

- REQ → REQ-12
- Given → the user set a topic URL and a token, and turned the remote switch on
- When → the user quits the desktop app and starts it again
- Then → "Notifications" shows the same topic URL, a token as dots, and the remote switch on
