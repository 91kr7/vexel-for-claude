---
module: folders
component: ProjectList
type: UI component
---

# ProjectList

**Purpose** → the content of the list panel in the "Projects" view: the project folders of the machine, most recent first. It copies step "1 · Elenco progetti" of `.sdd/mockups/recent_projects/mock.html`, with the neutral Avatar.

## Contract

Props:
- `store` → optional ProjectListStore. Default: the page store. The component shows its state and starts no load.

Description:
- two parts, in the list panel column: the title row, then the list area. Only the list area scrolls, when its rows do not fit.

Shows:
- the title row (`.list-panel-title`) → the `h1` "Projects" in `.section-label`.
- state `loading` → a compact loading AreaState "Loading…".
- state `error` → a compact error AreaState "Could not load the projects.".
- state `ready` with no project → a compact empty AreaState "No projects yet", with the folder icon.
- state `ready` with projects → a list, one row per project, in the store order. Each row is a button (class `project-row`) with:
  - the Avatar of the folder;
  - the folder name (`folderNameOf`), weight 600, 13 px, cut with an ellipsis;
  - the full path, mono 11 px, `--text-muted`, cut with an ellipsis; its `title` is the full path;
  - "Last activity" and the RelativeTime of `lastActivity`, 11 px, `--text-secondary`.
- a row with `available` false → `aria-disabled="true"`, opacity 0.55, the `not-allowed` cursor, no hover style. Before "Last activity" it shows "Folder not found" in `--amber-400`, then " · ".
- an available row on hover → `--bg-surface-2` background and a 1 px `--border-subtle` border.

Actions:
- click on a row → nothing.
- Tab → reaches every row, unavailable rows included. The focused row shows the focus ring inside its edge.

## Rules and invariants

- All text is in English.
- The rows keep their content and order while a new load runs: they change only when the store gives a new list.

## Dependencies

- ProjectListStore
- AreaState, IconSet (`FolderIcon`) (module app)
- Avatar, `folderNameOf`, RelativeTime (module sessions)

## Requirements served

- `plan-recent_projects/REQ-6`, `plan-recent_projects/REQ-9`, `plan-recent_projects/REQ-10`, `plan-recent_projects/REQ-11`, `plan-recent_projects/REQ-12`, `plan-recent_projects/REQ-13`
