---
module: folders
component: ProjectList
type: UI component
---

# ProjectList

**Purpose** → the content of the list panel in the "Projects" view: the project folders of the machine, favorite projects first, then most recent first. It copies step "1 · Elenco progetti" of `.sdd/mockups/recent_projects/mock.html`, with the neutral Avatar.

## Contract

Props:
- `store` → optional ProjectListStore. Default: the page store. The component shows its state and starts no load.
- `onChoose(project)` → optional. Called when the user chooses an available row.

Description:
- two parts, in the list panel column: the title row, then the list area. Only the list area scrolls, when its rows do not fit.

Shows:
- the title row (`.list-panel-title`) → the `h1` "Projects" in `.section-label`.
- state `loading` → a compact loading AreaState "Loading…".
- state `error` → a compact error AreaState "Could not load the projects.".
- state `ready` with no project → a compact empty AreaState "No projects yet", with the folder icon.
- state `ready` with projects → a list, one row per project, in the store order. Each row has a button (class `project-row`) and, beside it and not inside it, the ProjectFavoriteButton of the project. The row button has:
  - the Avatar of the folder;
  - the folder name (`folderNameOf`), weight 600, 13 px, cut with an ellipsis; then the FavoriteIndicator when the project is favorite;
  - the full path, mono 11 px, `--text-muted`, cut with an ellipsis; its `title` is the full path;
  - "Last activity" and the RelativeTime of `lastActivity`, 11 px, `--text-secondary`.
- a row with `available` false → `aria-disabled="true"`, opacity 0.55, the `not-allowed` cursor, no hover style. Before "Last activity" it shows "Folder not found" in `--amber-400`, then " · ".
- an available row on hover → `--bg-surface-2` background and a 1 px `--border-subtle` border.
- the ProjectFavoriteButton → at the right end of the row, centred on the height of the row button. Hidden (opacity 0) until the pointer is over the row or the focus inside the row is visible from the keyboard. It stays shown while its request runs. Its error shows under the row button. Unavailable rows have it too. It is not dimmed there, and it works.
- an available row on hover or with visible focus → the label "▶ New session" at its right end, left of the favorite button, 11 px weight 600, on the accent colour. The label is decorative: it is not part of the row name. An unavailable row has no label.

Actions:
- click, Enter or Space on an available row → `onChoose(project)` with that row's project.
- click, Enter or Space on an unavailable row → nothing.
- Tab → reaches every row button, unavailable rows included, and after each row button its favorite button. The focused row button shows the focus ring inside its edge.

## Rules and invariants

- All text is in English.
- The rows keep their content and order while a new load runs: they change only when the store gives a new list.

## Dependencies

- ProjectListStore
- ProjectFavoriteButton
- AreaState, IconSet (`FolderIcon`) (module app)
- Avatar, `folderNameOf`, RelativeTime, FavoriteIndicator (module sessions)

## Requirements served

- `plan-recent_projects/REQ-6`, `plan-recent_projects/REQ-9`, `plan-recent_projects/REQ-10`, `plan-recent_projects/REQ-11`, `plan-recent_projects/REQ-12`, `plan-recent_projects/REQ-13`, `plan-recent_projects/REQ-14`, `plan-recent_projects/REQ-15`
- `plan-project_list_actions/REQ-23`, `plan-project_list_actions/REQ-24`, `plan-project_list_actions/REQ-27`, `plan-project_list_actions/REQ-30`, `plan-project_list_actions/REQ-31`, `plan-project_list_actions/REQ-32`
