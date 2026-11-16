---
request_slug: settings_dialog
date: 2026-11-16
type: evolution
size: ordinary
reference: .sdd/analysis/keyboard_shortcuts.md
---

# Analysis — Settings popup with editable shortcuts

## Request

> vorrei che mi implementassi in basso a sinistra nella barra laterale un tasto per aprire le impostazioni.
> attualmente ci vanno messe dentro le info in merito allo stile dei bordi (windows, mac), al tema (chiaro/scuro), e le shortcut che vorrei mi rendessi modificabili.
> le impostazioni devono essere aperte come popup

## Reference

[keyboard_shortcuts.md](keyboard_shortcuts.md) → it added the Ctrl/Alt shortcuts and a shortcuts panel, opened by a button in the top bar. It left changing the keys out of scope (line 118).

Related:
- [light_theme.md](light_theme.md) → the Light/Dark switch in the top bar. It left a settings screen out of scope (line 77).
- [wsl_support.md](wsl_support.md) → the look switch (current macOS look or Windows 11 look) in the top bar (lines 45-59).

Changes (human decisions of 2026-11-16):
- A settings button at the bottom of the navigation rail opens a settings popup. The rail is the vertical icon bar with "Sessions", "Projects" and "Resume".
- The theme switch, the look switch and the shortcuts button leave the top bar. They live only in the settings popup.
- The "Shortcuts" section of the settings replaces the shortcuts panel.
- The user can change every client shortcut, with the rules of today's shortcuts.

## Summary

A button at the bottom of the navigation rail opens a settings popup. The popup holds the theme, the window look and the shortcuts. The user can change, restore and reset each shortcut.

## Requirements

### Functional

Settings button
- The navigation rail must show a settings button at its bottom, below its other buttons. The human decided this on 2026-11-16.
- The button must not sit in the session list column.
- The button must stay visible at every window height and every sidebar width.
- The button must have an accessible name and a tooltip that shows its shortcut.
- A click on the button must open the settings popup.

Settings popup
- The settings must open as a modal popup, in the style of the other dialogs of the client.
- The popup must have three sections: theme, window look, shortcuts.
- Esc and a close button must close the popup. The focus must then go back where it was.
- Opening or closing the popup must not interrupt sessions, or lose the open session or the scroll position.
- The popup must follow the active theme and the active look.
- Every new text must be in English, like the rest of the client.

Theme and look
- The theme section must let the user choose Light or Dark, with the behaviour of [light_theme.md](light_theme.md), lines 45-48.
- The look section must let the user choose the macOS look or the Windows 11 look, with the behaviour of [wsl_support.md](wsl_support.md), lines 50-52.
- Each section must show the active choice.
- A change must apply to the whole client at once, while the popup stays open.

Top bar
- The top bar must no longer show the theme switch, the look switch or the shortcuts button.
- The top bar must keep an empty area to drag the window at every width, as today.

Shortcuts section
- The section must list every client shortcut, grouped by area as in the shortcuts panel today.
- Each row must show the action and its current keys.
- The user must be able to start editing a row, press a new combination, and get it saved.
- The client must reject a combination without Ctrl or Alt, and not save it.
- The client must reject a combination that Claude Code, the GNOME desktop or the browser uses, and not save it. The lists are the ones of [keyboard_shortcuts.md](keyboard_shortcuts.md), lines 95-97.
- The client must reject a combination that another client shortcut already uses, and not save it.
- A rejected combination must show a message that says why, and name the action that already uses it when there is one.
- Esc while editing a row must cancel the edit and keep the old keys.
- Each row must have a "restore default" action.
- The section must have a "restore all" action that puts every shortcut back to its default.
- A saved change must apply at once, everywhere in the client, with no reload.
- Every tooltip that shows a shortcut must show the current keys.
- Every client shortcut must be editable, terminal search and zoom included.
- Enter and Esc in dialogs must stay fixed and must not appear as editable.
- The client must remember the changed shortcuts across reloads and restarts.

Shortcuts to the settings
- The shortcut that opened the shortcuts panel must now open the settings on the shortcuts section.
- The theme shortcut must keep switching the theme.
- While the popup is open, the client shortcuts must do nothing, as in every dialog.

### Non-functional

- The popup, the editing of a row and every action must work with the keyboard, with a visible focus.
- A key press during editing must not reach Claude Code or start another shortcut.

## Assumptions

- This is an evolution, not a fix. The request adds what the earlier analyses left out of scope. The gatekeeper decided this.
- "Stile dei bordi (windows, mac)" means the look of [wsl_support.md](wsl_support.md): the macOS look or the Windows 11 look.
- Changes apply at once. The popup has no "Save" or "Cancel" button.
- The client remembers settings where the user made them, like the theme ([light_theme.md](light_theme.md), line 62). The desktop app and a browser can each keep different shortcuts.
- The layout rule of [keyboard_shortcuts.md](keyboard_shortcuts.md) line 80 (no AltGr keys) binds the defaults only. A user's own key works on the user's own layout.
- "Restore all" asks for a confirmation, because it loses every change at once. "Restore default" on one row does not.
- The settings button opens the popup on the first section. Only the former panel shortcut opens it on the shortcuts section.
- The settings button and popup work the same in the desktop app and in the browser. Both choices are offered in both.

## Risks

- A new Claude Code version can start to use a key that the user chose. That key then stops reaching Claude Code, and the client does not notice.
- A user who changed the GNOME shortcuts can still pick a key that GNOME takes. The client checks only the default GNOME keys.
- The theme and look now need two steps instead of one click. Users who switched often lose a fast path, except the theme shortcut.

## Scope

In scope:
- The settings button at the bottom of the navigation rail and the settings popup.
- Theme and look choices moved from the top bar into the popup.
- The shortcuts section that replaces the shortcuts panel, with editing, restore default and restore all.
- Remembering the changed shortcuts.

Out of scope:
- New settings beyond theme, look and shortcuts.
- Turning a shortcut off with no key.
- Single-key shortcuts or key sequences.
- Export, import or sync of settings between the desktop app and browsers.
- Changing Enter and Esc in dialogs, or Claude Code's own keys.
- Any change to the themes, the looks or the window buttons themselves.
