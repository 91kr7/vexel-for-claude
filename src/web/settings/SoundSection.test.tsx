// @vitest-environment jsdom
// Tests of plan-input_sound, batch sound-switch: SoundSection spec.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundSection } from './SoundSection';
import { SoundSwitchStore } from './sound-switch-store';
import { mount, run, unmountAll } from './settings-test-support';

afterEach(unmountAll);

const NAME = 'Play a sound when a session needs input';

function show(store: SoundSwitchStore) {
  const host = mount(<SoundSection store={store} />);
  const switches = [...host.querySelectorAll<HTMLElement>('[role="switch"]')];
  return { host, switches, control: switches[0] as HTMLElement };
}

describe('SoundSection', () => {
  // plan-input_sound/REQ-10: one switch, named after the sound, on by default
  it(`shows one switch named "${NAME}", checked when the store is on`, () => {
    const { switches, control } = show(new SoundSwitchStore());
    expect(switches).toHaveLength(1);
    expect(control.textContent?.trim()).toBe(NAME);
    expect(control.getAttribute('aria-checked')).toBe('true');
  });

  // spec SoundSection: aria-checked follows the store
  it('shows the switch unchecked when the store is off', () => {
    const store = new SoundSwitchStore();
    store.set(false);
    expect(show(store).control.getAttribute('aria-checked')).toBe('false');
  });

  // plan-input_sound/REQ-11: a click sets the store once and the switch shows the new value at once
  it('a click turns the switch off, then on, setting the store once each time', () => {
    const store = new SoundSwitchStore();
    const set = vi.spyOn(store, 'set');
    const { control } = show(store);

    run(() => control.click());
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenLastCalledWith(false);
    expect(store.getSnapshot()).toBe(false);
    expect(control.getAttribute('aria-checked')).toBe('false');

    run(() => control.click());
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith(true);
    expect(control.getAttribute('aria-checked')).toBe('true');
  });

  // plan-input_sound/REQ-11: a change made elsewhere shows at once
  it('follows a change of the store made elsewhere', () => {
    const store = new SoundSwitchStore();
    const { control } = show(store);
    run(() => store.set(false));
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  // spec SoundSection, Keyboard: one Tab stop
  it('the switch is one focusable element', () => {
    const { host, control } = show(new SoundSwitchStore());
    const focusable = host.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(control);
    control.focus();
    expect(document.activeElement).toBe(control);
  });
});
