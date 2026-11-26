---
batch: test-notification
feature: Test notification
closed_req: REQ-14, REQ-15, REQ-16, REQ-17, REQ-18
depends: notifications-section
---

# Batch — Test notification

A "Send test notification" button in the "Notifications" section sends a short message to the topic. The section then shows that the message was sent, or why it failed.

## What this batch builds

- **ntfy publisher** (desktop area) → posts one message to the ntfy topic, with the token when set, and gives the result. Batch remote-notification reuses it.

## Decisions

- **The main process sends.** The page asks for the test through the DesktopBridge. The main process reads the remote settings store and posts with Node `fetch`. So the page needs no CORS support on the ntfy server, and the token stays out of the page's network calls.
- **Publish format.** One `POST` of a JSON body to the root of the ntfy server. The body holds `topic`, `title`, `message` and `priority` ([ntfy publish](https://docs.ntfy.sh/publish/), "Publish as JSON"). The root is the topic URL without its last segment, and the topic is that segment. JSON keeps non-ASCII titles intact, which HTTP headers do not.
- **Token.** When set → header `Authorization: Bearer <token>`. When empty → no header.
- **Time limit.** 10 s. After that the send counts as failed.
- **Reasons.** The publisher gives one short English reason for each failure:
  - 401 or 403 → "The server refused the access token." (with a token) or "The server needs an access token." (without one).
  - 429 → "The server limits the number of messages. Try again later."
  - another status that is not 2xx → "The server answered with status <code>."
  - no answer in 10 s → "The server did not answer within 10 seconds."
  - a network error → "Could not reach the server."
  - A reason never holds the token, the request headers or the body (REQ-18).
- **Test message.** Title "Vexel for Claude", message "Test notification. Remote notifications reach this device.", default priority.
- **Button.** "Send test notification" is under the token field. It is disabled while the topic URL is empty or invalid. It works with the remote switch on or off (`requirements.md`, assumption "Test button and remote switch"). While a test runs, the button is busy and a second press does nothing.
- **Result.** Success → "Test notification sent." in the section. Failure → the reason, with ErrorMessage. The result stays until the next test or until the popup closes.
- **Tests.** Vitest covers the publisher against a local HTTP server: the JSON body, the token header, every reason, the time limit, and no token in any reason. It also covers the section button (disabled, busy, both results). The Electron e2e group sends a test to a local fake ntfy server and checks the result text. The tests never post to ntfy.sh.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area | ntfy publisher: posts one message (title, text, priority) as in decisions "Publish format", "Token" and "Time limit". Gives "sent", or "failed" with a reason of decision "Reasons". No Electron API. | REQ-15, REQ-17, REQ-18 | — |
| INT-2 | modify | `src/desktop/main.ts` | On a test request on a new IPC channel, from the window only: read the remote settings store, publish the message of decision "Test message" through INT-1, and answer with the result. | REQ-15, REQ-16, REQ-17 | INT-1 |
| INT-3 | modify | `src/desktop/desktop-bridge.cts` | Add the test request, with `ipcRenderer.invoke` on the channel of INT-2. | REQ-15 | — |
| INT-4 | modify | `src/web/desktop-bridge.ts` | Pass on the test request and its result. No bridge → none. | REQ-15 | INT-3 |
| INT-5 | modify | remote notification section (batch notifications-section, INT-6) | Add the button of decision "Button". It calls INT-4 and shows the result of decision "Result". | REQ-14, REQ-16, REQ-17 | INT-4 |

The developer updates the specs of DesktopApp, DesktopBridge, useDesktopBridge and the remote notification section. They write the spec of the ntfy publisher and update the indexes.

## Human acceptance

### Scenario: The test notification reaches the phone

- REQ → REQ-14, REQ-15, REQ-16
- Given → the phone has the ntfy app subscribed to the topic, and "Notifications" shows that topic URL with the remote switch off
- When → the user presses "Send test notification"
- Then → "Test notification sent." shows in the section, and the phone shows the test message

### Scenario: A refused token is reported

- REQ → REQ-15, REQ-17, REQ-18
- Given → the topic is protected on the ntfy server, and "Access token (optional)" holds a wrong token
- When → the user presses "Send test notification"
- Then → "The server refused the access token." shows in rose, and the token does not appear in the message
