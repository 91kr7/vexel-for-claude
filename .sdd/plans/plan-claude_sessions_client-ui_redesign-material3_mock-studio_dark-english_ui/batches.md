---
status: validated
---

# Batches — English user interface

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [english-ui](batches/batch-english-ui.md) | English user interface | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16 | — | todo | The user reads the session list in English |

## Assumptions and decisions

- **One batch.** The spec has one feature, so the plan has one batch. The batch of `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark` is certified, so nothing comes before it.
- **Frontend only.** The server specs show error codes only, never UI text. The texts live in the frontend components under `src/web/`.
- **"Fallito" is a tool outcome.** The spec lists it with the session states. The StateBadge spec has four states, and the ConversationView spec shows "Fallito" on tool cards. `requirements.md` now has REQ-2 with four states and REQ-16 for the tool outcomes.
- **Mock texts.** The batch file lists which mock texts the client takes (REQ-13), and which it does not take, with the reason. This makes REQ-13 checkable.
- **Names the mock does not give.** The batch file fixes the action names ("Interrupt", "Terminate", "Resume Here", ...). The developer translates every other text.
- **Tests.** The current unit and e2e tests assert Italian texts. The tester changes them to the English texts.
- **Artifacts to update.** The developer updates the indexes and component specs that quote Italian texts or say "Italian". `.sdd/.archi` says "GUI language: Italian" in its "Assumptions". The developer of `english-ui` changes it to English (gatekeeper decision, see the batch file).

## Departures

None. No human decision contradicts the spec. The spec's mistake about "Fallito" is listed above. The spec should be corrected so that "Fallito" is a tool outcome, not a session state.

## Coverage check

Every REQ is served by at least one INT. All INTs are in `batch-english-ui`, and every REQ closes there.

| REQ | INT |
|-----|-----|
| REQ-1 | INT-2, INT-3, INT-4, INT-5, INT-10, INT-11, INT-14, INT-17, INT-19, INT-22, INT-23 |
| REQ-2 | INT-9 |
| REQ-3 | INT-2, INT-3, INT-5, INT-6, INT-7, INT-11, INT-14, INT-16, INT-17, INT-19, INT-21, INT-25 |
| REQ-4 | INT-7, INT-16, INT-17, INT-19, INT-21 |
| REQ-5 | INT-5, INT-6, INT-8, INT-11, INT-15, INT-16, INT-18, INT-19, INT-24, INT-25 |
| REQ-6 | INT-12, INT-24 |
| REQ-7 | INT-13, INT-20 |
| REQ-8 | INT-13, INT-20 |
| REQ-9 | INT-3, INT-4, INT-7, INT-14, INT-17, INT-19, INT-22, INT-23 |
| REQ-10 | INT-1 |
| REQ-11 | INT-1 |
| REQ-12 | INT-22 |
| REQ-13 | INT-2, INT-3, INT-7, INT-9, INT-13, INT-17, INT-22, INT-23 |
| REQ-14 | INT-15, INT-26 |
| REQ-15 | INT-3, INT-4, INT-9, INT-11, INT-12, INT-14, INT-16 |
| REQ-16 | INT-23 |

Every INT from INT-1 to INT-26 serves at least one REQ. There is no enabling-only intervention.

REQ-10 is already true: the title is "Vexel for Claude". INT-1 keeps it.
