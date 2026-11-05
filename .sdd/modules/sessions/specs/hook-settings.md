---
module: sessions
component: HookSettings
type: configuration
---

# HookSettings

**Purpose** → a Claude Code settings file with hooks only. Each hook forwards its event to the client server, so the client knows the state of every session.

## Contract

- `writeHookSettings(serverUrl, dir?) → Promise<path>` → writes `hook-settings.json` and returns its absolute path.
  - `dir` missing → a new private folder under the system temp folder (`ai-client-hooks-*`).
  - the file has mode `0600`.
- `buildHookSettings(serverUrl)` → the file content. It has only the key `hooks`:

| Event | Matcher |
|-------|---------|
| `UserPromptSubmit` | none |
| `PreToolUse` | `*` |
| `PostToolUse` | `*` |
| `PermissionRequest` | `*` |
| `Notification` | `permission_prompt\|elicitation_dialog\|idle_prompt` (matched on `notification_type`) |
| `Stop` | none |

- every event has one hook: `{ type: "command", command: hookCommand(serverUrl), timeout: 10 }`.
- `hookCommand(serverUrl)` → `'<node>' '<forwarder>' '<serverUrl>'`, each part single-quoted for the shell. `<node>` is the Node.js executable of the server. `<forwarder>` is the absolute path of `hook-forwarder.mjs`.

Forwarder (`node <forwarder> <serverUrl>`):

- reads the whole stdin (the hook input JSON).
- environment variable `AI_CLIENT_SESSION_ID` set → `POST <serverUrl>/api/sessions/<AI_CLIENT_SESSION_ID>/hook-events`, header `content-type: application/json`, body = stdin unchanged. It gives up after 3 seconds.
- `AI_CLIENT_SESSION_ID` or `serverUrl` missing → posts nothing.
- always exits with code `0` and writes nothing to stdout or stderr. Also when the server does not answer.

How a test fires a hook without the real CLI: run `hookCommand(serverUrl)` in `sh`, with `AI_CLIENT_SESSION_ID=<client session id>` and the event JSON on stdin. Or post the same body to HookEventRoute directly.

## Rules and invariants

- The file is written outside every project and outside `~/.claude`. Claude Code reads it only through `--settings`.
- A hook never changes Claude's behavior: exit `0` and empty output mean "no decision" for every event.
- The hooks are synchronous, so events reach the server in the order Claude fires them.

## Dependencies

- HookEventRoute (the target of the forwarder)

## Requirements served

- `plan-claude_sessions_client/REQ-14`
