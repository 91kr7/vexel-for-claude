---
slug: input_sound
date: 2026-11-19
status: validated
---

# Batches — Sound when a session needs input

Requirements → `requirements.md`. Execution order: needs-input-sound → sound-switch.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [needs-input-sound](batches/batch-needs-input-sound.md) | Needs-input sound | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9 | — | implemented | A sound plays when Claude asks for a permission |
| [sound-switch](batches/batch-sound-switch.md) | Sound switch | REQ-10, REQ-11, REQ-12, REQ-13, REQ-14 | needs-input-sound | todo | The user turns the sound off |

## Assumptions and decisions

- **Where the sound plays.** The Electron main process decides, and the page of the desktop window plays the sound. Details → batch needs-input-sound, decisions "The page plays the sound" and "Browser".
- **Where the switch lives.** In the page's `localStorage`, read by the page at each sound request. Details → batch sound-switch, decisions "Storage" and "The page checks the switch".
- **Gatekeeper decisions.** The 5-second window, the late switch-on and the place of the switch are gatekeeper decisions, not human decisions. They are in `requirements.md`, section "Assumptions".
- **Electron tests.** The checks that need the desktop window go in the Electron e2e group (knowledge base `electron-e2e-separate`).
- **Indexes and specs.** For every "modify" the indexes and specs gave the place. No source file was opened.

## Risks

- The notification server may play its own sound for the urgent notification. The user then hears two sounds (spec, "Risks").
- The `notify.sh` hook, while still installed, can add a third alert.
- An event during the page load at start plays no sound (batch needs-input-sound, decision "Page not loaded yet").

## Departures

None.

## Coverage check

- Every REQ is served by at least one INT:
  - needs-input-sound → REQ-1 (INT-1, INT-2, INT-3, INT-4, INT-6, INT-7), REQ-2 (INT-3, INT-6), REQ-3 (INT-3), REQ-4 to REQ-8 (INT-1), REQ-9 (INT-5, INT-6).
  - sound-switch → REQ-10 (INT-1, INT-2, INT-3), REQ-11 (INT-1, INT-2, INT-4), REQ-12 (INT-1), REQ-13 (INT-4), REQ-14 (INT-4).
- Every INT serves at least one REQ. There is no enabling INT.
- Every REQ closes in one batch. No REQ spans two batches.
