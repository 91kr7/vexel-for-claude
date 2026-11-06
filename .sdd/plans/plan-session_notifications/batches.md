---
status: validated
---

# Batches — System notifications and tray signal for waiting sessions

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [needs-input-notification](batches/batch-needs-input-notification.md) | Needs-input notification | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | certified | A waiting session alerts the user while the window is closed |
| [turn-end-notification](batches/batch-turn-end-notification.md) | Turn-end notification | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 | needs-input-notification | certified | A finished turn shows the start of Claude's answer |
| [session-end-notification](batches/batch-session-end-notification.md) | Session-end notification | REQ-21, REQ-22, REQ-23, REQ-24 | needs-input-notification, turn-end-notification | certified | A hosted session that dies says so |
| [grouped-notifications](batches/batch-grouped-notifications.md) | Grouped notifications | REQ-25, REQ-26, REQ-27, REQ-28, REQ-29 | turn-end-notification, session-end-notification | certified | A burst of events gives one notification |
| [tray-signal](batches/batch-tray-signal.md) | Tray signal | REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37 | needs-input-notification | todo | The tray lists the sessions that wait |

Execution order: `needs-input-notification`, `turn-end-notification`, `session-end-notification`, `grouped-notifications`, `tray-signal`. `tray-signal` needs only `needs-input-notification`, so it can also run right after it.

## Assumptions and decisions

- **Five batches.** The gatekeeper accepted the five features. `needs-input-notification` builds the notifications. The next two batches add one kind of event each. `grouped-notifications` comes after them, so it groups every kind.
- **"Attention" names the new backend feed** (`batch-needs-input-notification`, decision "Name"). An "event" keeps the meaning that `requirements.md` gives it.
- **The backend detects the events.** Only the backend knows the hook that ended a turn, the transcripts, the exit of a process and who stopped it. A new attention monitor follows SessionStateTracker and ExternalSessionScanner. A new WebSocket route sends its events to the desktop app. The page's routes do not change.
- **The desktop app shows the notifications.** Its main process keeps running when the window is hidden. Pure rules decide what to show, and a thin adapter talks to the Linux desktop. The browser client gets nothing, so it shows no notification.
- **The desktop app reaches the page through a preload.** The page reports its open session, and the desktop app asks it to open a session. The page still has no Node access (rule of DesktopApp).
- **Two rules are repeated in the desktop area.** It imports neither `src/server` nor `src/web`. So the notification texts repeat the folder name rule of `folderNameOf` (Avatar) and the wording "Permission for <tool>" of SessionList.
- **Replace in place may need a new dependency.** Electron's `Notification` probably cannot replace a notification in place on Linux. Then the desktop app talks D-Bus directly (`batch-needs-input-notification`, decision "Mechanism"), and `INT-15` records it in `.sdd/.archi`.
- **A clean exit counts as the user's exit command** (`batch-session-end-notification`, decision "Who stopped the session").
- **External interrupts are read from the transcript** (`batch-turn-end-notification`, decision "Turn end of an external session"). This depends on an internal format of Claude Code, a risk the spec already names.
- **Modify targets created by this plan.** Later batches modify components that `needs-input-notification` creates. Their paths do not exist yet, so the `Where` column names them by component. The developer finds the paths in the indexes.
- **Tests.** Knowledge base entry `electron-e2e-separate`: a test that launches Electron goes only in the Electron group (`npm run test:e2e:desktop`). The rules, texts, monitor and tray logic are tested with Vitest, so real notifications rarely show on the user's display (gatekeeper). The page side is tested in the browser e2e group with a fake bridge.
- **Placement details** of each batch (texts, timings, icon) are in the "Decisions" section of its batch file. On 2026-11-06 the gatekeeper confirmed the texts, the rule "Who stopped the session" and the notification mechanism. These are gatekeeper decisions, not human decisions.

## Departures

None. No human decision contradicts the spec. The decisions on REQ-12 and REQ-29 are gatekeeper decisions that read the spec (see `requirements.md`).

## Coverage check

