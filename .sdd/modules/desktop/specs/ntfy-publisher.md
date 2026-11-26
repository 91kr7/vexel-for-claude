---
module: desktop
component: NtfyPublisher
type: backend service
---

# NtfyPublisher

**Purpose** → posts one message to an ntfy topic and gives the result: sent, or failed with a short English reason.

## Contract

- `NtfyTarget` → `{ topicUrl: string, token: string }`.
- `NtfyMessage` → `{ title: string, message: string, priority?: number }`. No priority → 3, the ntfy default.
- `PublishResult` → `{ status: 'sent' }` or `{ status: 'failed', reason: string }`.
- `PUBLISH_TIMEOUT_MS` → 10,000.
- `publishToNtfy(target, message, timeoutMs = PUBLISH_TIMEOUT_MS) → Promise<PublishResult>`
  - request: one `POST` to the root of the server, with `Content-Type: application/json` and the body `{ topic, title, message, priority }`.
    - the topic is the last path segment of the topic URL. The root is the origin plus the path up to that segment, without query and fragment.
    - e.g. `https://host/base/my-topic?x=1` → `POST https://host/base/` with `topic` `my-topic`.
  - a non-empty token → header `Authorization: Bearer <token>`. An empty token → no `Authorization` header.
  - result:

    ```
    topic URL not http(s), not a URL, or no last segment → failed "The topic URL is not valid." (no request)
    status 2xx                    → sent
    status 401 or 403, with token → failed "The server refused the access token."
    status 401 or 403, no token   → failed "The server needs an access token."
    status 429                    → failed "The server limits the number of messages. Try again later."
    any other status              → failed "The server answered with status <code>."
    no answer within timeoutMs    → failed "The server did not answer within 10 seconds."
    network error                 → failed "Could not reach the server."
    ```

  - it never rejects.

## Rules and invariants

- A reason never holds the token, the request headers, the body or the text of an error.
- Non-ASCII text in the title and the message reaches the server intact (UTF-8 JSON).
- It uses no Electron API.

## Requirements served

- `plan-remote_notifications/REQ-15`, `plan-remote_notifications/REQ-17`, `plan-remote_notifications/REQ-18`
