import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MacWindowIcon, WindowsLogoIcon } from './icons/Icons';
import { LookSwitch } from './LookSwitch';
import { type Look, LookStore } from './theme/look-store';

const root = { setAttribute: () => {} };
const renderSwitch = (look: Look) => renderToStaticMarkup(<LookSwitch store={new LookStore(root, look)} />);
const buttonTag = (html: string) => html.match(/^<button\b[^>]*>/)?.[0] ?? '';

describe('LookSwitch', () => {
  it.each<Look>(['vexel', 'windows11'])('is one button named "Windows 11 look" in the %s look', (look) => {
    const html = renderSwitch(look);
    expect(html.match(/<button\b/g)).toHaveLength(1);
    const tag = buttonTag(html);
    expect(tag).toContain('aria-label="Windows 11 look"');
    expect(tag).toContain('title="Windows 11 look"');
  });

  it('in the Windows 11 look is pressed and shows the Windows icon', () => {
    const html = renderSwitch('windows11');
    expect(buttonTag(html)).toContain('aria-pressed="true"');
    expect(html).toContain(renderToStaticMarkup(<WindowsLogoIcon />));
  });

  it('in the Vexel look is not pressed and shows the window with three dots', () => {
    const html = renderSwitch('vexel');
    expect(buttonTag(html)).toContain('aria-pressed="false"');
    expect(html).toContain(renderToStaticMarkup(<MacWindowIcon />));
  });
});
