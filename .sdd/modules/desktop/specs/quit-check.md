---
module: desktop
component: QuitCheck
type: backend service
---

# QuitCheck

**Purpose** → decides if quitting the desktop app needs the user's confirmation, and asks for it.

## Contract

- `countBusySessions(origin) → Promise<number>`
  - reads `GET <origin>/api/sessions` and counts the entries without `external: true` whose `state` is `working` or `needs_input`.
  - no answer within 2 seconds, a network error, a status other than `200` or a body that is not an array → `0`.
- `quitConfirmation(count) → dialog options` → the options of the native message box:
  - type `warning`, title and message "Quit Vexel for Claude?".
  - detail → `"<count> sessions are working or need input. Quitting ends them."`; for `1` → `"1 session is working or needs input. Quitting ends it."`
  - buttons "Cancel" (index 0, the default and the cancel button) and "Quit" (index 1).
- `confirmQuit(backend, ask) → Promise<boolean>` → `true` when the app can quit.
  - `backend` → `{ origin, startedByApp }` of the ready backend, or `undefined` when no backend is ready.
  - `ask(options) → Promise<{ response }>` → shows the dialog and returns the index of the chosen button.
  - `backend` is `undefined` or `startedByApp` is `false` → `true`. No request, no dialog.
  - `countBusySessions` gives `0` → `true`, no dialog.
  - otherwise → `ask(quitConfirmation(count))`; `true` only when the response is `1` ("Quit").

## Rules and invariants

- External sessions never count: they run in other terminals, and stopping the backend does not end them.
- The rule follows StopSessionButton (module sessions): a busy session asks first, "Cancel" is the default.

## Dependencies

- SessionListRoute (module sessions): the `GET /api/sessions` it reads.

## Requirements served

- `plan-desktop_app/REQ-17`
