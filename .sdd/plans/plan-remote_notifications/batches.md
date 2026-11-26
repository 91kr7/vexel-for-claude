---
slug: remote_notifications
date: 2026-11-26
status: validated
---

# Batches — Remote notification to the phone through ntfy

Requirements → `requirements.md`. Execution order: notifications-section → test-notification → remote-notification.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [notifications-section](batches/batch-notifications-section.md) | Notifications section | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | implemented | The user sets up the remote notification |
| [test-notification](batches/batch-test-notification.md) | Test notification | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18 | notifications-section | todo | The test notification reaches the phone |
| [remote-notification](batches/batch-remote-notification.md) | Remote notification | REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39 | test-notification | todo | The phone shows the command Claude wants to run |

## Assumptions and decisions

- **The Electron main process owns the remote settings and sends.** It keeps them in a file of the user data folder, mode `0600`. The page reads and saves them through the DesktopBridge. Details → batch notifications-section, decision "Where the settings live"; batch test-notification, decision "The main process sends".
- **JSON publish.** Every message is a JSON `POST` to the root of the ntfy server. Details → batch test-notification, decision "Publish format".
- **Detail only for hosted sessions.** The hook events give the command and the questions. External sessions get "Needs your input" (human decision of 2026-11-26). Details → batch remote-notification, decisions "Waiting detail" and "External sessions".
- **Gatekeeper decisions.** The switch lock, the test button with the switch off, the settings read at the end of the count, and no grouping. They are in `requirements.md`, section "Assumptions".
- **Tests.** The checks that need the desktop window go in the Electron e2e group (knowledge base `electron-e2e-separate`). The tests post to a local fake ntfy server, never to ntfy.sh.
- **Indexes and specs.** For every "modify" the indexes and specs gave the place. No source file was opened.

## Risks

- The token is in plain text in the settings file. Only the user's account can read the file. Gatekeeper decision of 2026-11-26: accepted, so the app needs no keyring.
- On ntfy.sh, anyone who knows the topic name reads the commands and the questions (spec, "Risks").
- A failed send is silent. Only the test button shows a problem (spec, "Risks").

## Departures

None.

## Coverage check

- Every REQ is served by at least one INT:
  - notifications-section → REQ-1 to REQ-4 (INT-8), REQ-5 (INT-1, INT-6), REQ-6 (INT-5, INT-6), REQ-7, REQ-8 (INT-6), REQ-9 (INT-5, INT-6), REQ-10 (INT-7), REQ-11 (INT-2, INT-3, INT-4, INT-6), REQ-12 (INT-1, INT-2, INT-3, INT-4), REQ-13 (INT-1, INT-8).
  - test-notification → REQ-14 (INT-5), REQ-15 (INT-1, INT-2, INT-3, INT-4), REQ-16 (INT-2, INT-5), REQ-17 (INT-1, INT-2, INT-5), REQ-18 (INT-1).
  - remote-notification → REQ-19 (INT-5, INT-7), REQ-20 (INT-7), REQ-21 to REQ-25 (INT-5), REQ-26 (INT-7), REQ-27 (INT-5), REQ-28 (INT-5, INT-7), REQ-29 (INT-7), REQ-30 (INT-6), REQ-31, REQ-32 (INT-1, INT-2, INT-3, INT-4, INT-6), REQ-33 (INT-3, INT-6), REQ-34 to REQ-36 (INT-6), REQ-37 to REQ-39 (INT-8).
- Every INT serves at least one REQ. There is no enabling INT.
- Every REQ closes in one batch. REQ-29 and REQ-39 reuse the publisher of test-notification, which sends the token and keeps it out of its reasons. They close in remote-notification.
