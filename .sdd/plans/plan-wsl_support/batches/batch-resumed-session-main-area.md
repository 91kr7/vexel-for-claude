---
batch: resumed-session-main-area
feature: Resumed session in the main area
closed_req: [REQ-42, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47]
depends: [ended-external-sessions]
---

# Batch — Resumed session in the main area

Fix of 2026-11-18. After a resume of an ended external session, the main area sometimes shows "No open session". The cause is in `src/web/AppLayout.tsx`, lines 135-138. The effect that sets `openSessionId` to `null` when the open session leaves the list can run after `openHosted(newId)`. Then it clears the session that the resume has just opened.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/AppLayout.tsx` | When the open session leaves the list, clear only that session. If another session became the open one in the meantime, keep it. This must hold in both orders of the list update and of `openHosted`. | REQ-42, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47 | — |

Notes for the implementer:

- The rest of the AppLayout contract stays: a dismissed open session still gives the EmptyState, and the "ended while away" rule still keeps an ended session open.
- Update the rule of line 27 of `.sdd/modules/app/specs/app-layout.md` if its wording changes.

Notes for the tester:

- Binding test for REQ-42, REQ-43, REQ-44 and REQ-47: an order test. It forces each order of two events: the removal of the ended external entry and the opening of the resumed session. It covers "Resume" on the entry, "Resume Here" and Alt+R. On today's code it fails in at least one order.
- The order test must not depend on timing. The tester chooses the means. Examples: hold back the resume response until the list has changed, hold back the list event until the session is open, or feed the two updates in a fixed order to a component test. A test that passes only on some runs does not count.
- These existing tests must also stay green:
  - REQ-42 → `e2e/ended-external-sessions.spec.ts:201`, `:215` and `:229`.
  - REQ-45 → `e2e/dismiss-resume.spec.ts:276` and `e2e/ended-external-sessions.spec.ts:183`.
  - REQ-46 → `e2e/dismiss-resume.spec.ts:201` and `e2e/session-action-shortcuts-resume.spec.ts:165`.
- The tests run in the browser groups only. No Electron test is needed.
- This is the last batch of the plan, so it ends with the closing run: the complete browser e2e suite (`npm run test:e2e`) and the whole unit suite (`npm test`), one after the other.

## Human acceptance

### Scenario: Alt+R on an ended external session opens the resumed session every time

- REQ → REQ-42, REQ-43, REQ-44, REQ-47
- Given → the ended external session is open in the main area
- When → the user presses Alt+R
- Then → the main area shows the new hosted session, and it stays there after the ended entry leaves the list
- And → the same holds with "Resume" on the entry and with "Resume Here"

### Scenario: Dismiss of the open session still clears the main area

- REQ → REQ-45
- Given → the ended external session is open in the main area
- When → the user presses "Dismiss" on its entry
- Then → the main area shows no open session

### Scenario: Resume of an ended hosted session works as before

- REQ → REQ-46
- Given → the list shows an ended hosted entry with a saved conversation
- When → the user presses "Resume" on the entry
- Then → the resumed session is open in the main area
- And → the list holds no ended entry for that conversation
