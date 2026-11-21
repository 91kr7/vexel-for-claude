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
- in the list panel column: the title row, the search bar when the store has projects, then the list area. Only the list area scrolls, when its rows do not fit. A shown scrollbar is as far from the right edge of the rows as the panel edge is from their left edge (ListStyles `.list-scroll`, module app).
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
  - line 1: the folder name (`folderNameOf`), weight 600, 13 px, cut with an ellipsis; the ProjectFavoriteButton shows right after the name, on the same line, on every row;
  - the full path, mono 11 px, `--text-muted`, cut with an ellipsis, with no `title`;
  - "Last activity" and the RelativeTime of `lastActivity`, 11 px, `--text-secondary`; the time in mono with tabular figures.
  - a right column of 36 px kept free for the ProjectRemoveButton: the text never runs under it.
  - no "New session" label.
- a row with `available` false → `aria-disabled="true"`, opacity 0.55, the `not-allowed` cursor, no hover style. Before "Last activity" it shows "Folder not found" in `--amber-400`, then " · ".
- each row is a card of ListStyles (`.list-card`): `--radius-card`, `--role-card` background, 1 px `--role-border-subtle` border.
- an available row on hover → the hover of ListStyles: `--role-hover` background, `--role-border-strong` border.
- the ProjectRemoveButton → in the right column of the row, 8 px from the right edge, centred on the height of the row button. It shows while the pointer is over the row, while the keyboard focus is visible on the row or on a control of the row, and while its request runs; else it is hidden (opacity 0).
- the ProjectFavoriteButton → its visibility rules are in its spec; the row is the area whose hover or keyboard focus shows an outline star.
- the errors of both buttons show under the row button. Unavailable rows have both buttons too. They are not dimmed there, and they work.

Actions:
- typing in the search field → the rows update at each change of the text, with no button to press.
- "Clear Search" → empties the text, shows every row again and puts the focus back in the field.
- click, Enter or Space on an available row → `onChoose(project)` with that row's project, also in a filtered list.
- click, Enter or Space on an unavailable row → nothing.
- click on the star or on Remove → only that button acts: `onChoose` is not called.
- Tab → reaches the search field, then "Clear Search" when shown, then every row button, unavailable rows included, and after each row button its favorite button, then its remove button. The focused row button shows the focus ring inside its edge. The search field and "Clear Search" show the focus ring when focused.
- a row that holds the focus leaves the list (e.g. after "Remove from Projects") → the focus goes to the row button of the next row still in the list, else of the previous one. No row left → the focus is not moved. The focus is not moved either when it is already on another element, e.g. the search field.

Motion:
- each mount (each time the Projects view shows) → the rows of the first shown list enter in cascade through ListCascade (module app). Focus, clicks and keys work during the cascade.
- a search change (typing or "Clear Search") → the rows update at once; a cascade still playing ends.
- a new list from the store (reload, favorite, remove) → no cascade.

## Rules and invariants

- All text is in English.
- The rows keep their content and order while a new load runs: they change only when the store gives a new list or the search text changes.
- The search text stays while the store gives a new list.

## Dependencies

- ProjectListStore
- ProjectFavoriteButton
- ProjectRemoveButton
- AreaState, IconSet (`FolderIcon`, `SearchIcon`, `XIcon`), ListStyles, ListCascade (module app)
- Avatar, `folderNameOf`, RelativeTime (module sessions)

## Requirements served

- `plan-recent_projects/REQ-6`, `plan-recent_projects/REQ-9`, `plan-recent_projects/REQ-10`, `plan-recent_projects/REQ-11`, `plan-recent_projects/REQ-12`, `plan-recent_projects/REQ-13`, `plan-recent_projects/REQ-14`, `plan-recent_projects/REQ-15`
- `plan-project_list_actions/REQ-1`, `plan-project_list_actions/REQ-2`, `plan-project_list_actions/REQ-3`, `plan-project_list_actions/REQ-4`, `plan-project_list_actions/REQ-5`, `plan-project_list_actions/REQ-6`, `plan-project_list_actions/REQ-8`, `plan-project_list_actions/REQ-9`, `plan-project_list_actions/REQ-10`, `plan-project_list_actions/REQ-11`
- `plan-project_list_actions/REQ-12`, `plan-project_list_actions/REQ-18`, `plan-project_list_actions/REQ-21`, `plan-project_list_actions/REQ-22`
- `plan-project_list_actions/REQ-23`, `plan-project_list_actions/REQ-24`, `plan-project_list_actions/REQ-27`, `plan-project_list_actions/REQ-30`, `plan-project_list_actions/REQ-31`, `plan-project_list_actions/REQ-32`
- `plan-ui_restyle/REQ-12`, `plan-ui_restyle/REQ-13`, `plan-ui_restyle/REQ-14`, `plan-ui_restyle/REQ-19`, `plan-ui_restyle/REQ-20`, `plan-ui_restyle/REQ-21`, `plan-ui_restyle/REQ-23`, `plan-ui_restyle/REQ-24`, `plan-ui_restyle/REQ-26`
- `plan-dark_blue_theme/REQ-3`, `plan-dark_blue_theme/REQ-44`, `plan-dark_blue_theme/REQ-46`, `plan-dark_blue_theme/REQ-48`, `plan-dark_blue_theme/REQ-49`
- `plan-ui_transitions/REQ-17`, `plan-ui_transitions/REQ-20`, `plan-ui_transitions/REQ-21`
