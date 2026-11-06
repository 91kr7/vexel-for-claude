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
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the order.
- `getSnapshot()` → the current order. The same object until the next change.
- `useSessionOrder(sessions, status) → SessionOrder` → React hook: one store on `window.localStorage` for the life of the component. It calls `update` after each render with new `sessions` or `status`, and returns the current order.

## Rules and invariants

- A list received while the status is `loading` or `error`, such as the empty list before the first load, never changes the saved order.
- After a reload, the saved order applies as soon as the first list arrives.

## Dependencies

- nextSessionOrder, groupSessions (`SessionOrder`), LiveSessionStore (`SessionSummary`, `LoadStatus`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-5`
