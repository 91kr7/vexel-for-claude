---
module: app
component: ListWidthStore
type: frontend service
---

# ListWidthStore

**Purpose** → holds the width the user chose for the list panel, saves it in the browser, and gives the width the panel shows in a given window.

## Contract

- `MIN_LIST_WIDTH` → 180. `MAX_LIST_WIDTH` → 480. `DEFAULT_LIST_WIDTH` → 224. `MIN_MAIN_AREA_WIDTH` → 700. Widths are in px.
- `LIST_WIDTH_KEY` → `'ai-client.list-width'`, the storage key of the saved width.
- `new ListWidthStore(storage?)` → the width is the value saved under the key when it is a whole number from 180 to 480. Otherwise it is 224: no value, any other text, a value out of range, no `storage`, or `getItem` throws. The store reads the storage at creation and does not write.
- `preview(width)` → the width becomes `width`, rounded and kept between 180 and 480. Nothing is saved. The listeners are called when the width changes.
- `commit(width)` → as `preview`, then the width is saved under the key as text (e.g. `"304"`), also when it did not change.
  - `storage` missing, or `setItem` throws → the width still changes and the listeners are called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the width.
- `getSnapshot()` → the current width.
- `listWidthLimit(windowWidth)` → the widest list panel the window allows:

```
limit = windowWidth - 52 (rail) - 700 (main area)
result = limit kept between 180 and 480
```

- `shownListWidth(width, windowWidth)` → the smaller of `width` and `listWidthLimit(windowWidth)`.
  - e.g. width 480, window 1440 → 480. Window 1100 → 348. Window 900 → 180.
- `pageListWidthStore()` → the one store of the page, created at the first call, with `localStorage`. `localStorage` not reachable → the store works without saving.
- `useListWidth(store = pageListWidthStore()) → width` → React hook: the current width of `store`, also in a server render. The component re-renders after each change.

## Rules and invariants

- The width is always a whole number from 180 to 480.
- A narrow window changes only the shown width, never the stored one.
- Each browser profile, and the desktop window, keeps its own width. The backend stores nothing.

## Requirements served

- `plan-session_list_width/REQ-3`, `plan-session_list_width/REQ-4`, `plan-session_list_width/REQ-5`, `plan-session_list_width/REQ-6`, `plan-session_list_width/REQ-7`, `plan-session_list_width/REQ-8`, `plan-session_list_width/REQ-9`
