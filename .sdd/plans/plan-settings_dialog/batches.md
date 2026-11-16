---
slug: settings_dialog
date: 2026-11-16
status: validated
---

# Batches — Settings popup with editable shortcuts

Requirements → `requirements.md`. Execution order: settings-popup → shortcuts-section → editable-shortcuts and update-check. The last two depend only on shortcuts-section, so either can run first.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [settings-popup](batches/batch-settings-popup.md) | Settings popup | REQ-1, REQ-2, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 | — | certified | The user changes the theme and the look from the settings |
| [shortcuts-section](batches/batch-shortcuts-section.md) | Shortcuts in the settings | REQ-3, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25 | settings-popup | certified | Alt+S shows the shortcuts in the settings |
| [editable-shortcuts](batches/batch-editable-shortcuts.md) | Editable shortcuts | REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42 | shortcuts-section | certified | The user gives a shortcut new keys and uses them at once |
| [update-check](batches/batch-update-check.md) | Update check in the settings | REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53, REQ-54, REQ-55, REQ-56, REQ-57, REQ-58, REQ-59, REQ-60 | shortcuts-section | certified | The user finds a newer version from the settings |

## Assumptions and decisions

- **Sections in three menus.** Gatekeeper decision, not a human decision (2026-11-16), after the human reported the layout defect. A vertical menu on the left offers "Appearance" (theme, then look), "Shortcuts" and "Updates"; the chosen menu shows on the right. "Open on the shortcuts section" (REQ-25) means the "Shortcuts" menu is chosen. The popup has a fixed size of 760 × 540 px, each at most the window minus 32 px. This replaces the four tabs of the first implementation (batch update-check, INT-9 to INT-19).
- **Layout defect in the last batch.** Human decision (2026-11-16): the defect reopens batch update-check, with no new analysis.
- **Choice controls.** Theme and look are radio groups ("Light" / "Dark", "macOS" / "Windows 11"). They use the existing ThemeStore and LookStore. The top bar ThemeSwitch and LookSwitch are deleted, not reused.
- **Settings button place.** Human decision (2026-11-16): it sits at the bottom of the navigation rail, below "Resume", in the style of the rail buttons. The list panel does not show it. Batch settings-popup INT-6, INT-10 and INT-11 move it there from the list panel footer of the first implementation.
- **The panel becomes the section.** The ShortcutsPanel is changed into the "Shortcuts" section, not rebuilt. The implementer may rename it, and records the name in the indexes.
- **Tooltip of the settings button.** In batch settings-popup it reads "Settings", because Alt+S still opens the old panel there. It gets the keys in batch shortcuts-section, when Alt+S opens the popup.
- **Row action "Shortcut settings".** The general row "Shortcuts panel" gets this action text, because it now opens the popup on the "Shortcuts" tab.
- **Storage.** The user keys live in `localStorage` under `ai-client.shortcuts`, like the theme and the look. The backend stores nothing.
- **Terminal keys.** The default terminal keys keep today's match by character, so the Italian Ctrl+Shift+0 still gives larger text. A key the user chose matches by physical key, like the other shortcuts.
- **Reserved keys.** The plan fixes the minimum list in batch editable-shortcuts, section "Reserved keys", from the sources of `keyboard_shortcuts.md`, lines 95-97. "Ctrl with most letters" becomes Ctrl with any letter.
- **Update check order (REQ-43).** Batch update-check depends on shortcuts-section, because the "Updates" tab comes after "Shortcuts". It does not need editable-shortcuts.
- **Failure kept apart (REQ-50, REQ-52).** checkLatestRelease gets a `failed` result, distinct from "not newer". The launch route turns it into `none`, so the launch stays silent. The new route `POST /api/update-check` gives it to the page.
- **Electron tests.** Only the drag area check of REQ-17 needs the desktop window. It goes in the Electron e2e group (knowledge base `electron-e2e-separate`).
- **Ubuntu.** The default theme, the default look and the window buttons stay as today (knowledge base `wsl-keeps-ubuntu-working`).
- **Indexes and specs.** For every "modify" the indexes and specs gave the place. No source file was opened.

## Risks

- In a browser, Chromium never gives some keys to the page, such as Ctrl+W. Pressed while a row is in editing, they act on the browser and the client cannot stop them.

## Departures

None.

## Coverage check

- Every REQ is served by at least one INT:
  - settings-popup → REQ-1 (INT-1, INT-5, INT-6, INT-10, INT-11), REQ-2 (INT-11), REQ-4 (INT-5, INT-6, INT-11), REQ-5 to REQ-8 (INT-2), REQ-9 (INT-6), REQ-10, REQ-11 (INT-2), REQ-12 (INT-3), REQ-13 (INT-4), REQ-14, REQ-15 (INT-3, INT-4), REQ-16 (INT-7, INT-8, INT-9), REQ-17 (INT-7), REQ-18 (INT-6), REQ-19, REQ-20 (INT-2).
  - shortcuts-section → REQ-3 (INT-8), REQ-21 (INT-2), REQ-22, REQ-23 (INT-1), REQ-24 (INT-1, INT-4 to INT-7), REQ-25 (INT-3, INT-4, INT-5).
  - editable-shortcuts → REQ-26 (INT-2, INT-6, INT-8), REQ-27 (INT-1, INT-11), REQ-28 (INT-5), REQ-29 (INT-4, INT-5), REQ-30 (INT-5), REQ-31 (INT-7), REQ-32 (INT-5, INT-7), REQ-33 (INT-7), REQ-34 (INT-2, INT-9), REQ-35 (INT-2, INT-10), REQ-36 (INT-10), REQ-37 (INT-2, INT-3, INT-11), REQ-38 (INT-3, INT-11, INT-12, INT-13), REQ-39 (INT-7), REQ-40 (INT-2), REQ-41, REQ-42 (INT-6; REQ-42 also INT-9, INT-10).
  - update-check → REQ-43 (INT-7), REQ-44 (INT-6), REQ-45 (INT-1, INT-3, INT-4, INT-5), REQ-46 (INT-6), REQ-47, REQ-48 (INT-3, INT-6), REQ-49 (INT-8), REQ-50 (INT-1, INT-3, INT-5, INT-6), REQ-51 (INT-6, INT-7), REQ-52 (INT-2, INT-4), REQ-53 (INT-9, INT-11), REQ-54 (INT-9, INT-17), REQ-55, REQ-56 (INT-10), REQ-57 (INT-12, INT-13, INT-17, INT-18), REQ-58 (INT-14 to INT-17), REQ-59 (INT-10, INT-16), REQ-60 (INT-17, INT-18, INT-19).
- Every INT serves at least one REQ. There is no enabling INT.
- REQ across batches:
  - REQ-3 → starts in settings-popup (INT-5, INT-10: name "Settings", tooltip without keys). It closes in shortcuts-section (INT-8).
  - REQ-22 → closes in shortcuts-section. Batch editable-shortcuts INT-1 splits rows into one per action; the grouping by area stays.
  - REQ-23 → closes in shortcuts-section. Batch editable-shortcuts INT-8 extends the key text to user keys.
