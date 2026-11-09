// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GaugeIcon } from './icons/Icons';
import { PlanUsageButton } from './PlanUsageButton';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount(open: boolean, onToggle = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<PlanUsageButton open={open} onToggle={onToggle} />));
  return { button: host.querySelector('button') as HTMLButtonElement, onToggle };
}

const keydown = (target: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe('PlanUsageButton', () => {
  // plan-usage_limits/REQ-1, REQ-2, REQ-15: one button named and titled "Plan Usage", with the gauge icon
  it('is one button named "Plan Usage" with the tooltip "Plan Usage" and the gauge icon', () => {
    const html = renderToStaticMarkup(<PlanUsageButton open={false} onToggle={() => {}} />);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Plan Usage"');
    expect(html).toContain('title="Plan Usage"');
    expect(html).toContain(renderToStaticMarkup(<GaugeIcon />));
  });

  it('has a decorative icon and no visible text', () => {
    const { button } = mount(false);
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.textContent?.trim()).toBe('');
  });

  // plan-usage_limits/REQ-3 (spec): aria-haspopup dialog, aria-expanded follows open
  it.each([true, false])('has aria-haspopup="dialog" and aria-expanded=%s', (open) => {
    const { button } = mount(open);
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe(String(open));
  });

  // plan-usage_limits/REQ-3: a press toggles
  it('calls onToggle on a click', () => {
    const { button, onToggle } = mount(false);
    button.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // plan-usage_limits/REQ-2: Enter and Space on a native button give a click: it is a real button, not a div
  it('is a native button of type "button", so Enter and Space work', () => {
    const { button } = mount(false);
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(button.tabIndex).toBe(0);
  });

  // plan-usage_limits/REQ-4 (spec): a mouse press does not take the focus
  it('prevents the focus change on a mouse press', () => {
    const { button } = mount(false);
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    button.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
  });

  // spec: Esc while open closes
  it('calls onToggle on Esc while open', () => {
    const { button, onToggle } = mount(true);
    const event = keydown(button, 'Escape');
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing on Esc while closed, nor on another key', () => {
    const closed = mount(false);
    keydown(closed.button, 'Escape');
    expect(closed.onToggle).not.toHaveBeenCalled();
    const open = mount(true);
    keydown(open.button, 'a');
    expect(open.onToggle).not.toHaveBeenCalled();
  });
});
