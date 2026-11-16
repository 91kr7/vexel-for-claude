// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeSection } from './ThemeSection';
import { labelOf, mount, radios, run, themeStore, unmountAll } from './settings-test-support';

afterEach(unmountAll);

describe('ThemeSection', () => {
  // plan-settings_dialog/REQ-12: a group "Theme" with the radios "Light", "Dark", in this order
  it('is a fieldset with the legend "Theme" and the radios "Light" then "Dark"', () => {
    const host = mount(<ThemeSection store={themeStore('dark').store} />);
    const fieldset = host.querySelector('fieldset');
    expect(fieldset?.querySelector('legend')?.textContent).toBe('Theme');
    expect(radios(host).map(labelOf)).toEqual(['Light', 'Dark']);
    const names = new Set(radios(host).map((radio) => radio.name));
    expect(names.size, 'one radio group').toBe(1);
  });

  // plan-settings_dialog/REQ-14: the active theme is checked
  it.each([
    ['light', 'Light'],
    ['dark', 'Dark'],
  ] as const)('checks "%s" when the theme is %s', (theme, label) => {
    const host = mount(<ThemeSection store={themeStore(theme).store} />);
    expect(radios(host).filter((radio) => radio.checked).map(labelOf)).toEqual([label]);
  });

  // plan-settings_dialog/REQ-12, REQ-15: choosing the other radio toggles the store once and checks it
  it('choosing "Light" in the dark theme toggles the store once and checks "Light"', () => {
    const { store, toggle } = themeStore('dark');
    const host = mount(<ThemeSection store={store} />);
    const light = radios(host)[0] as HTMLInputElement;
    run(() => light.click());
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe('light');
    expect(radios(host).filter((radio) => radio.checked).map(labelOf)).toEqual(['Light']);
  });

  it('choosing "Dark" in the light theme toggles the store once', () => {
    const { store, toggle } = themeStore('light');
    const host = mount(<ThemeSection store={store} />);
    run(() => (radios(host)[1] as HTMLInputElement).click());
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe('dark');
  });

  // spec ThemeSection, Actions: choosing the checked radio does nothing
  it('choosing the checked radio does not toggle the store', () => {
    const { store, toggle } = themeStore('dark');
    const host = mount(<ThemeSection store={store} />);
    run(() => (radios(host)[1] as HTMLInputElement).click());
    expect(toggle).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe('dark');
  });

  // spec ThemeSection, Shows: the checked radio follows a change made elsewhere (e.g. Alt+A)
  it('follows a theme change made outside the section', () => {
    const { store } = themeStore('dark');
    const host = mount(<ThemeSection store={store} />);
    run(() => store.toggle());
    expect(radios(host).filter((radio) => radio.checked).map(labelOf)).toEqual(['Light']);
  });
});