Every REQ is served by at least one INT. Every INT serves at least one REQ, except one enabling INT.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-needs-input-notification/INT-1`, `INT-3`, `INT-4`, `INT-5`, `INT-11` | needs-input-notification |
| REQ-2 | `batch-needs-input-notification/INT-1`, `INT-5` | needs-input-notification |
| REQ-3 | `batch-needs-input-notification/INT-6`, `INT-11` | needs-input-notification |
| REQ-4 | `batch-needs-input-notification/INT-5`, `INT-6`, `INT-11` | needs-input-notification |
| REQ-5 | `batch-needs-input-notification/INT-1`, `INT-3` | needs-input-notification |
| REQ-6 | `batch-needs-input-notification/INT-1`, `INT-3`, `INT-6` | needs-input-notification |
| REQ-7 | `batch-needs-input-notification/INT-1`, `INT-8` | needs-input-notification |
| REQ-8 | `batch-needs-input-notification/INT-1`, `INT-8` | needs-input-notification |
| REQ-9 | `batch-needs-input-notification/INT-8` | needs-input-notification |
| REQ-10 | `batch-needs-input-notification/INT-9` | needs-input-notification |
| REQ-11 | `batch-needs-input-notification/INT-2`, `INT-3`, `INT-7` | needs-input-notification |
| REQ-12 | `batch-needs-input-notification/INT-7`, `INT-10`, `INT-11`, `INT-13`, `INT-14` | needs-input-notification |
| REQ-13 | `batch-needs-input-notification/INT-9`, `INT-10`, `INT-12`, `INT-13`, `INT-14` | needs-input-notification |
| REQ-14 | `batch-turn-end-notification/INT-1`, `INT-4` | turn-end-notification |
| REQ-15 | `batch-turn-end-notification/INT-1`, `INT-2`, `INT-4` | turn-end-notification |
| REQ-16 | `batch-turn-end-notification/INT-1`, `INT-2`, `INT-3`, `INT-4`, `INT-5` | turn-end-notification |
| REQ-17 | `batch-turn-end-notification/INT-2`, `INT-4`, `INT-5` | turn-end-notification |
| REQ-18 | `batch-turn-end-notification/INT-7` | turn-end-notification |
| REQ-19 | `batch-turn-end-notification/INT-6`, `INT-7` | turn-end-notification |
| REQ-20 | `batch-needs-input-notification/INT-14` | turn-end-notification |
| REQ-21 | `batch-session-end-notification/INT-1`, `INT-2` | session-end-notification |
| REQ-22 | `batch-session-end-notification/INT-1`, `INT-2` | session-end-notification |
| REQ-23 | `batch-session-end-notification/INT-1`, `INT-2`, `INT-3` | session-end-notification |
| REQ-24 | `batch-session-end-notification/INT-4` | session-end-notification |
| REQ-25 | `batch-grouped-notifications/INT-1`, `INT-4` | grouped-notifications |
| REQ-26 | `batch-grouped-notifications/INT-1` | grouped-notifications |
| REQ-27 | `batch-grouped-notifications/INT-2` | grouped-notifications |
| REQ-28 | `batch-grouped-notifications/INT-2` | grouped-notifications |
| REQ-29 | `batch-grouped-notifications/INT-3` | grouped-notifications |
| REQ-30 | `batch-tray-signal/INT-1`, `INT-4`, `INT-5` | tray-signal |
| REQ-31 | `batch-tray-signal/INT-1` | tray-signal |
| REQ-32 | `batch-tray-signal/INT-4`, `INT-5` | tray-signal |
| REQ-33 | `batch-tray-signal/INT-2`, `INT-3`, `INT-5` | tray-signal |
| REQ-34 | `batch-tray-signal/INT-5` | tray-signal |
| REQ-35 | `batch-tray-signal/INT-2`, `INT-3` | tray-signal |
| REQ-36 | `batch-tray-signal/INT-5` | tray-signal |
| REQ-37 | `batch-tray-signal/INT-3` | tray-signal |

- **REQ-20** is served by `batch-needs-input-notification/INT-14`, but it closes in `turn-end-notification`. Before that batch, a notification disappears with its session, so the case cannot happen. The scenario "A click on a gone session only shows the window" checks it.
- **REQ-2 to REQ-7, REQ-12 and REQ-13** close in `needs-input-notification`. The later batches keep them true for their own notifications: they reuse the rules, texts and click path of that batch.
- **Enabling intervention**, which serves no REQ: `batch-needs-input-notification/INT-15` (`.sdd/.archi` update).
