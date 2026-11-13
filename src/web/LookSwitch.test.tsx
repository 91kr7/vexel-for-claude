// Unit tests of LookSwitch (module app), plan-wsl_support batch windows-look.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MacWindowIcon, WindowsLogoIcon } from './icons/Icons';
import { LookSwitch } from './LookSwitch';
import { type Look, LookStore } from './theme/look-store';

const root = { setAttribute: () => {} };
const renderSwitch = (look: Look) => renderToStaticMarkup(<LookSwitch store={new LookStore(root, look)} />);
const buttonTag = (html: string) => html.match(/^<button\b[^>]*>/)?.[0] ?? '';

describe('LookSwitch', () => {
  // plan-wsl_support/REQ-19: one button with the accessible name and tooltip "Windows 11 look", in both looks
  it.each<Look>(['vexel', 'windows11'])('is one button named "Windows 11 look" with the same tooltip in the %s look', (look) => {
    const html = renderSwitch(look);
    expect(html).toMatch(/^<button\b[\s\S]*<\/button>$/);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    const tag = buttonTag(html);
    expect(tag).toContain('aria-label="Windows 11 look"');
    expect(tag).toContain('title="Windows 11 look"');
  });

  // plan-wsl_support/REQ-19: aria-pressed and the icon show the active look
  it('in the Windows 11 look is pressed and shows the four squares, not the window with three dots', () => {
    const html = renderSwitch('windows11');
    expect(buttonTag(html)).toContain('aria-pressed="true"');
    expect(html).toContain(renderToStaticMarkup(<WindowsLogoIcon />));
    expect(html).not.toContain(renderToStaticMarkup(<MacWindowIcon />));
  });

  it('in the current look is not pressed and shows the window with three dots, not the four squares', () => {
    const html = renderSwitch('vexel');
    expect(buttonTag(html)).toContain('aria-pressed="false"');
    expect(html).toContain(renderToStaticMarkup(<MacWindowIcon />));
    expect(html).not.toContain(renderToStaticMarkup(<WindowsLogoIcon />));
  });

  it('the two looks show different icons', () => {
    expect(renderToStaticMarkup(<MacWindowIcon />)).not.toBe(renderToStaticMarkup(<WindowsLogoIcon />));
  });

  // LookSwitch rule: the icons are decorative, the button has no text of its own
  it.each<Look>(['vexel', 'windows11'])('has no visible text besides the decorative icon in the %s look', (look) => {
    const inner = renderSwitch(look).replace(/^<button\b[^>]*>|<\/button>$/g, '');
    expect(inner.replace(/<svg\b[\s\S]*<\/svg>/, '').replace(/<[^>]*>/g, '').trim()).toBe('');
    expect(inner).toMatch(/<svg\b[^>]*aria-hidden="true"/);
  });

  // LookSwitch keyboard: a native button, so it is in the Tab order and Enter/Space click it
  it.each<Look>(['vexel', 'windows11'])('is a native button of type "button" with no negative tabindex in the %s look', (look) => {
    const tag = buttonTag(renderSwitch(look));
    expect(tag).toContain('type="button"');
    expect(tag).not.toMatch(/tabindex="-/i);
  });
});
