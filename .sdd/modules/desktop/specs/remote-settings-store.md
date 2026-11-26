---
module: desktop
component: RemoteSettingsStore
type: backend service
---

# RemoteSettingsStore

**Purpose** → keeps the remote notification settings of the desktop app in a JSON file: the remote switch, the topic URL and the token.

## Contract

- `RemoteSettings` → `{ enabled: boolean, topicUrl: string, token: string }`.
- `DEFAULT_REMOTE_SETTINGS` → `{ enabled: false, topicUrl: '', token: '' }`.
- `parseRemoteSettings(value: unknown) → RemoteSettings | undefined`
  - an object with `enabled` a boolean, `topicUrl` a string and `token` a string → a new object with only these three fields.
  - anything else (a missing field, a wrong type, `null`, not an object) → `undefined`.
- `new RemoteSettingsStore(filePath)` → the store of that file. It does not touch the file.
- `read() → Promise<RemoteSettings>`
  - the file holds JSON that `parseRemoteSettings` accepts → those settings.
  - no file, a file it cannot read, bad JSON or a bad shape → `DEFAULT_REMOTE_SETTINGS`. It never rejects.
- `save(settings) → Promise<void>`
  - writes the three fields as JSON to the file, and creates its folder when it is missing.
  - after the save the file has mode `0600`, also when it existed before with another mode.
  - saves run one after the other, in call order: after quick saves the file holds the last one, as valid JSON.
  - a failed write rejects. A later save still runs.

## Rules and invariants

- `read()` after a `save(settings)` gives `settings`, also in a new store of the same file (a restart).
- The store does not check the topic URL. It keeps any string.

## Requirements served

- `plan-remote_notifications/REQ-5`, `plan-remote_notifications/REQ-12`, `plan-remote_notifications/REQ-13`
