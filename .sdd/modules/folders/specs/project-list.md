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
- in the list panel column: the title row, the search bar when the store has projects, then the list area. Only the list area scrolls, when its rows do not fit.
- the search runs in the page, on the projects of the store. It sends no request.

Shows:
- the title row (`.list-panel-title`) → the `h1` "Projects" in `.section-label`.
- the search bar → only in state `ready` with at least one project. It has the look of the ResumeDialog search bar (module history): the search icon, the field "Search projects" (its accessible name too), and the "Clear Search" button (XIcon) while the text is not empty. The text is empty when the component mounts.
- state `loading` → a compact loading AreaState "Loading…".
- state `error` → a compact error AreaState "Could not load the projects.".
- state `ready` with no project → a compact empty AreaState "No projects yet", with the folder icon.
- state `ready` with projects, none matching the search text → a compact empty AreaState `No projects match "<text>"`, with the folder icon. The search bar stays.
- state `ready` with projects → a list, one row per matching project, in the store order. A project matches when its full path contains the search text, ignoring case. An empty text matches every project. Each row has a button (class `project-row`) and, beside it and not inside it, the ProjectFavoriteButton and then the ProjectRemoveButton of the project. The row button has:
  - the Avatar of the folder;
  - the folder name (`folderNameOf`), weight 600, 13 px, cut with an ellipsis; then the FavoriteIndicator when the project is favorite;
  - the full path, mono 11 px, `--text-muted`, cut with an ellipsis; its `title` is the full path;
  - "Last activity" and the RelativeTime of `lastActivity`, 11 px, `--text-secondary`.
- a row with `available` false → `aria-disabled="true"`, opacity 0.55, the `not-allowed` cursor, no hover style. Before "Last activity" it shows "Folder not found" in `--amber-400`, then " · ".
- an available row on hover → `--bg-surface-2` background and a 1 px `--border-subtle` border.
- the ProjectRemoveButton → at the right end of the row; the ProjectFavoriteButton → left of it, 4 px apart. Both are centred on the height of the row button. Each is hidden (opacity 0) until the pointer is over the row or the focus inside the row is visible from the keyboard. Each stays shown while its request runs. Their errors show under the row button. Unavailable rows have them too. They are not dimmed there, and they work.
- an available row on hover or with visible focus → the label "▶ New session" at its right end, left of the favorite button, 11 px weight 600, on the accent colour. The label is decorative: it is not part of the row name. An unavailable row has no label.

Actions:
- typing in the search field → the rows update at each change of the text, with no button to press.
- "Clear Search" → empties the text, shows every row again and puts the focus back in the field.
- click, Enter or Space on an available row → `onChoose(project)` with that row's project, also in a filtered list.
- click, Enter or Space on an unavailable row → nothing.
- Tab → reaches the search field, then "Clear Search" when shown, then every row button, unavailable rows included, and after each row button its favorite button, then its remove button. The focused row button shows the focus ring inside its edge. The search field and "Clear Search" show the focus ring when focused.
- a row that holds the focus leaves the list (e.g. after "Remove from Projects") → the focus goes to the row button of the next row still in the list, else of the previous one. No row left → the focus is not moved. The focus is not moved either when it is already on another element, e.g. the search field.

## Rules and invariants

- All text is in English.
- The rows keep their content and order while a new load runs: they change only when the store gives a new list or the search text changes.
- The search text stays while the store gives a new list.

## Dependencies

- ProjectListStore
- ProjectFavoriteButton
- ProjectRemoveButton
- AreaState, IconSet (`FolderIcon`, `SearchIcon`, `XIcon`) (module app)
- Avatar, `folderNameOf`, RelativeTime, FavoriteIndicator (module sessions)

## Requirements served

- `plan-recent_projects/REQ-6`, `plan-recent_projects/REQ-9`, `plan-recent_projects/REQ-10`, `plan-recent_projects/REQ-11`, `plan-recent_projects/REQ-12`, `plan-recent_projects/REQ-13`, `plan-recent_projects/REQ-14`, `plan-recent_projects/REQ-15`
- `plan-project_list_actions/REQ-1`, `plan-project_list_actions/REQ-2`, `plan-project_list_actions/REQ-3`, `plan-project_list_actions/REQ-4`, `plan-project_list_actions/REQ-5`, `plan-project_list_actions/REQ-6`, `plan-project_list_actions/REQ-8`, `plan-project_list_actions/REQ-9`, `plan-project_list_actions/REQ-10`, `plan-project_list_actions/REQ-11`
- `plan-project_list_actions/REQ-12`, `plan-project_list_actions/REQ-18`, `plan-project_list_actions/REQ-21`, `plan-project_list_actions/REQ-22`
- `plan-project_list_actions/REQ-23`, `plan-project_list_actions/REQ-24`, `plan-project_list_actions/REQ-27`, `plan-project_list_actions/REQ-30`, `plan-project_list_actions/REQ-31`, `plan-project_list_actions/REQ-32`
