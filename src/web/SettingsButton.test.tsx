// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsIcon } from './icons/Icons';
import { SettingsButton } from './SettingsButton';
import { mount, run, unmountAll } from './settings/settings-test-support';

afterEach(unmountAll);

describe('SettingsButton', () => {
  // plan-settings_dialog/REQ-1, REQ-3: one rail button named "Settings", with the gear icon and the rail tooltip with the settings shortcut, opening a dialog
  it('is one native rail button named "Settings" with the tooltip "Settings (Alt+S)", aria-haspopup dialog and the gear icon', () => {
    const host = mount(<SettingsButton onOpen={() => {}} />);
    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    const button = buttons[0] as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Settings');
    expect(button.classList.contains('vx-rail-btn')).toBe(true);
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.innerHTML).toContain(renderToStaticMarkup(<SettingsIcon />));
    const tooltip = button.querySelector('.vx-tooltip');
    expect(tooltip?.textContent).toBe('Settings (Alt+S)');
    expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
  });

  // spec SettingsButton: the icon and the tooltip are decorative
  it('has a decorative icon and no text outside its hidden tooltip', () => {
    const host = mount(<SettingsButton onOpen={() => {}} />);
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const clone = host.cloneNode(true) as HTMLElement;
    for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    expect(clone.textContent?.trim()).toBe('');
  });

  // plan-settings_dialog/REQ-4: a click calls onOpen and the button keeps the focus
  it('calls onOpen once on a click and keeps the focus', () => {
    const onOpen = vi.fn();
    const host = mount(<SettingsButton onOpen={onOpen} />);
    const button = host.querySelector('button') as HTMLButtonElement;
    button.focus();
    run(() => button.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    button.dispatchEvent(press);
    expect(press.defaultPrevented, 'a mouse press does not move the focus away').toBe(false);
  });
});
