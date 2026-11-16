// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Theme } from '../theme/theme-store';
import { ThemeSection } from './ThemeSection';
import { labelOf, mount, radios, run, themeStore, unmountAll } from './settings-test-support';

afterEach(unmountAll);

const checkedLabels = (host: HTMLElement) => radios(host).filter((radio) => radio.checked).map(labelOf);

describe('ThemeSection', () => {
  // plan-dark_blue_theme/REQ-30: a group "Theme" with the radios "Light", "Dark", "Dark Blue", in this order
  it('is a fieldset with the legend "Theme" and the radios "Light", "Dark", "Dark Blue"', () => {
    const host = mount(<ThemeSection store={themeStore('dark').store} />);
    const fieldset = host.querySelector('fieldset');
    expect(fieldset?.querySelector('legend')?.textContent).toBe('Theme');
    expect(radios(host).map(labelOf)).toEqual(['Light', 'Dark', 'Dark Blue']);
    const names = new Set(radios(host).map((radio) => radio.name));
    expect(names.size, 'one radio group').toBe(1);
  });

  // plan-dark_blue_theme/REQ-30: the active theme is checked
  it.each([
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['dark-blue', 'Dark Blue'],
  ] as const)('checks the card of the theme %s', (theme, label) => {
    const host = mount(<ThemeSection store={themeStore(theme).store} />);
    expect(checkedLabels(host)).toEqual([label]);
  });

  // plan-dark_blue_theme/REQ-31: choosing a card that is not checked calls setTheme once and checks it
  it.each<[Theme, number, Theme, string]>([
    ['dark', 2, 'dark-blue', 'Dark Blue'],
    ['dark', 0, 'light', 'Light'],
    ['dark-blue', 1, 'dark', 'Dark'],
    ['light', 2, 'dark-blue', 'Dark Blue'],
  ])('in the %s theme, choosing card %i calls setTheme(%s) once and checks "%s"', (from, index, to, label) => {
    const { store, setTheme } = themeStore(from);
    const host = mount(<ThemeSection store={store} />);
    run(() => (radios(host)[index] as HTMLInputElement).click());
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith(to);
    expect(store.getSnapshot()).toBe(to);
    expect(checkedLabels(host)).toEqual([label]);
  });

  // spec ThemeSection, Actions: choosing the checked card does nothing
  it.each<[Theme, number]>([
    ['dark', 1],
    ['dark-blue', 2],
  ])('in the %s theme, choosing the checked card %i does not change the store', (theme, index) => {
    const { store, setTheme, toggle } = themeStore(theme);
    const host = mount(<ThemeSection store={store} />);
    run(() => (radios(host)[index] as HTMLInputElement).click());
    expect(setTheme).not.toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(theme);
  });

  // spec ThemeSection, Shows: the checked card follows a change made elsewhere (e.g. Alt+A)
  it('follows a theme change made outside the section', () => {
    const { store } = themeStore('dark');
    const host = mount(<ThemeSection store={store} />);
    run(() => store.toggle());
    expect(checkedLabels(host)).toEqual(['Dark Blue']);
    run(() => store.toggle());
    expect(checkedLabels(host)).toEqual(['Light']);
  });
});
