---
module: app
component: RemoteNotificationSection
type: UI component
---

# RemoteNotificationSection

**Purpose** → the remote notification part of the "Notifications" menu of the settings popup: the remote switch, the topic URL, the token and the test notification.

## Contract

Description:
- one card under the SoundSection card: the switch on top, then the two fields, then the test button and its result.

Shows:
- a switch (`role="switch"`) named "Send a remote notification after 60 seconds of waiting", with the look of the sound switch. `aria-checked` follows the saved value.
- a text field "Topic URL" with the placeholder `https://ntfy.sh/your-topic`.
- a field "Access token (optional)" of `type="password"`: the token shows as dots.
- under "Topic URL", the reason of `checkTopicUrl` while the URL is invalid, as an ErrorMessage. The field then has `aria-invalid="true"` and its description is the reason. An empty or valid URL shows no reason.
- a button "Send test notification" under "Access token (optional)".
- at mount it reads the settings with `readRemoteSettings()` (useDesktopBridge). The controls are disabled until the answer arrives, then show it.

Actions:
- click on the switch, or Space or Enter while it has the focus → the switch flips.
- typing in a field → the field shows the new text at once.
- each change of a control → `saveRemoteSettings({ enabled, topicUrl, token })` with the three current values, at once. There is no "Save" button.

Test notification:
- the button is disabled while the topic URL is empty or invalid, and until the settings are read. It works with the switch on or off.
- click → `sendTestNotification()` (useDesktopBridge). Until the answer, the button is disabled, has `aria-busy="true"` and shows a spinner: a second press does nothing.
- a press clears the previous result. Then:
  - `sent` → "Test notification sent." (`role="status"`) under the button.
  - `failed` → the reason under the button, as an ErrorMessage.
  - `null` → no result.
- the result stays until the next press, or until the section unmounts (the popup closes).

Switch lock:
- the switch is disabled while the topic URL is empty or invalid. A click on it changes nothing.
- the URL turns empty or invalid while the switch is on → the switch turns off, and the save of that change has `enabled: false`.
- the settings read at mount have the switch on with an empty or invalid URL → the switch shows off, and the section saves `enabled: false` once.

Keyboard:
- the switch, "Topic URL", "Access token (optional)" and "Send test notification" are Tab stops, in this order, and show the focus ring of the page. A disabled switch or button is no Tab stop.

## Rules and invariants

- the switch is never on while `checkTopicUrl` of the URL is not `valid`.
- the section does not touch the sound switch, and the sound switch does not touch it.
- the section sends nothing to ntfy by itself: only the test button asks the desktop app to send.

## Dependencies

- useDesktopBridge (`readRemoteSettings`, `saveRemoteSettings`, `sendTestNotification`), checkTopicUrl, ErrorMessage

## Requirements served

- `plan-remote_notifications/REQ-5`, `plan-remote_notifications/REQ-6`, `plan-remote_notifications/REQ-7`, `plan-remote_notifications/REQ-8`, `plan-remote_notifications/REQ-9`, `plan-remote_notifications/REQ-10`, `plan-remote_notifications/REQ-11`, `plan-remote_notifications/REQ-13`
- `plan-remote_notifications/REQ-14`, `plan-remote_notifications/REQ-16`, `plan-remote_notifications/REQ-17`
