// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { LookSection } from './LookSection';
import { labelOf, lookStore, mount, radios, run, unmountAll } from './settings-test-support';

afterEach(unmountAll);

const checked = (host: ParentNode) => radios(host).filter((radio) => radio.checked).map(labelOf);

describe('LookSection', () => {
  // plan-settings_dialog/REQ-13: a group "Window Look" with the radios "macOS", "Windows 11", in this order
  it('is a fieldset with the legend "Window Look" and the radios "macOS" then "Windows 11"', () => {
    const host = mount(<LookSection store={lookStore('vexel').store} />);
    expect(host.querySelector('fieldset > legend')?.textContent).toBe('Window Look');
    expect(radios(host).map(labelOf)).toEqual(['macOS', 'Windows 11']);
    expect(new Set(radios(host).map((radio) => radio.name)).size, 'one radio group').toBe(1);
  });

  // plan-settings_dialog/REQ-14: the active look is checked
  it.each([
    ['vexel', 'macOS'],
    ['windows11', 'Windows 11'],
  ] as const)('with the look %s checks "%s"', (look, label) => {
    const host = mount(<LookSection store={lookStore(look).store} />);
    expect(checked(host)).toEqual([label]);
  });

  // plan-settings_dialog/REQ-13, REQ-15: choosing the other radio toggles the store once
  it('choosing "Windows 11" in the macOS look toggles the store once and checks "Windows 11"', () => {
    const { store, toggle } = lookStore('vexel');
    const host = mount(<LookSection store={store} />);
    run(() => (radios(host)[1] as HTMLInputElement).click());
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe('windows11');
    expect(checked(host)).toEqual(['Windows 11']);
  });

  it('choosing "macOS" in the Windows 11 look toggles the store once', () => {
    const { store, toggle } = lookStore('windows11');
    const host = mount(<LookSection store={store} />);
    run(() => (radios(host)[0] as HTMLInputElement).click());
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe('vexel');
  });

  // spec LookSection, Actions: choosing the checked radio does nothing
  it('choosing the checked radio does not toggle the store', () => {
    const { store, toggle } = lookStore('vexel');
    const host = mount(<LookSection store={store} />);
    run(() => (radios(host)[0] as HTMLInputElement).click());
    expect(toggle).not.toHaveBeenCalled();
  });

  // spec LookSection, Shows: the checked radio follows the store
  it('follows a look change made outside the section', () => {
    const { store } = lookStore('vexel');
    const host = mount(<LookSection store={store} />);
    run(() => store.toggle());
    expect(checked(host)).toEqual(['Windows 11']);
  });
});
