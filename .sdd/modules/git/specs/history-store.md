---
module: git
component: useHistory
type: frontend hook
---

# useHistory

**Purpose** → asks the server for the history of a repository, page by page.

## Contract

- `useHistory(root | undefined, revision = 0) → { history, loadMore }`
  - `{ status: "idle" }` → `root` is `undefined`; nothing is requested.
  - `{ status: "loading" }` → no answer yet for the first page.
  - `{ status: "loaded", commits, hasMore, loadingMore, moreError? }` → the commits of the pages read so far, in order.
  - `{ status: "error", message }` → the first page failed:
    - the route answers with an error → its `message`, else "Could not read the history.";
    - the request fails or the answer has another shape → "Could not read the history."
- one request to `GET /api/git/history` with `path=<root>` and `offset=0` each time `root` changes to a defined value, or `revision` changes with a defined `root`.
- a new `root` → `loading` from the same render; the answer for the previous root is dropped.
- a new `revision`, same root → a refresh:
  - with `loaded` → the commits stay, with `loadingMore: true` and no `moreError`, until the first page answers; then the state is that first page alone (pages read before are dropped);
  - in other states → the state stays until the answer;
  - a page of "load more" still in flight is dropped; an answer of an older revision is dropped.
- `loadMore()` → with `loaded`, `hasMore` and no page in flight: requests the next page with `offset` = the count of commits loaded.
  - while in flight → `loadingMore: true`; a second call does nothing.
  - answer → its commits are appended; `hasMore` takes its value.
  - failure → the commits stay, `moreError` holds the message (as above), `hasMore` stays `true` so the user can retry.
  - in any other state → does nothing.

## Dependencies

- HistoryRoute

## Requirements served

- `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-21`, `plan-git_explorer/REQ-24`
