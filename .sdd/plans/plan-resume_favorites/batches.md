---
status: validated
---

# Batches — Favorites in the resume session popup

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [popup-size](batches/batch-popup-size.md) | Popup size | REQ-1, REQ-2, REQ-3, REQ-4 | — | certified | The resume popup is wider and shorter |
| [popup-mark](batches/batch-popup-mark.md) | Mark from the resume popup | REQ-5, REQ-6, REQ-7, REQ-8, REQ-9 | — | certified | The user marks a session from the resume popup |
| [favorites-filter](batches/batch-favorites-filter.md) | Favorites filter | REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19 | popup-mark | implemented | The user shows only the favorite sessions |

Execution order: `popup-size`, `popup-mark`, `favorites-filter`. All three change `src/web/history/ResumeDialog.tsx`, so they run one after the other, not in parallel.

## Assumptions and decisions

- **Three batches, one per feature.** No foundation batch is needed.
- **New component.** Only `popup-mark` builds one: the past-session favorite route, in the backend history area. The reason is in the "Decisions" of that batch file.
- **Same mark.** The popup writes to the existing SessionFavoriteStore, keyed by the Claude Code session id. The session list already follows that store, so REQ-8 needs no list code (`batch-popup-mark`).
- **Button as indicator.** In the popup the star button of the session list replaces FavoriteIndicator. A marked row shows the filled star, as before.
- **The popup is not live.** It flips a row after its own press. It does not follow changes from other pages while it is open, as today.
- **No desktop change, no Electron e2e.** Knowledge base `electron-e2e-separate`. All e2e tests run in the browser.

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT. Every REQ closes in exactly one batch.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-popup-size/INT-1` | popup-size |
| REQ-2 | `batch-popup-size/INT-2` | popup-size |
| REQ-3 | `batch-popup-size/INT-2` | popup-size |
| REQ-4 | `batch-popup-size/INT-1`, `INT-2` | popup-size |
| REQ-5 | `batch-popup-mark/INT-1`, `INT-2`, `INT-3`, `INT-4` | popup-mark |
| REQ-6 | `batch-popup-mark/INT-5` | popup-mark |
| REQ-7 | `batch-popup-mark/INT-3`, `INT-4` | popup-mark |
| REQ-8 | `batch-popup-mark/INT-1`, `INT-2` (the list follows the store, see the batch decisions) | popup-mark |
| REQ-9 | `batch-popup-mark/INT-5` | popup-mark |
| REQ-10 | `batch-favorites-filter/INT-1` | favorites-filter |
| REQ-11 | `batch-favorites-filter/INT-2` | favorites-filter |
| REQ-12 | `batch-favorites-filter/INT-2` | favorites-filter |
| REQ-13 | `batch-favorites-filter/INT-1` | favorites-filter |
| REQ-14 | `batch-favorites-filter/INT-2`, with `batch-popup-mark/INT-4` | favorites-filter |
| REQ-15 | `batch-favorites-filter/INT-3` | favorites-filter |
| REQ-16 | `batch-favorites-filter/INT-1` | favorites-filter |
| REQ-17 | `batch-favorites-filter/INT-1` | favorites-filter |
| REQ-18 | `batch-favorites-filter/INT-1` | favorites-filter |
| REQ-19 | `batch-favorites-filter/INT-1`, `INT-3`; the texts of `batch-popup-mark` come from FavoriteButton | favorites-filter |

Every INT serves at least one REQ. No enabling intervention.
