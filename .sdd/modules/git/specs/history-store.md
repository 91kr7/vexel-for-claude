---
module: git
component: useHistory
type: frontend hook
---

# useHistory

**Purpose** → asks the server for the history of every covered repository, page by page, and gives one combined list.

## Contract

- `useHistory(roots, revision = 0) → { history, loadMore }`
  - `{ status: "idle" }` → `roots` is empty; nothing is requested.
  - `{ status: "loading" }` → some root has no answer yet for its first page.
  - `{ status: "loaded", commits, hasMore, loadingMore, moreError?, errors }` →
    - `commits`, `hasMore` → mergeHistories over the roots whose pages loaded, in the order of `roots`: `{ root, commit }[]`, newest first.
    - `errors` → `{ root, message }[]`, one per root whose first page failed, in the order of `roots`; a failed root has no commits.
- a failed request →
  - the route answers with an error → its `message`, else "Could not read the history.";
  - the request fails or the answer has another shape → "Could not read the history."
- `Commit` → `{ hash, shortHash, parents?, message, author, date, committerDate? }` as HistoryRoute gives it.
- one request to `GET /api/git/history` with `path=<root>` and `offset=0` per root, each time the list of roots changes (other roots or another order), or `revision` changes with roots.
- a new list of roots → `loading` from the same render; the answers for the previous list are dropped.
- the state changes in one step, when every root has answered: one root never shows before the others.
- a new `revision`, same roots → a refresh:
  - with `loaded` → the commits and errors stay, with `loadingMore: true` and no `moreError`, until every first page answers; then the state is those first pages alone (pages read before are dropped);
  - while `loading` → the state stays until the answers;
  - a "load more" still in flight is dropped; an answer of an older revision is dropped.
- `loadMore()` → with `loaded`, `hasMore` and nothing in flight: for each root of the `border` of mergeHistories, requests its next page with `offset` = the count of its loaded commits.
  - while in flight → `loadingMore: true`; a second call does nothing.
  - when every page answers → in one step, the commits of each page are appended to its root, and that root's `hasMore` takes the page's value.
  - a failed page → that root keeps its commits and its `hasMore`, so the user can retry; `moreError` holds the message (the first one, in the order of `roots`). The other pages still count.
  - in any other state → does nothing.

## Rules and invariants

- A failing root never hides the commits of the other roots.
- With one root, the commits are those of that root in git order, and `hasMore` is its own.

## Dependencies

- HistoryRoute, mergeHistories

## Requirements served

- `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-21`, `plan-git_explorer/REQ-24`
- `plan-multi_repo_workspace/REQ-21`, `plan-multi_repo_workspace/REQ-24`, `plan-multi_repo_workspace/REQ-26`
