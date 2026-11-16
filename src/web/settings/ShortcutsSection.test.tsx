// @vitest-environment jsdom
// Tests of plan-settings_dialog, batches shortcuts-section and editable-shortcuts: ShortcutsSection spec.
import { flushSync } from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import { SHORTCUTS } from '../shortcut-map';
import { UserShortcutKeysStore } from '../user-shortcut-keys';
import { ShortcutsSection } from './ShortcutsSection';
import { mount, run, unmountAll } from './settings-test-support';

afterEach(unmountAll);

const html = renderToStaticMarkup(<ShortcutsSection store={new UserShortcutKeysStore()} />);
const roleTag = (role: string) => html.match(new RegExp(`<[a-z]+\\b[^>]*\\srole="${role}"[^>]*>`))?.[0] ?? '';

const render = (store = new UserShortcutKeysStore()) => ({ host: mount(<ShortcutsSection store={store} />), store });

const nameOf = (button: HTMLButtonElement) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '';
const buttons = (root: ParentNode) => [...root.querySelectorAll('button')];
const button = (root: ParentNode, name: string) => {
  const found = buttons(root).find((b) => nameOf(b) === name);
  if (!found) throw new Error(`no button "${name}"`);
  return found;
};
const groups = (host: HTMLElement) => [...host.querySelectorAll('section')];
const headingOf = (group: Element) => group.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() ?? '';
/** Visible text of a row without its buttons and messages, each `.kbd-badge` written as `[text]`. */
const rowText = (row: Element) => {
  const clone = row.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll('button, [role="alert"]')) el.remove();
  for (const badge of clone.querySelectorAll('.kbd-badge')) badge.textContent = `[${badge.textContent ?? ''}]`;
  for (const el of clone.querySelectorAll('*')) el.append(' ');
  return (clone.textContent ?? '').replace(/\s+/g, ' ').replace(/\]\s*\+\s*\[/g, ']+[').trim();
};
const rowOf = (host: HTMLElement, action: string, area?: string) => {
  const scope = area ? groups(host).find((group) => headingOf(group) === area)! : host;
  const row = [...scope.querySelectorAll('li')].find((li) => li.querySelector(`button[aria-label="Change Keys: ${action}"]`) ?? buttons(li).some((b) => nameOf(b) === `Change Keys: ${action}`));
  if (!row) throw new Error(`no row "${action}"`);
  return row;
};
const alertOf = (row: Element) => row.querySelector('[role="alert"]')?.textContent?.trim() ?? null;

/** Dispatches a key event on the focused element, as the browser does. */
function press(type: 'keydown' | 'keyup', key: string, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, ...init });
  flushSync(() => (document.activeElement ?? document.body).dispatchEvent(event));
  return event;
}
const altKey = (code: string, key: string) => press('keydown', key, code, { altKey: true });

function startEditing(host: HTMLElement, action: string, area?: string): HTMLButtonElement {
  const change = button(rowOf(host, action, area), `Change Keys: ${action}`);
  change.focus();
  run(() => change.click());
  return change;
}

const ROWS = [
  [
    'Focus the list [Alt]+[L]',
    'Focus the main view [Alt]+[C]',
    'Previous session [Alt]+[Up]',
    'Next session [Alt]+[Down]',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => `Session at position ${position} [Alt]+[${position}]`),
    'Next session that needs input [Alt]+[I]',
  ],
  [
    'New session dialog [Alt]+[N]',
    'Resume history dialog [Alt]+[H]',
    'Rename the open session [Alt]+[E]',
    '"Resume" or "Resume Here" on the open session [Alt]+[R]',
    'Stop the open hosted session [Alt]+[Shift]+[Q]',
    'Dismiss the open ended session [Alt]+[Shift]+[W]',
  ],
  [
    'Search [Ctrl]+[Shift]+[F]',
    'Larger text [Ctrl]+[=] / [Ctrl]+[+]',
    'Smaller text [Ctrl]+[-]',
    'Default text size [Ctrl]+[0]',
    'Focus the list [Ctrl]+[Shift]+[L]',
  ],
  ['Light/Dark theme [Alt]+[A]', 'Shortcut settings [Alt]+[S]'],
];

