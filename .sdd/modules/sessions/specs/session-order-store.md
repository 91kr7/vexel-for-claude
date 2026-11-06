---
module: sessions
component: SessionOrderStore
type: frontend service
---

# SessionOrderStore

**Purpose** → the order of the sessions inside each group of the list, kept for the whole page and saved in the browser so that it survives a reload.

## Contract

- `new SessionOrderStore(storage)` → `storage` is a `Storage` such as `localStorage`. It reads the saved order under the key `SESSION_ORDER_KEY` (`ai-client.session-order`).
  - no saved value, a value that is not JSON, or JSON that is not an order → the store starts from an empty order.
  - a valid order is an object whose keys are group ids (`needs-input`, `running`, `external`, `ended`) and whose values are lists of strings.
- `update(sessions, status)` → applies the order rule (`nextSessionOrder`) to `sessions`.
  - `status` other than `ready` → nothing changes and nothing is saved.
  - the new order differs from the current one → it becomes the current order, it is saved under the key as JSON, and the `subscribe` listeners are called.
  - the same order → nothing is saved and no listener is called.
  - the storage refuses to save → the new order still applies to the page.
- `move(sessionId, groupId, index)` → the user moves a session to a new place inside its group.
  - the session is not in the current order of `groupId` → nothing changes and nothing is saved.
  - otherwise the session takes place `index` (0-based) in that group, and the other sessions of the group keep their relative order. An `index` below 0 means the first place; an `index` past the end means the last place.
  - the other groups do not change.
  - the result is applied like a change of `update`: saved and listeners called only when the order differs, and kept for the page when the storage refuses to save.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the order.
- `getSnapshot()` → the current order. The same object until the next change.
- `useSessionOrder(sessions, status) → { order, move }` → React hook: one store on `window.localStorage` for the life of the component. It calls `update` after each render with new `sessions` or `status`. `order` is the current order. `move` calls the store's `move` and is the same function for the life of the component.

## Rules and invariants

- A list received while the status is `loading` or `error`, such as the empty list before the first load, never changes the saved order.
- After a reload, the saved order applies as soon as the first list arrives.
- A moved session keeps its new place through later `update` calls while it stays in its group.

## Dependencies

- nextSessionOrder, groupSessions (`SessionOrder`), LiveSessionStore (`SessionSummary`, `LoadStatus`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-9`
