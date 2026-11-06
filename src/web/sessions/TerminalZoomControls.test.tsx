import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MinusIcon, PlusIcon } from '../icons/Icons';
import { TerminalZoomControls } from './TerminalZoomControls';

const noop = () => {};
const render = (size: number) => renderToStaticMarkup(<TerminalZoomControls size={size} onSmaller={noop} onReset={noop} onLarger={noop} />);
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1]!, inner: m[2]! }));
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const nameOf = (button: { attrs: string; inner: string }) => attr(button.attrs, 'aria-label') ?? button.inner.replace(/<[^>]*>/g, '').trim();
const disabled = (button: { attrs: string }) => /\sdisabled(?:=""|\s|$)/.test(button.attrs);

describe('TerminalZoomControls', () => {
  // plan-terminal_addons/REQ-35, REQ-45: one group named "Terminal text size" with three named buttons, in order
  it('shows a group "Terminal text size" with "Smaller text", the default size button and "Larger text", in this order', () => {
    const html = render(12);
    expect(html).toMatch(/^<[a-z]+\b(?=[^>]*\srole="group")(?=[^>]*\saria-label="Terminal text size")[^>]*>/);
    expect(buttons(html).map(nameOf)).toEqual(['Smaller text', 'Default text size (12 px)', 'Larger text']);
  });

  // TerminalZoomControls: the default size button shows the current size
  it.each([8, 12, 17, 32])('the default size button shows "%i px" and is named after it', (size) => {
    const reset = buttons(render(size))[1]!;
    expect(reset.inner.replace(/<[^>]*>/g, '').trim()).toBe(`${size} px`);
    expect(attr(reset.attrs, 'aria-label')).toBe(`Default text size (${size} px)`);
  });

  it('gives each button the tooltip with its key', () => {
    expect(buttons(render(12)).map((button) => attr(button.attrs, 'title'))).toEqual([
      'Smaller text (Ctrl+-)',
      'Default text size (Ctrl+0)',
      'Larger text (Ctrl+=)',
    ]);
  });

  it('draws the minus icon on "Smaller text" and the plus icon on "Larger text"', () => {
    const [smaller, , larger] = buttons(render(12));
    expect(smaller!.inner).toContain(renderToStaticMarkup(<MinusIcon />));
    expect(larger!.inner).toContain(renderToStaticMarkup(<PlusIcon />));
  });

  // plan-terminal_addons/REQ-41: "smaller" disabled at 8 or less, "larger" at 32 or more, the default size button never
  it.each<[number, boolean[]]>([
    [7, [true, false, false]],
    [8, [true, false, false]],
    [9, [false, false, false]],
    [12, [false, false, false]],
    [31, [false, false, false]],
    [32, [false, false, true]],
    [33, [false, false, true]],
  ])('at %i px the disabled buttons are %j', (size, expected) => {
    expect(buttons(render(size)).map(disabled)).toEqual(expected);
  });
});
