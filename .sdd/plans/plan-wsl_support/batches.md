---
slug: wsl_support
status: validated
---

# Batches — Port the WSL support branch to main

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [failed-notifications](batches/batch-failed-notifications.md) | Failed system notifications | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6 | — | certified | A failed notification gives one log line and the app keeps working |
| [ended-external-sessions](batches/batch-ended-external-sessions.md) | Ended external sessions | REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15 | — | implemented | A closed terminal leaves an ended entry in the list |
| [windows-look](batches/batch-windows-look.md) | Windows 11 look | REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40 | — | todo | The user switches to the Windows 11 look and back |
| [lock-file](batches/batch-lock-file.md) | Lock file | REQ-41 | — | implemented | The lock file names the project license |

Execution order: the four batches share no file and depend on no other batch. They run in the table order.

## Assumptions and decisions

The gatekeeper validated the coverage on 2026-11-13. It accepted three items below as gatekeeper decisions: "Ended external entries in the scanner", "No notification change for ended external entries", and the `resume` shortcut acting once through ConversationView (`batch-ended-external-sessions/INT-9`).

- **Port, not rewrite.** Each batch ports the branch code for its feature and adapts it to main. The branch started before release 0.3.0, so every batch keeps the existing tests green, the project list actions included.
- **Placement of the new components.** The look store and the Windows 11 stylesheet go in `src/web/theme`, beside ThemeStore and ThemeTokens. The look switch goes in `src/web`, beside ThemeSwitch. This is the placement of the branch, and it follows `.archi`.
- **Ended external entries in the scanner.** ExternalSessionScanner keeps the ended external entries. It uses `SessionStateTracker.liveClaudeSessionIds()` to drop an entry that was resumed in the client. DismissSessionRoute and ResumeEndedSessionRoute fall back to the scanner when the tracker has no such id. This follows the files the branch touches.
- **No notification change for ended external entries.** AttentionMonitor already gives no session-end event for external sessions, so REQ-14 needs no INT there. A test checks it.
- **Electron tests.** Tests that open the desktop window run in the Electron e2e group only (knowledge base `electron-e2e-separate`).

## Departures

None. The two earlier REQs that change (`plan-session_list_improvements/REQ-3`, `plan-mac_title_bar/REQ-15`) change because the spec asks it.

## Coverage check

Every REQ is served by at least one INT, and every INT serves at least one REQ. No enabling INT. Each REQ closes in one batch.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1, REQ-2, REQ-3, REQ-4 | batch-failed-notifications/INT-1 | failed-notifications |
| REQ-5, REQ-6 | batch-failed-notifications/INT-2 | failed-notifications |
| REQ-7 | batch-ended-external-sessions/INT-1 | ended-external-sessions |
| REQ-8 | batch-ended-external-sessions/INT-1, INT-3 | ended-external-sessions |
| REQ-9 | batch-ended-external-sessions/INT-3, INT-4, INT-6, INT-7 | ended-external-sessions |
| REQ-10 | batch-ended-external-sessions/INT-5, INT-6, INT-7 | ended-external-sessions |
| REQ-11 | batch-ended-external-sessions/INT-8, INT-9 | ended-external-sessions |
| REQ-12 | batch-ended-external-sessions/INT-2, INT-5, INT-6 | ended-external-sessions |
| REQ-13 | batch-ended-external-sessions/INT-8, INT-9 | ended-external-sessions |
| REQ-14, REQ-15 | batch-ended-external-sessions/INT-1 | ended-external-sessions |
| REQ-16 | batch-windows-look/INT-1 | windows-look |
| REQ-17 | batch-windows-look/INT-3, INT-5 | windows-look |
| REQ-18 | batch-windows-look/INT-7, INT-9 | windows-look |
| REQ-19 | batch-windows-look/INT-6, INT-7 | windows-look |
| REQ-20, REQ-21, REQ-22 | batch-windows-look/INT-1 | windows-look |
| REQ-23 | batch-windows-look/INT-2 | windows-look |
| REQ-24 | batch-windows-look/INT-1, INT-2 | windows-look |
| REQ-25, REQ-26, REQ-27 | batch-windows-look/INT-3 | windows-look |
| REQ-28 | batch-windows-look/INT-6, INT-8, INT-9 | windows-look |
| REQ-29, REQ-30, REQ-31 | batch-windows-look/INT-8 | windows-look |
| REQ-32, REQ-33 | batch-windows-look/INT-9 | windows-look |
| REQ-34 | batch-windows-look/INT-5, INT-8 | windows-look |
| REQ-35 | batch-windows-look/INT-9 | windows-look |
| REQ-36, REQ-37, REQ-38 | batch-windows-look/INT-4 | windows-look |
| REQ-39 | batch-windows-look/INT-7, INT-8 | windows-look |
| REQ-40 | batch-windows-look/INT-8 | windows-look |
| REQ-41 | batch-lock-file/INT-1 | lock-file |

INT → REQ, batch by batch:

- failed-notifications → INT-1: REQ-1 to REQ-4. INT-2: REQ-5, REQ-6.
- ended-external-sessions → INT-1: REQ-7, REQ-8, REQ-14, REQ-15. INT-2: REQ-12. INT-3: REQ-8, REQ-9. INT-4: REQ-9. INT-5: REQ-10, REQ-12. INT-6: REQ-9, REQ-10, REQ-12. INT-7: REQ-9, REQ-10. INT-8, INT-9: REQ-11, REQ-13.
- windows-look → INT-1: REQ-16, REQ-20, REQ-21, REQ-22, REQ-24. INT-2: REQ-23, REQ-24. INT-3: REQ-17, REQ-25, REQ-26, REQ-27. INT-4: REQ-36, REQ-37, REQ-38. INT-5: REQ-17, REQ-34. INT-6: REQ-19, REQ-28. INT-7: REQ-18, REQ-19, REQ-39. INT-8: REQ-28 to REQ-31, REQ-34, REQ-39, REQ-40. INT-9: REQ-18, REQ-28, REQ-32, REQ-33, REQ-35.
- lock-file → INT-1: REQ-41.
