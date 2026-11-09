// Tests of plan-keyboard_shortcuts, batch shortcuts-panel: ShortcutsButton spec.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeyboardIcon } from './icons/Icons';
import { ShortcutsButton } from './ShortcutsButton';

const renderButton = (open: boolean) => renderToStaticMarkup(<ShortcutsButton open={open} onToggle={() => {}} />);
const buttonTag = (html: string) => html.match(/^<button\b[^>]*>/)?.[0] ?? '';

describe('ShortcutsButton', () => {
  // plan-keyboard_shortcuts/REQ-23: one button named "Keyboard Shortcuts", whose tooltip shows Alt+S
  it.each([false, true])('is one button named "Keyboard Shortcuts" with the tooltip "Keyboard Shortcuts (Alt+S)" (open: %s)', (open) => {
    const html = renderButton(open);
    expect(html).toMatch(/^<button\b[\s\S]*<\/button>$/);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    const tag = buttonTag(html);
    expect(tag).toContain('aria-label="Keyboard Shortcuts"');
    expect(tag).toContain('title="Keyboard Shortcuts (Alt+S)"');
    expect(tag).toContain('type="button"');
  });

  // ShortcutsButton contract: it announces a dialog, and aria-expanded follows the panel
  it('has aria-haspopup="dialog" and aria-expanded equal to open', () => {
    expect(buttonTag(renderButton(false))).toContain('aria-haspopup="dialog"');
    expect(buttonTag(renderButton(false))).toContain('aria-expanded="false"');
    expect(buttonTag(renderButton(true))).toContain('aria-expanded="true"');
  });

  // plan-keyboard_shortcuts/REQ-22, ShortcutsButton invariant: the keyboard icon is decorative, the name stays "Keyboard Shortcuts"
  it('shows the keyboard icon, hidden from assistive technology', () => {
    const icon = renderToStaticMarkup(<KeyboardIcon />);
    expect(icon).toContain('<svg');
    expect(icon).toContain('aria-hidden="true"');
    expect(renderButton(false)).toContain(icon);
  });
});
