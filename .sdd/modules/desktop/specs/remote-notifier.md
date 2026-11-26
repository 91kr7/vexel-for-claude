---
module: desktop
component: RemoteNotifier
type: backend service
---

# RemoteNotifier

**Purpose** → on a "send" of the RemoteRule, reads the remote settings and posts the remote notification. A failure only writes one log line.

## Contract

- `sendRemoteNotification(send, { settings, publish, now?, log? }) → Promise<void>`
  - `send` → a `RemoteSend` of the RemoteRule.
  - `settings.read()` → the RemoteSettings (RemoteSettingsStore).
  - `publish(target, message)` → `publishToNtfy` (NtfyPublisher).
  - `now()` → the current time in milliseconds. Default `Date.now`.
  - `log(line)` → one line of the main process output. Default: standard error.

  ```
  settings = settings.read()
  switch off, or topic URL empty  → nothing: no publish, no log
  else → publish({ topicUrl, token }, remoteNotificationMessage(send.event, now() - send.receivedAt))
         sent                     → no log
         failed                   → log "Remote notification not sent: <reason>"
  read or publish rejects         → log "Remote notification not sent: unexpected error."
  ```

## Rules and invariants

- It never rejects.
- At most one log line per send. The line holds no token, no request header and no error text.
- No retry: a failed send is not sent again.
- It uses no Electron API.

## Dependencies

- RemoteRule, RemoteNotificationText, RemoteSettingsStore, NtfyPublisher

## Requirements served

- `plan-remote_notifications/REQ-19`, `plan-remote_notifications/REQ-20`, `plan-remote_notifications/REQ-29`, `plan-remote_notifications/REQ-34`, `plan-remote_notifications/REQ-37`, `plan-remote_notifications/REQ-38`, `plan-remote_notifications/REQ-39`
