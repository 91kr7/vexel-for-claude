// Tests of plan-settings_dialog, batch shortcuts-section: ShortcutsSection spec.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../shortcut-map';
import { ShortcutsSection } from './ShortcutsSection';

const html = renderToStaticMarkup(<ShortcutsSection />);

const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
/** Visible text of a fragment, with each `.kbd-badge` written as `[text]`. */
const textOf = (fragment: string) =>
  decode(
    fragment
      .replace(/<([a-z0-9]+)\b[^>]*\bclass="[^"]*\bkbd-badge\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g, '[$2]')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\]\s*\+\s*\[/g, ']+[')
      .trim(),
  );
const groups = () => [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1] ?? '');
const headingOf = (group: string) => textOf(group.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/)?.[1] ?? '');
const rowsOf = (group: string) => [...group.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1] ?? ''));
const roleTag = (role: string) => html.match(new RegExp(`<[a-z]+\\b[^>]*\\srole="${role}"[^>]*>`))?.[0] ?? '';

describe('ShortcutsSection', () => {
  // plan-settings_dialog/REQ-24, ShortcutsSection contract: tab panel content, not a dialog: no frame, no title, no buttons, no shortcuts-panel class
  it('is not a dialog: no dialog role, no aria-modal, no buttons and no class shortcuts-panel', () => {
    expect(roleTag('dialog')).toBe('');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toMatch(/<button\b/);
    expect(html).not.toMatch(/\bshortcuts-panel\b/);
    expect(textOf(html)).not.toContain('Keyboard Shortcuts');
  });

  // ShortcutsSection contract, plan-keyboard_shortcuts/REQ-33: the region "Shortcut List" takes the focus with Tab
  it('has the focusable region "Shortcut List"', () => {
    const region = roleTag('region');
    expect(region).toContain('aria-label="Shortcut List"');
    expect(region).toContain('tabindex="0"');
  });

  // plan-settings_dialog/REQ-22: four groups, in the order navigation, sessions, terminal, general
  it('shows the groups Navigation, Sessions, Terminal, General, in this order', () => {
    expect(groups().map(headingOf)).toEqual(['Navigation', 'Sessions', 'Terminal', 'General']);
  });

  // plan-settings_dialog/REQ-22, REQ-23, REQ-25: each row shows its keys in keyboard badges, then the action; Alt+S is "Shortcut settings"
  it('shows every shortcut of the key map with its badges and action', () => {
    expect(groups().map(rowsOf)).toEqual([
      [
        '[Alt]+[L] Focus the list',
        '[Alt]+[C] Focus the main view',
        '[Alt]+[Up] / [Alt]+[Down] Previous / next session',
        '[Alt]+[1] … [Alt]+[9] Session at position 1 to 9',
        '[Alt]+[I] Next session that needs input',
      ],
      [
        '[Alt]+[N] New session dialog',
        '[Alt]+[H] Resume history dialog',
        '[Alt]+[E] Rename the open session',
        '[Alt]+[R] "Resume" or "Resume Here" on the open session',
        '[Alt]+[Shift]+[Q] Stop the open hosted session',
        '[Alt]+[Shift]+[W] Dismiss the open ended session',
      ],
      [
        '[Ctrl]+[Shift]+[F] Search',
        '[Ctrl]+[=] / [Ctrl]+[+] / [Ctrl]+[-] / [Ctrl]+[0] Larger / smaller / default text',
        '[Ctrl]+[Shift]+[L] Focus the list',
      ],
      ['[Alt]+[A] Light/Dark theme', '[Alt]+[S] Shortcut settings'],
    ]);
  });

  // plan-settings_dialog/REQ-22, ShortcutsSection invariant: every row of the ShortcutMap shows, in map order, and nothing else
  it('shows one row per ShortcutMap row, in map order, and no other row', () => {
    const shown = groups().flatMap((group) => rowsOf(group));
    expect(shown).toHaveLength(SHORTCUTS.length);
    SHORTCUTS.forEach((row, index) => expect(shown[index]?.endsWith(` ${row.action}`), row.action).toBe(true));
  });

  // ShortcutsSection invariant: no key is written in the section itself, so the badges are exactly the keys of the map
  it('shows one badge per modifier and key of the map, with the first and last of a row of more than four keys', () => {
    const shownKeys = SHORTCUTS.flatMap((row) => (row.keys.length > 4 ? [row.keys[0]!, row.keys[row.keys.length - 1]!] : [...row.keys]));
    const expected = shownKeys.reduce((sum, key) => sum + key.modifiers.length + 1, 0);
    expect(html.match(/\bclass="[^"]*\bkbd-badge\b/g)).toHaveLength(expected);
  });
});
