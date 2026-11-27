// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, run, unmountAll } from '../settings/settings-test-support';
import { TurnPanelButton } from './TurnPanelButton';

afterEach(() => {
  unmountAll();
});

describe('TurnPanelButton', () => {
  // plan-subagent_panel/REQ-21, plan-session_activity/REQ-47: a button named "Subagents" with that tooltip, whose aria-expanded follows the panel
  it.each([false, true])('is named "Subagents" with that tooltip and aria-expanded %s', (open) => {
    const button = mount(<TurnPanelButton open={open} onToggle={() => {}} />).querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Subagents');
    expect(button.getAttribute('title')).toBe('Subagents');
    expect(button.getAttribute('aria-expanded')).toBe(String(open));
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  // plan-session_activity/REQ-27: each click toggles the panel
  it('calls onToggle on each click', () => {
    const onToggle = vi.fn();
    const button = mount(<TurnPanelButton open={false} onToggle={onToggle} />).querySelector('button')!;
    run(() => button.click());
    run(() => button.click());
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