describe('ShortcutsSection', () => {
  // plan-settings_dialog/REQ-24, ShortcutsSection contract: tab panel content, not a dialog: no frame, no title, no shortcuts-panel class
  it('is not a dialog: no dialog role, no aria-modal, no class shortcuts-panel and no title', () => {
    expect(roleTag('dialog')).toBe('');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toMatch(/\bshortcuts-panel\b/);
    expect(html).not.toContain('Keyboard Shortcuts');
    expect(html).not.toMatch(/>\s*Close\s*</);
  });

  // ShortcutsSection contract, plan-keyboard_shortcuts/REQ-33: the region "Shortcut List" takes the focus with Tab
  it('has the focusable region "Shortcut List"', () => {
    const region = roleTag('region');
    expect(region).toContain('aria-label="Shortcut List"');
    expect(region).toContain('tabindex="0"');
  });

  // plan-settings_dialog/REQ-22: four groups, in the order navigation, sessions, terminal, general
  it('shows the groups Navigation, Sessions, Terminal, General, in this order', () => {
    expect(groups(render().host).map(headingOf)).toEqual(['Navigation', 'Sessions', 'Terminal', 'General']);
  });

  // plan-settings_dialog/REQ-22, REQ-23, REQ-27, REQ-58: one row per action, the action, then its keys in badges
  it('shows every shortcut of the key map, one row per action, with its badges and action', () => {
    expect(groups(render().host).map((group) => [...group.querySelectorAll('li')].map(rowText))).toEqual(ROWS);
  });

  // plan-settings_dialog/REQ-22, ShortcutsSection invariant: every row of the ShortcutMap shows, in map order, and nothing else
  it('shows one row per ShortcutMap row, in map order, and no other row', () => {
    const shown = [...render().host.querySelectorAll('li')].map(rowText);
    expect(shown).toHaveLength(SHORTCUTS.length);
    SHORTCUTS.forEach((row, index) => expect(shown[index]?.startsWith(`${row.action} `), row.action).toBe(true));
  });

  // ShortcutsSection invariant: no key is written in the section itself, so the badges are exactly the keys of the map
  it('shows one badge per modifier and key of the map', () => {
    const expected = SHORTCUTS.flatMap((row) => row.keys).reduce((sum, key) => sum + key.modifiers.length + 1, 0);
    expect(render().host.querySelectorAll('.kbd-badge')).toHaveLength(expected);
  });

  // plan-settings_dialog/REQ-39: Enter and Esc of the dialogs have no row
  it('has no row for Enter or Esc', () => {
    const texts = [...render().host.querySelectorAll('li')].map(rowText);
    for (const text of texts) expect(text).not.toMatch(/\[(Enter|Esc)\]/);
  });

  // plan-settings_dialog/REQ-26, REQ-34, REQ-35, REQ-42, REQ-58, REQ-59: "Restore All" above the list; each row has the icon buttons "Change Keys" and "Restore Default", named after its action, with a tooltip
  it('shows "Restore All" before the list and, in each row, "Change Keys" and a disabled "Restore Default"', () => {
    const { host } = render();
    const all = buttons(host);
    expect(nameOf(all[0]!)).toBe('Restore All');
    const region = host.querySelector('[role="region"]')!;
    expect(all[0]!.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const rows = [...host.querySelectorAll('li')];
    rows.forEach((row, index) => {
      const action = SHORTCUTS[index]!.action;
      expect(buttons(row).map(nameOf), action).toEqual([`Change Keys: ${action}`, `Restore Default: ${action}`]);
      expect(buttons(row).map((b) => b.getAttribute('title'))).toEqual(['Change Keys', 'Restore Default']);
      expect(button(row, `Restore Default: ${action}`).disabled, action).toBe(true);
    });
    for (const b of all) expect(b.type, nameOf(b)).toBe('button');
  });

  // plan-settings_dialog/REQ-59: "Restore All" sits in the header with the title "Shortcuts", outside the region that scrolls
  it('puts "Restore All" next to the title "Shortcuts", outside the "Shortcut List" region', () => {
    const { host } = render();
    const restoreAll = button(host, 'Restore All');
    const region = host.querySelector('[role="region"][aria-label="Shortcut List"]')!;
    expect(region.contains(restoreAll)).toBe(false);
    expect(restoreAll.parentElement?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim()).toBe('Shortcuts');
  });

  // plan-settings_dialog/REQ-26: "Change Keys" puts the row in editing, and another row's "Change Keys" moves the editing there
  it('puts one row at a time in editing', () => {
    const { host } = render();
    startEditing(host, 'New session dialog');
    expect(rowText(rowOf(host, 'New session dialog'))).toContain('Press new keys, Esc to cancel');
    startEditing(host, 'Resume history dialog');
    expect(rowText(rowOf(host, 'Resume history dialog'))).toContain('Press new keys, Esc to cancel');
    expect(rowText(rowOf(host, 'New session dialog'))).toBe('New session dialog [Alt]+[N]');
  });

  // plan-settings_dialog/REQ-26, REQ-37, REQ-40: an accepted press is saved for the row, shows at once, and the focus goes back to "Change Keys"
  it('saves an accepted press as the one key of the row and shows it at once', () => {
    const { host, store } = render();
    const change = startEditing(host, 'Larger text', 'Terminal');
    press('keydown', 'Alt', 'AltLeft', { altKey: true });
    expect(rowText(rowOf(host, 'Larger text', 'Terminal')), 'a modifier alone keeps the editing').toContain('Press new keys, Esc to cancel');
    altKey('KeyK', 'k');
    expect(store.keyOf('terminal-larger-text')).toEqual({ code: 'KeyK', modifiers: ['Alt'], character: 'k' });
    const row = rowOf(host, 'Larger text', 'Terminal');
    expect(rowText(row)).toBe('Larger text [Alt]+[K]');
    expect(button(row, 'Restore Default: Larger text').disabled).toBe(false);
    expect(document.activeElement).toBe(change);
  });

  // plan-settings_dialog/REQ-26, ShortcutsSection contract: the saved modifiers are those pressed, in the order Ctrl, Alt, Shift
  it('saves Ctrl, Alt and Shift as pressed', () => {
    const { host, store } = render();
    startEditing(host, 'Rename the open session');
    press('keydown', 'Shift', 'ShiftLeft', { shiftKey: true });
    press('keydown', 'Control', 'ControlLeft', { shiftKey: true, ctrlKey: true });
    press('keydown', 'Meta', 'MetaLeft', { shiftKey: true, ctrlKey: true });
    press('keydown', 'J', 'KeyJ', { shiftKey: true, ctrlKey: true, altKey: true });
    expect(store.keyOf('rename-session')).toEqual({ code: 'KeyJ', modifiers: ['Ctrl', 'Alt', 'Shift'], character: 'J' });
    expect(rowText(rowOf(host, 'Rename the open session'))).toBe('Rename the open session [Ctrl]+[Alt]+[Shift]+[J]');
  });

  // plan-settings_dialog/REQ-28, REQ-29, REQ-30, REQ-31, REQ-32 — scenario "The client rejects a key that is already taken"
  it.each([
    ['Alt+L', 'KeyL', 'l', { altKey: true }, 'Already used by Focus the list'],
    ['Shift+K', 'KeyK', 'K', { shiftKey: true }, 'Use Ctrl or Alt in the shortcut'],
    ['Alt+B', 'KeyB', 'b', { altKey: true }, 'Used by Claude Code'],
    ['Enter', 'Enter', 'Enter', {}, 'Use Ctrl or Alt in the shortcut'],
  ])('rejects %s on "New session dialog": the row stays in editing with "%s"', (_, code, key, init, message) => {
    const { host, store } = render();
    const change = startEditing(host, 'New session dialog');
    const event = press('keydown', key, code, init);
    const row = rowOf(host, 'New session dialog');
    expect(alertOf(row)).toBe(message);
    expect(rowText(row)).toContain('Press new keys, Esc to cancel');
    expect(store.getSnapshot()).toEqual({});
    expect(event.defaultPrevented).toBe(true);
    const alert = row.querySelector('[role="alert"]')!;
    expect(alert.id, 'the message has an id').not.toBe('');
    expect(change.getAttribute('aria-describedby')?.split(/\s+/)).toContain(alert.id);
  });

  // plan-settings_dialog/REQ-31: a rejected press then an accepted one saves the second, and the message goes
  it('removes the message when a later press is accepted', () => {
    const { host, store } = render();
    startEditing(host, 'New session dialog');
    altKey('KeyL', 'l');
    altKey('KeyK', 'k');
    const row = rowOf(host, 'New session dialog');
    expect(alertOf(row)).toBeNull();
    expect(store.keyOf('new-session')).toMatchObject({ code: 'KeyK', modifiers: ['Alt'] });
    expect(rowText(row)).toBe('New session dialog [Alt]+[K]');
  });

  // plan-settings_dialog/REQ-33, REQ-39 — scenario "The user cancels an edit with Esc"
  it('leaves the editing on Esc with the old keys, no message, and the focus on "Change Keys"', () => {
    const { host, store } = render();
    const change = startEditing(host, 'Rename the open session');
    altKey('KeyL', 'l');
    const esc = press('keydown', 'Escape', 'Escape');
    const row = rowOf(host, 'Rename the open session');
    expect(rowText(row)).toBe('Rename the open session [Alt]+[E]');
    expect(alertOf(row)).toBeNull();
    expect(store.getSnapshot()).toEqual({});
    expect(document.activeElement).toBe(change);
    expect(esc.defaultPrevented, 'Esc is cancelled, so the popup does not close').toBe(true);
  });

  // plan-settings_dialog/REQ-41: during editing every keydown and keyup is cancelled and stopped before the page listeners
  it('cancels and stops every keydown and keyup during the editing', () => {
    const { host } = render();
    const reached: string[] = [];
    const capture = (event: Event) => reached.push(`document-capture:${event.type}:${(event as KeyboardEvent).key}`);
    const bubble = (event: Event) => reached.push(`document:${event.type}:${(event as KeyboardEvent).key}`);
    for (const type of ['keydown', 'keyup']) {
      document.addEventListener(type, capture, true);
      document.addEventListener(type, bubble);
    }
    onTestFinished(() => {
      for (const type of ['keydown', 'keyup']) {
        document.removeEventListener(type, capture, true);
        document.removeEventListener(type, bubble);
      }
    });
    startEditing(host, 'New session dialog');
    const events = [
      press('keydown', 'Alt', 'AltLeft', { altKey: true }),
      press('keydown', 'l', 'KeyL', { altKey: true }),
      press('keyup', 'l', 'KeyL', { altKey: true }),
      press('keydown', 'Enter', 'Enter'),
      press('keyup', 'Enter', 'Enter'),
      press('keydown', 'k', 'KeyK', { altKey: true }),
    ];
    expect(events.map((event) => event.defaultPrevented)).toEqual(events.map(() => true));
    expect(reached).toEqual([]);
    press('keydown', 'x', 'KeyX');
    expect(reached, 'after the editing, keys reach the page again').toContain('document:keydown:x');
  });

  // plan-settings_dialog/REQ-34 — scenario "The user restores the default keys", first action
  it('puts back the default keys of one row on "Restore Default" and moves the focus to its "Change Keys"', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'], character: 'k' });
    store.set('resume-history', { code: 'KeyJ', modifiers: ['Alt'], character: 'j' });
    const { host } = render(store);
    const row = rowOf(host, 'Focus the list', 'Navigation');
    expect(rowText(row)).toBe('Focus the list [Alt]+[K]');
    run(() => button(row, 'Restore Default: Focus the list').click());
    expect(rowText(rowOf(host, 'Focus the list', 'Navigation'))).toBe('Focus the list [Alt]+[L]');
    expect(store.keyOf('focus-list')).toBeUndefined();
    expect(store.keyOf('resume-history')).toBeDefined();
    expect(button(rowOf(host, 'Focus the list', 'Navigation'), 'Restore Default: Focus the list').disabled).toBe(true);
    expect(document.activeElement).toBe(button(rowOf(host, 'Focus the list', 'Navigation'), 'Change Keys: Focus the list'));
  });

  // plan-settings_dialog/REQ-30, REQ-34, assumption "Restore default in conflict": a default key now used by another row is rejected with the same message
  it('rejects "Restore Default" when another row now uses the default keys, and changes nothing', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'], character: 'k' });
    store.set('new-session', { code: 'KeyL', modifiers: ['Alt'], character: 'l' });
    const { host } = render(store);
    run(() => button(rowOf(host, 'Focus the list', 'Navigation'), 'Restore Default: Focus the list').click());
    const row = rowOf(host, 'Focus the list', 'Navigation');
    expect(alertOf(row)).toBe('Already used by New session dialog');
    expect(rowText(row)).toBe('Focus the list [Alt]+[K]');
    expect(store.keyOf('focus-list')).toMatchObject({ code: 'KeyK' });
  });

  // plan-settings_dialog/REQ-35, REQ-36 — scenario "The user restores the default keys", confirmation
  it('asks for a confirmation on "Restore All": "Cancel" changes nothing, "Restore All" puts every row back', () => {
    const store = new UserShortcutKeysStore();
    store.set('focus-list', { code: 'KeyK', modifiers: ['Alt'], character: 'k' });
    store.set('resume-history', { code: 'KeyJ', modifiers: ['Alt'], character: 'j' });
    const { host } = render(store);
    const keysBefore = store.getSnapshot();

    run(() => button(host, 'Restore All').click());
    let dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Restore All Shortcuts');
    expect(dialog.textContent).toContain('Every shortcut goes back to its default keys.');
    expect(document.activeElement).toBe(button(dialog, 'Cancel'));
    expect(button(dialog, 'Restore All').classList.contains('button-attn'), 'amber primary action').toBe(true);
    expect(store.getSnapshot(), 'nothing changes before the confirmation').toBe(keysBefore);

    run(() => button(dialog, 'Cancel').click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(store.getSnapshot()).toBe(keysBefore);

    run(() => button(host, 'Restore All').click());
    dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
    run(() => button(dialog, 'Restore All').click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(store.getSnapshot()).toEqual({});
    expect(groups(host).map((group) => [...group.querySelectorAll('li')].map(rowText))).toEqual(ROWS);
  });

  // plan-settings_dialog/REQ-35, ShortcutsSection contract: "Restore All" ends the editing and removes every message
  it('ends the editing and removes the messages on "Restore All"', () => {
    const { host } = render();
    startEditing(host, 'New session dialog');
    altKey('KeyL', 'l');
    run(() => button(host, 'Restore All').click());
    const row = rowOf(host, 'New session dialog');
    expect(rowText(row)).toBe('New session dialog [Alt]+[N]');
    run(() => button(document.querySelector('[role="alertdialog"]')!, 'Restore All').click());
    expect(alertOf(rowOf(host, 'New session dialog'))).toBeNull();
  });

  // plan-settings_dialog/REQ-37: a change made elsewhere on the store shows at once in the rows
  it('shows a change of the store at once', () => {
    const { host, store } = render();
    run(() => store.set('toggle-theme', { code: 'KeyG', modifiers: ['Alt', 'Shift'], character: 'G' }));
    expect(rowText(rowOf(host, 'Light/Dark theme'))).toBe('Light/Dark theme [Alt]+[Shift]+[G]');
  });
});
