---
batch: backend-reconnection
feature: Backend reconnection
closed_req: [REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53]
depends: []
---

# Batch — Backend reconnection

Fix of 2026-11-09. Today the page stops trying when it loses the backend, so the error stays until a reload. After this batch the page reconnects by itself. The batch creates no new component.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/live-session-store.ts` | While the store runs, a lost events socket or a failed list load sets `error`, then the store tries a new connection every 2 s. Each new connection loads the list again and replaces it whole, then the status is `ready`. `stop()` ends the attempts. | REQ-46, REQ-47, REQ-48, REQ-52, REQ-53 | — |
| INT-2 | modify | `src/web/sessions/SessionView.tsx` | Connection lost with a code other than `1000` and `4404` → the error stays and the view attaches again every 2 s. On success the error goes, the new snapshot replaces the terminal content, and input and `resize` work again. | REQ-46, REQ-47, REQ-49, REQ-52, REQ-53 | — |
| INT-3 | modify | `src/web/sessions/SessionView.tsx` | An attempt of INT-2 answered with `4404` → no more attempts and no error message. The terminal keeps its content. | REQ-51, REQ-53 | INT-2 |
| INT-4 | modify | `src/web/external/ConversationView.tsx` | The socket closes after the first frame, not by unmount → a new socket every 2 s. The first frame of the new socket replaces the items: no entry shows twice, and old entries do not count as new messages. | REQ-46, REQ-50, REQ-53 | — |
| INT-5 | modify | `src/web/external/ConversationView.tsx` | An attempt of INT-4 answered with `4404` → no more attempts. The items stay, with no error block. | REQ-51, REQ-53 | INT-4 |
| INT-6 | modify | `src/web/AppLayout.tsx` | An open session, hosted or external, that the list reloaded after a reconnection no longer lists → it stays open with its last summary and the state `ended`. Dismiss and resume still close a hosted session, as today. | REQ-51, REQ-53 | INT-1 |
| INT-7 | modify | `src/server/main.ts` | The server starts listening only after one `scan()` of the ExternalSessionScanner has settled, whatever its outcome: a scan that fails or throws does not stop the listen. A page that reconnects to a fresh backend then finds the running external sessions at once. | REQ-48, REQ-50, REQ-51 | — |

## Decisions for this batch

- **Retry every 2 s.** This is the interval of the desktop AttentionClient. One attempt plus the list load stays well under the 5 seconds of REQ-47.
- **Which error.** The backend-disconnected error is the list error "Connection to the server lost. Reload the page." and the open-session error "Connection to the session lost.". Their text and the moment they appear do not change: the spec puts "how the error first appears" out of scope. Gatekeeper decision at coverage validation. ConversationView shows no error after its first frame today, and it still shows none.
- **A backend restart ends the hosted sessions.** The pty processes end with the server, as the spec assumes. So after a real restart the open hosted session is always the case of REQ-51. REQ-49 covers a dropped connection to a backend that kept running.
- **The desktop window needs no desktop code.** It loads the same page from the backend, so INT-1 to INT-6 also serve it (REQ-53). The desktop app does not restart a crashed backend: the spec puts this out of scope.
- **INT-7 and the first scan.** Without it, a fresh backend can answer the list and the conversation stream before its first scan. The page would then mark a running external session as ended.
- **Gatekeeper decisions at requirements validation** (not human decisions):
  - REQ-47 uses 5 seconds, to make "a few seconds" of the spec a yes/no check.
  - REQ-50 is the external-session reading of "accepts input again": the view is read-only, so its live conversation resumes.
  - After a restart, the list shows only what the new backend knows (REQ-48). Only the open session stays on screen, as ended (REQ-51).
- **Gatekeeper decisions at coverage validation** (not human decisions):
  - REQ-49 is checked with a simulated drop, as its scenario says.
  - REQ-53 has one Electron e2e, in the Electron group.
  - A failed first scan does not stop the server from listening (INT-7).
- **Tests.**
  - Vitest for INT-1 to INT-5: a socket that closes, failed attempts, then a successful one.
  - Vitest for INT-7: the server does not listen before the first scan ends.
  - Browser e2e with Playwright WebSocket routing (`page.routeWebSocket`): close the sockets, refuse the attempts, then let them through. A refused attach can answer `4404`.
  - One Electron e2e for REQ-53, in the Electron group only (knowledge base entry `electron-e2e-separate`).

## Human acceptance

The backend runs with `npm start` on port 4001. To stop it, the user presses Ctrl+C in its terminal. To start it again, the user runs `npm start` again.

### Scenario: The page recovers when the backend comes back

- REQ → REQ-46, REQ-47, REQ-48
- Given → the backend stopped 30 seconds ago, and the page on `http://localhost:4001` shows "Connection to the server lost. Reload the page."
- When → the user starts the backend again
- Then → within 5 seconds the error disappears, without a reload
- And → the list and the needs-input count show only the sessions of the new backend

### Scenario: The error follows every disconnection

- REQ → REQ-52
- Given → the page has already recovered once after a backend restart
- When → the user stops the backend again
- Then → the error appears again in the list panel
- And → it disappears again within 5 seconds of the next start

### Scenario: The open session ended during the disconnection

- REQ → REQ-51
- Given → a hosted session is open in the page
- When → the user stops the backend and starts it again
- Then → within 5 seconds the session stays on screen with the state "Ended" and no error message
- And → the session is no longer in the list

### Scenario: The open session reconnects after a dropped connection

- REQ → REQ-49
- Given → a hosted session is open, and its connection drops while the backend keeps running. The automated test simulates the drop: there is no simple manual way to cause it.
- When → the connection is possible again
- Then → within 5 seconds the error disappears and the terminal shows the session again
- And → a message typed in the terminal reaches Claude

### Scenario: An open external session updates live again

- REQ → REQ-50
- Given → an external session is open read-only, and it keeps running in its terminal
- When → the user stops the backend and starts it again
- Then → within 5 seconds a message typed in that terminal appears in the page
- And → no earlier message shows twice

### Scenario: The desktop window recovers too

- REQ → REQ-53
- Given → the backend runs with `npm start`, and the desktop app uses it and shows the list
- When → the user stops the backend and starts it again
- Then → the window shows the error, then the error disappears within 5 seconds, without a reload
