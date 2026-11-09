// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanLimitRow } from './PlanLimitRow';

const NOW = new Date(2026, 10, 9, 12, 0, 0).getTime();
const RESET_IN_2H15 = new Date(NOW + 2 * 3_600_000 + 15 * 60_000).toISOString();

function render(limit: { label: string; percent: number; resetsAt: string | null }) {
  const host = document.createElement('div');
  host.innerHTML = `<ul>${renderToStaticMarkup(<PlanLimitRow limit={limit} nowMs={NOW} />)}</ul>`;
  const item = host.querySelector('li') as HTMLElement;
  return {
    item,
    bar: item.querySelector('[role="progressbar"]') as HTMLElement,
    fill: item.querySelector('[role="progressbar"] > div') as HTMLElement,
    percent: item.querySelector('.plan-limit-percent') as HTMLElement,
  };
}

describe('PlanLimitRow', () => {
  // plan-usage_limits/REQ-5, REQ-6, REQ-7, REQ-8: label, percentage as a number and as a bar
  it('shows the label, the percentage as a number and a progressbar named by the label', () => {
    const { item, bar, fill, percent } = render({ label: 'Current week (Opus)', percent: 42, resetsAt: RESET_IN_2H15 });
    expect(item.textContent).toContain('Current week (Opus)');
    expect(percent.textContent).toBe('42%');
    expect(bar.getAttribute('aria-label')).toBe('Current week (Opus)');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(fill.style.width).toBe('42%');
  });

  // plan-usage_limits/REQ-9: the time remaining and the date and time
  it('shows "Resets in <remaining> · <date and time>"', () => {
    const { item } = render({ label: 'Current session', percent: 10, resetsAt: RESET_IN_2H15 });
    const date = new Date(RESET_IN_2H15);
    const expectedDate = `Mon 9 Nov, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    expect(item.textContent).toContain(`Resets in 2h 15m · ${expectedDate}`);
  });

  // spec: no reset line when resetsAt is null or not a date
  it.each([null, 'soon', ''])('has no reset line when resetsAt is %j', (resetsAt) => {
    const { item } = render({ label: 'Current session', percent: 10, resetsAt });
    expect(item.textContent).not.toContain('Resets in');
  });

  // plan-usage_limits/REQ-10: normal below 70, warning from 70, error from 90, on number and fill
  it.each([
    [0, 'normal'],
    [69, 'normal'],
    [70, 'warning'],
    [75, 'warning'],
    [89, 'warning'],
    [90, 'error'],
    [93, 'error'],
    [100, 'error'],
  ])('shows %s%% at the level "%s"', (percent, level) => {
    const { percent: number, fill } = render({ label: 'Current session', percent, resetsAt: null });
    for (const part of [number, fill]) {
      const levels = ['normal', 'warning', 'error'].filter((name) => part.classList.contains(`usage-${name}`));
      expect(levels).toEqual([level]);
    }
  });

  // spec: a percentage above 100 shows as it is, with a full bar
  it('shows 130% as it is with a full bar', () => {
    const { percent, bar, fill } = render({ label: 'Current session', percent: 130, resetsAt: null });
    expect(percent.textContent).toBe('130%');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(fill.style.width).toBe('100%');
  });

  it('cuts a negative percentage to an empty bar', () => {
    const { bar, fill } = render({ label: 'Current session', percent: -5, resetsAt: null });
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(fill.style.width).toBe('0%');
  });

  it('shows 0% as a number, not as an empty text', () => {
    const { percent } = render({ label: 'Current week (Sonnet)', percent: 0, resetsAt: null });
    expect(percent.textContent).toBe('0%');
  });
});
