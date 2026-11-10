// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanUsagePopover } from './PlanUsagePopover';
import type { PlanUsageState } from './plan-usage-store';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
});

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount(state: PlanUsageState, onClose = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<PlanUsagePopover state={state} onClose={onClose} />));
  const panel = host.querySelector('[role="dialog"]') as HTMLElement;
  return { host, panel, onClose };
}

const keydown = (target: Element, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const NOW = new Date(2026, 10, 9, 12, 0, 0).getTime();
const LIMITS = [
  { label: 'Current session', percent: 40, resetsAt: new Date(NOW + 3_600_000).toISOString() },
  { label: 'Current week (all models)', percent: 75, resetsAt: new Date(NOW + 2 * 86_400_000).toISOString() },
  { label: 'Current week (Sonnet)', percent: 0, resetsAt: null },
];

describe('PlanUsagePopover', () => {
  // plan-usage_limits/REQ-3, REQ-4, REQ-15: a non-modal dialog named "Plan Usage" with a title and a close button
  it('is a dialog named "Plan Usage", not modal, with the title and a close button', () => {
    const { panel } = mount({ kind: 'loading' });
    expect(panel.getAttribute('aria-label')).toBe('Plan Usage');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(panel.querySelector('h2')?.textContent).toBe('Plan Usage');
    expect(panel.querySelector('button[aria-label="Close"]')).not.toBeNull();
  });

  // plan-usage_limits/REQ-4 (spec): opening takes no focus
  it('takes no focus when it opens', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    mount({ kind: 'loading' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  // plan-usage_limits/REQ-17: loading -> "Loading…"
  it('shows "Loading…" while loading, with no figures', () => {
    const { panel } = mount({ kind: 'loading' });
    expect(panel.textContent).toContain('Loading…');
    expect(panel.querySelector('li')).toBeNull();
    expect(panel.textContent).not.toContain('%');
  });

  // plan-usage_limits/REQ-5, REQ-6, REQ-7: one row per limit, in order
  it('shows one row per limit in the given order', () => {
    const { panel } = mount({ kind: 'ready', limits: LIMITS, readAt: NOW });
    const rows = [...panel.querySelectorAll('li')];
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.querySelector('.plan-limit-label')?.textContent)).toEqual(LIMITS.map((limit) => limit.label));
    expect(rows.map((row) => row.querySelector('.plan-limit-percent')?.textContent)).toEqual(['40%', '75%', '0%']);
    expect(panel.textContent).not.toContain('Loading…');
  });

  // plan-usage_limits/REQ-9: the remaining time counts from the time of the read
  it('counts the remaining time from the read time', () => {
    const { panel } = mount({ kind: 'ready', limits: LIMITS, readAt: NOW });
    expect(panel.textContent).toContain('Resets in 1h 0m');
    expect(panel.textContent).toContain('Resets in 2d 0h');
  });

  // plan-usage_limits/REQ-13: unavailable -> says so, no row, no "0%"
  it('says the plan usage is not available and shows no row and no 0%', () => {
    const { panel } = mount({ kind: 'unavailable' });
    expect(panel.textContent).toContain('Plan usage is not available');
    expect(panel.querySelector('li, [role="progressbar"]')).toBeNull();
    expect(panel.textContent).not.toContain('0%');
  });

  // plan-usage_limits/REQ-3: the close button and Esc inside the panel close it
  it('calls onClose from the close button', () => {
    const { panel, onClose } = mount({ kind: 'loading' });
    flushSync(() => (panel.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Esc with the focus inside the panel, and on no other key', () => {
    const { panel, onClose } = mount({ kind: 'loading' });
    const close = panel.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    close.focus();
    keydown(close, 'a');
    keydown(close, 'Enter');
    expect(onClose).not.toHaveBeenCalled();
    keydown(close, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // spec: a click outside does not close it, and it does not trap the focus
  it('does not close on a click outside', () => {
    const { onClose } = mount({ kind: 'loading' });
    document.body.click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
