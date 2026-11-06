import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MoonIcon, SunIcon } from './icons/Icons';
import { ThemeSwitch } from './ThemeSwitch';
import { type Theme, ThemeStore } from './theme/theme-store';

const root = { setAttribute: () => {} };
const renderSwitch = (theme: Theme) => renderToStaticMarkup(<ThemeSwitch store={new ThemeStore(root, theme)} />);
const buttonTag = (html: string) => html.match(/^<button\b[^>]*>/)?.[0] ?? '';

describe('ThemeSwitch', () => {
  // plan-light_theme/REQ-2: one button named "Dark theme", with the same tooltip, in both themes
  it.each<Theme>(['dark', 'light'])('is one button named "Dark theme" with the tooltip "Dark theme" in the %s theme', (theme) => {
    const html = renderSwitch(theme);
    expect(html).toMatch(/^<button\b[\s\S]*<\/button>$/);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    const tag = buttonTag(html);
    expect(tag).toContain('aria-label="Dark theme"');
    expect(tag).toContain('title="Dark theme"');
  });

  // plan-light_theme/REQ-2: aria-pressed and the icon show the active theme
  it('in the dark theme is pressed and shows the moon', () => {
    const html = renderSwitch('dark');
    expect(buttonTag(html)).toContain('aria-pressed="true"');
    expect(html).toContain(renderToStaticMarkup(<MoonIcon />));
    expect(html).not.toContain(renderToStaticMarkup(<SunIcon />));
  });

  it('in the light theme is not pressed and shows the sun', () => {
    const html = renderSwitch('light');
    expect(buttonTag(html)).toContain('aria-pressed="false"');
    expect(html).toContain(renderToStaticMarkup(<SunIcon />));
    expect(html).not.toContain(renderToStaticMarkup(<MoonIcon />));
  });

  // ThemeSwitch rule: the icons are decorative, so the button has no text of its own
  it.each<Theme>(['dark', 'light'])('has no visible text besides the decorative icon in the %s theme', (theme) => {
    const inner = renderSwitch(theme).replace(/^<button\b[^>]*>|<\/button>$/g, '');
    expect(inner.replace(/<svg\b[\s\S]*<\/svg>/, '').replace(/<[^>]*>/g, '').trim()).toBe('');
    expect(inner).toMatch(/<svg\b[^>]*aria-hidden="true"/);
  });
});
